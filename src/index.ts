// generated by: scripts/replace-version.js
const userAgentVersion = "0.0.11";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  public level: LogLevel;
  constructor() {
    this.level = LogLevel.INFO;
  }
  log(level: LogLevel, message: string, ...args: unknown[]) {
    if (level <= this.level) {
      console.log(`[${LogLevel[level]}] ${message}`, ...args);
    }
  }
};

let defaultLogger = new Logger();
let logger: LogHandler = (level, message, ...args) => {
  defaultLogger.log(level, message, ...args);
};

const logError = (message: string, ...args: unknown[]) => {
  logger(LogLevel.ERROR, message, ...args);
}

const logDebug = (message: string, ...args: unknown[]) => {
  logger(LogLevel.DEBUG, message, ...args);
}

export const setLogLevel = (level: LogLevel): void => {
  defaultLogger.level = level;
};

export type LogHandler = (level: LogLevel, message: string, ...args: unknown[]) => void;
export const setLogger = (handler: LogHandler): void => {
  logger = handler;
};

class EUser extends Error { constructor(s: string) { super(s); } }
class EWait extends Error { constructor(s: string) { super(s); } }
class ERetry extends Error { constructor(s: string) { super(s); } }

class ErrorHandler {
  public last: Error;
  constructor() { this.last = new Error(); }

