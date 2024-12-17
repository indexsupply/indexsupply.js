import { createEventSource } from "eventsource-client";

/**
 * Represents the response structure from the API
 * @template T The type of the result items
 * @see {@link https://www.indexsupply.net/docs#response Response format documentation}
 * @example
 * type ExampleResponse = Response<{ address: string, value: string }> = {
 *   blockNumber: 17829471n,
 *   result: [
 *     { address: "0x123...", value: "1000000000000000000" }
 *   ]
 * }
 */
export type Response<T> = {
  blockNumber: bigint;
  result: T[];
};

type JsonValue = ReturnType<typeof JSON.parse>;
type DefaultType = { [key: string]: JsonValue };
type Formatter<T> = (row: JsonValue[]) => T;

/**
 * Represents a request to the API
 * @template T The expected return type of the formatted data
 * @see {@link https://www.indexsupply.net/docs#get-query GET /query API documentation}
 * @see {@link https://www.indexsupply.net/docs#chains Supported chains}
 * @see {@link https://www.indexsupply.net/docs#sql SQL query syntax}
 * @example
 * interface Transfer { from: string; to: string; value: string }
 * 
 * const request: Request<Transfer> = {
 *   chainId: 1n,
 *   query: "SELECT from, to, value FROM transfer",
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   formatRow: (row) => ({
 *     from: row[0] as string,
 *     to: row[1] as string,
 *     value: row[2] as string
 *   })
 * }
 */
export type Request<T> = {
  /** Optional custom API URL. Defaults to https://api.indexsupply.net */
  apiUrl?: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Chain ID for the target blockchain */
  chainId: bigint;
  /** SQL query to execute */
  query: string;
  /** Optional array of event signatures to filter events */
  eventSignatures?: ReadonlyArray<string>;
  /** Optional function to format the row data. Required if T is not DefaultType */
  formatRow?: T extends DefaultType ? undefined | Formatter<T> : Formatter<T>;
};

/**
 * Constructs the API URL with query parameters
 * @template T The type parameter for the request
 * @param path - The API endpoint path
 * @param request - The request configuration
 * @returns Formatted URL string
 */
function url<T>(
  path: string,
  request: Request<T> & { blockNumber?: bigint },
): string {
  const params = new URLSearchParams();
  params.append("chain", request.chainId.toString());
  params.append("query", request.query);
  if (request.eventSignatures) {
    params.append("event_signatures", request.eventSignatures.join(","));
  } else {
    params.append("event_signatures", "");
  }
  if (request.apiKey) {
    params.append("api-key", request.apiKey.toString());
  }
  if (request.blockNumber) {
    params.append("block_height", request.blockNumber.toString());
  }
  let apiUrl = "https://api.indexsupply.net";
  if (request.apiUrl) {
    apiUrl = request.apiUrl;
  }
  return `${apiUrl}/${path}?${params.toString()}`;
}

/**
 * Creates a default row formatter that maps column names to values
 * @param names - Array of column names
 * @returns A formatter function that creates an object with column name keys
 */
const defaultFormatRow = (names: string[]): Formatter<DefaultType> => {
  return (row: JsonValue[]) => {
    if (row.length !== names.length) {
      throw new Error(
        `Row length (${row.length}) does not match column names length (${names.length})`,
      );
    }
    return names.reduce((acc, name, index) => {
      acc[name] = row[index];
      return acc;
    }, {} as DefaultType);
  };
};

/**
 * Executes a query against the API and returns formatted results
 * @template T The type of the formatted results
 * @param request - The request configuration
 * @returns Promise containing the block number and formatted results
 * @throws Error if the API response is invalid or unexpected
 * @see {@link https://www.indexsupply.net/docs#get-query GET /query API documentation}
 * @see {@link https://www.indexsupply.net/docs#queries Query types}
 * @example
 * // Basic usage with default formatting
 * const result = await query({
 *   chainId: 1n,
 *   query: "SELECT from, to, value FROM transfer LIMIT 1",
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"]
 * });
 * 
 * // With custom type and formatting
 * interface Transfer { from: string; to: string; value: string }
 * const transfers = await query<Transfer>({
 *   chainId: 1n,
 *   query: "SELECT from, to, value FROM transfer LIMIT 1",
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   formatRow: (row) => ({
 *     from: row[0] as string,
 *     to: row[1] as string,
 *     value: row[2] as string
 *   })
 * });
 */
export async function query<T = DefaultType>(
  request: Request<T>,
): Promise<Response<T>> {
  const resp = await fetch(url("query", request));
  if (resp.status !== 200) {
    throw new Error(`Invalid API response: Status ${resp.status}`);
  }
  const data = await resp.text();
  const parsed = JSON.parse(data);
  if (parsed.result.length === 0) {
    return { blockNumber: parsed.block_height, result: [] };
  }
  if (parsed.result.length !== 1) {
    throw new Error(`Expected 1 result, got ${parsed.result.length}`);
  }
  const rows = parsed.result[0];
  if (rows.length === 0) {
    return { blockNumber: parsed.block_height, result: [] };
  }
  const columnNames = rows.shift();
  const formatRow = request.formatRow || defaultFormatRow(columnNames);
  return {
    blockNumber: parsed.block_height,
    result: rows.map(formatRow),
  };
}

/**
 * Creates a live query connection that yields results as they become available
 * @template T The type of the formatted results
 * @param request - The request configuration with optional starting block number
 * @yields Response objects containing block numbers and formatted results
 * @throws Error if the API response is invalid or unexpected
 * @see {@link https://www.indexsupply.net/docs#get-query-live GET /query-live API documentation}
 * @see {@link https://www.indexsupply.net/docs#reorgs Chain reorganization handling}
 * @example
 * // Basic usage with default formatting
 * for await (const response of queryLive({
 *   chainId: 1n,
 *   query: "SELECT from, to, value FROM transfer",
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   blockNumber: 17829471n
 * })) {
 *   console.log(response.blockNumber, response.result);
 * }
 * 
 * // With custom type and formatting
 * interface Transfer { from: string; to: string; value: string }
 * for await (const response of queryLive<Transfer>({
 *   chainId: 1n,
 *   query: "SELECT from, to, value FROM transfer",
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   formatRow: (row) => ({
 *     from: row[0] as string,
 *     to: row[1] as string,
 *     value: row[2] as string
 *   })
 * })) {
 *   console.log(response.blockNumber, response.result);
 * }
 */
export async function* queryLive<T = DefaultType>(
  request: Request<T> & { blockNumber?: bigint },
): AsyncGenerator<Response<T>> {
  const es = createEventSource(url("query-live", request));
  try {
    for await (const { data } of es) {
      let parsed = JSON.parse(data);
      if (parsed.result.length === 0) {
        yield { blockNumber: parsed.block_height, result: [] };
        continue;
      }
      if (parsed.result.length !== 1) {
        throw new Error(`Expected 1 result, got ${parsed.result.length}`);
      }
      let result = parsed.result[0];
      if (result.length === 0) {
        yield { blockNumber: parsed.block_height, result: [] };
        continue;
      }
      const columnNames = result.shift();
      const formatRow = request.formatRow || defaultFormatRow(columnNames);
      yield {
        blockNumber: parsed.block_height,
        result: result.map(formatRow),
      };
    }
  } finally {
    es.close();
  }
}