  async error(msg: string, error: any) {
    if (error instanceof Error) this.last = error;
    if (error instanceof EWait) {
      logError(`server error. will wait before retry: ${msg} ${error}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else if (error instanceof ERetry) {
      logError(`server error. will retry now: ${msg} ${error}`);
    } else if (error instanceof EUser) {
      logError(`user error. will not retry: ${msg} ${error}`);
      throw error;
    } else {
      logError(`${msg} ${error}`);
    }
  }
}

export type JsonValue = ReturnType<typeof JSON.parse>;
export type Formatter<T> = (row: JsonValue[]) => T;
type DefaultType = { [key: string]: JsonValue };

// Alias fetch's request and response
// so that we can use the words: Request, Response
const FetchRequest = Request;
type FetchRequest = globalThis.Request;
type FetchResponse = globalThis.Response;

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
 *   query: 'SELECT "from", "to", value FROM transfer',
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   formatRow: (row) => ({
 *     from: row[0] as string,
 *     to: row[1] as string,
 *     value: row[2] as string
 *   })
 * }
 */
export type Request<T> = {
  /** Optional AbortSignal. Use this to cancel the request. */
  abortSignal?: AbortSignal;
  /** Optional number of attempts to retry the request. */
  retryAttempts?: number,
  /** Optional custom API URL. Defaults to https://api.indexsupply.net */
  apiUrl?: string;
  /** Optional API key for authentication. Unauthenticated requests limited to 5 per minute */
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

/**
 * Constructs the API URL with query parameters
 * @template T The type parameter for the request
 * @param path - The API endpoint path
 * @param request - The request configuration
 * @returns Formatted URL string ready to use with fetch()
 */
async function url<T>(
  path: string,
  request: Request<T> & { startBlock?: startBlock },
): Promise<string> {
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
  if (request.startBlock) {
    logDebug("calling user's startBlock function");
    const startBlock = await request.startBlock();
    logDebug(`user's startBlock: ${startBlock.toString()}`);
    params.append("block_height", startBlock.toString());
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


function parseResponse<T>(parsed: any, formatRow?: Formatter<T>): Response<T> {
  if (parsed.result.length === 0) {
    return { blockNumber: parsed.block_height, result: [] };
  }
  const result = parsed.result[0];
  if (result.length === 0) {
    return { blockNumber: parsed.block_height, result: [] };
  }
  const columnNames = result.shift();
  return {
    blockNumber: parsed.block_height,
    result: result.map(formatRow || defaultFormatRow(columnNames)),
  };
}

async function sendRequest(
  request: FetchRequest,
  signal?: AbortSignal
): Promise<FetchResponse> {
  logDebug(`sending request to ${request.url}`);
  let response: FetchResponse;
  try {
    response = await fetch(request, {
      signal,
      headers: { "User-Agent": `indexsupply.js/${userAgentVersion}` }
    });
  } catch (e) {
    throw new EWait(`fetch error ${e}`);
  }
  logDebug(`received ${response.status} response. content-length: ${response.headers.get("content-length")}`);
  if ((BigInt(response.status) / 100n) === 2n) {
    return response;
  } else if (response.status === 408) {
    throw new ERetry("timeout");
  } else if (response.status === 429) {
    throw new EWait("too many requests");
  } else if (response.status === 404) {
    throw new EUser(`not found ${request.url}`);
  } else if ((BigInt(response.status) / 100n) === 4n) {
    let errorMessage = await response.text();
    try {
      errorMessage = JSON.parse(errorMessage)["message"];
    } finally {
      throw new EUser(errorMessage);
    }
  } else {
    const responseBody = await response.text();
    throw new EWait(`${response.status} ${responseBody}`);
  }
}

/**
 * Executes a query against the API and returns formatted results
 * @template T The type of the formatted results
 * @param request - The request data
 * @returns Promise containing the block number and formatted results
 * @throws Error if the API response is invalid or unexpected
 * @see {@link https://www.indexsupply.net/docs#get-query GET /query API documentation}
 * @see {@link https://www.indexsupply.net/docs#queries Query types}
 * @example
 * // Basic usage with default formatting
 * const result = await query({
 *   chainId: 1n,
 *   query: 'SELECT "from", "to", value FROM transfer LIMIT 1',
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"]
 * });
 *
 * // With custom type and formatting
 * interface Transfer { from: string; to: string; value: string }
 * const transfers = await query<Transfer>({
 *   chainId: 1n,
 *   query: 'SELECT "from", "to", value FROM transfer LIMIT 1',
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 *   formatRow: (row) => ({
 *     from: row[0] as string,
 *     to: row[1] as string,
 *     value: row[2] as string
 *   })
 * });
 */
export async function query<T = DefaultType>(userRequest: Request<T>): Promise<Response<T>> {
  const handle = new ErrorHandler();
  for (let attempt = 0; attempt < (userRequest.retryAttempts ?? 5); attempt++) {
    try {
      const response = await sendRequest(new FetchRequest(await url("query", userRequest)));
      return parseResponse(await response.json(), userRequest.formatRow);
    } catch (e) {
      await handle.error("query", e);
    }
  }
  throw handle.last;
}

type Stream = ReadableStreamDefaultReader<Uint8Array>;

async function* readStream(reader: Stream): AsyncGenerator<JsonValue> {
  const decoder = new TextDecoder("utf-8");
  while (true) {
    const { value, done } = await reader.read();
    logDebug(`read ${value?.length} bytes from stream. done: ${done}`);
    if (done) return;
    let payload = decoder.decode(value);
    logDebug(String.raw`read ${payload}`);
    if (payload.startsWith("data: ")) {
      payload = payload.substring(6).trimEnd();
    } else {
      logDebug(`'data: ' missing from stream payload: ${payload}`);
      continue;
    }
    yield payload;
  }
}

/**
* `queryLive` will call `startBlock` each time a new Live Query connection to
the server is established. If the connection is restarted
then `queryLive` will automatically restablish the connection
and will call `startBlock` again to ensure we resume at the correct block height.
*/
export type startBlock = () => Promise<bigint>;

/**
 * Creates a live query connection that yields results as the API indexes new blocks
 * @template T The type of the formatted results
 * @param userRequest - The request configuration with optional starting block number
 * @param userRequest.startBlock - When provided, this function will be
 used as the starting block height for the query. It is common to save the
 latest block processed in a database (using your database's transaction system)
 * @yields Response objects containing block numbers and formatted results
 * @throws Error if the API response is invalid or unexpected
 * @see {@link https://www.indexsupply.net/docs#get-query-live GET /query-live API documentation}
 * @see {@link https://www.indexsupply.net/docs#reorgs Chain reorganization handling}
 * @example
 * // Basic usage with default formatting
 * for await (const response of queryLive({
 *   chainId: 1n,
 *   startBlock: async () => (latest + 1n),
 *   query: 'SELECT "from", "to", value FROM transfer',
 *   eventSignatures: ["Transfer(address indexed from, address indexed to, uint256 value)"],
 * })) {
 *   console.log(response.blockNumber, response.result);
 * }
 *
 * // With custom type and formatting
 * interface Transfer { from: string; to: string; value: string }
 * for await (const response of queryLive<Transfer>({
 *   chainId: 1n,
 *   query: 'SELECT "from", "to", value FROM transfer',
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
  userRequest: Request<T> & {
    startBlock?: startBlock;
  },
): AsyncGenerator<Response<T>, void, unknown> {
  let userRequestedAbort = false;
  userRequest.abortSignal?.addEventListener("abort", () => {
    logDebug("live query aborted")
    userRequestedAbort = true;
  });
  const handle = new ErrorHandler();
  for (let attempt = 0; attempt < (userRequest.retryAttempts ?? 50); attempt++) {
    try {
      let request = new FetchRequest(await url("query-live", userRequest));
      let response = await sendRequest(request, userRequest.abortSignal);
      const reader = response.body!.getReader() as Stream;
      for await (const payload of readStream(reader)) {
        let parsed = JSON.parse(payload);
        if (parsed.error === "user") {
          throw new EUser(parsed.message);
        } else if (parsed.error === "server") {
          throw new EWait(parsed.error.server);
        } else {
          yield parseResponse(parsed, userRequest.formatRow);
          attempt = 0;
        }
      }
    } catch (e) {
      if (userRequestedAbort) return;
      await handle.error("query-live", e);
    }
  }
  throw handle.last;
}

export const chainStartTimes: Record<number, { startTime: number, rate: number }> = {
  8453: { startTime: 1686789347, rate: 2 },
  84532: { startTime: 1695768288, rate: 2 },
  7777777: { startTime: 1686693839, rate: 2 },
};

export function guessBlockTime(chain: number, blockNum: number): Date {
  const config = chainStartTimes[chain];
  if (config === undefined) {
    throw new Error(`Chain ${chain} missing from chainStartTimes. Unable to guess timestamp.`);
  }
  return new Date((config.startTime + (blockNum * config.rate)) * 1000);
}
