// generated by: scripts/replace-version.js
const userAgentVersion = "0.0.14";

export type Hex = `0x${string}`;

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
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.floor(Math.random() * 2000)));
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
  }

  let errorMessage = await response.text();
  errorMessage = JSON.parse(errorMessage)?.message ?? errorMessage;

  if (response.status === 408) {
    throw new ERetry(errorMessage);
  } else if (response.status === 429) {
    throw new EWait(errorMessage);
  } else if (response.status === 404) {
    throw new EUser(`not found ${request.url}`);
  } else if ((BigInt(response.status) / 100n) === 4n) {
    throw new EUser(errorMessage);
  } else {
    throw new EWait(`${response.status} ${errorMessage}`);
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
  let payload = new String();
  while (true) {
    const { value, done } = await reader.read();
    logDebug(`read ${value?.length} bytes from stream. done: ${done}`);
    if (done) return;
    let decoded = decoder.decode(value);
    logDebug(`read ${decoded}`);
    payload += decoded;
    if (payload.endsWith("\n\n")) {
      let complete = payload.replace(/^data:\s*/, '').trimEnd();
      yield complete;
      payload = new String();
    }
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

// These are defined so that child namespaces can
// call query and queryLive.
const superQuery = query;
const superQueryLive = queryLive;

/**
 * For details on how the Daimo Pay API works, please see their documentation at:
 * https://paydocs.daimo.com/payment-links
 */
export namespace Daimo {
  function b58int(input: string): bigint {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return [...input].reverse().reduce((acc, char, pos) => {
      return acc + BigInt(alphabet.indexOf(char)) * (58n ** BigInt(pos));
    }, 0n);
  }

  /**
  * When the end-user has completed the Daimo Payment
  * and IntentFinished event is emitted. The query and queryLive
  * functions accept an id, which is returned
  */
  export type IntentFinished = {
    blockNumber: bigint,
    transactionHash: Hex,
    success: boolean,
  };

  export const intentFinishedSignature = `
    IntentFinished(
      address indexed intentAddr,
      address indexed destinationAddr,
      bool indexed success,
      (
        uint256 toChainId,
        (address token, uint256 amount)[] bridgeTokenOutOptions,
        (address token, uint256 amount) finalCallToken,
        (address to, uint256 value, bytes data) finalCall,
        address escrow,
        address refundAddress,
        uint256 nonce
      ) intent
    )
  `;

  export const intentFinishedQuery = `select block_num, tx_hash, success from intentfinished`;

  function addPredicates<T>(userRequest: IntentFinishedRequest<T>) {
    const predicates = [];
    if (userRequest.destinationAddr) {
      predicates.push(`destinationAddr = ${userRequest.destinationAddr}`);
    }
    if (userRequest.id) {
      predicates.push(`intent->>'nonce' = '${b58int(userRequest.id)}'`);
    }
    if (predicates.length > 0) {
      userRequest.query += ` where ${predicates.join(" and ")}`;
    }
  }

  /**
  * @param query is optional. When omitted a default query that selects: block_num, tx_hash, and success is supplied.
  * @param eventSignatures is optional. You may only want to change this if you want to supply
  * a query that does joins and therefore you need to supply multiple eventSignatures.
  */
  export type IntentFinishedRequest<T> =
    Omit<Request<T>, 'query' | 'eventSignatures'> &
    Partial<Pick<Request<T>, 'query' | 'eventSignatures'>> & {
      destinationAddr?: Hex,
      id?: string,
    };

  /**
  * Behaves similar to the root query function
  *
  * When a payment link is created via the Daimo API, their API returns
  * the URL that you will redirect your user towards and an id. The id is
  * base58 encoded. Use that id for this function to find the end-user's payment
  * transaction.
  * @param userRequest with default query and eventSignatures
  * @param userRequest.destinationAddr will be added as a predicate to the query
  * @param userRequest.id will be used to calculate an base58 decoded integer and used as a predicate to the query
  * @returns IntentFinished
  */
  export async function query<T = IntentFinished>(
    userRequest: IntentFinishedRequest<T>
  ): Promise<Response<T>> {
    const {
      eventSignatures = [intentFinishedSignature],
      query: sql = intentFinishedQuery,
      ...rest
    } = userRequest;
    const userRequestWithDefaults: Request<T> = {
      query: sql,
      eventSignatures,
      ...rest
    };
    addPredicates(userRequestWithDefaults);
    return superQuery(userRequestWithDefaults);
  }

  /**
   * Behaves similar to the root queryLive function
   *
   * When a payment link is created via the Daimo API, their API returns
   * the URL that you will redirect your user towards and an id. The id is
   * base58 encoded. Use that id for this function to find the end-user's payment
   * transaction.
   *
   * You can open a live query if you want to wait for the user's payment to complete
   * or you could provide your own userRequest.query and stream all payments to your
   * destination address.
   *
   * @param userRequest with default query and eventSignatures
   * @param userRequest.destinationAddr will be added as a predicate to the query
   * @param userRequest.id will be used to calculate an base58 decoded integer and used as a predicate to the query
   * @param userRequest.startBlock will start the live query at the specified block height
   * @returns IntentFinished
   */
  export async function* queryLive<T = IntentFinished>(
    userRequest: IntentFinishedRequest<T> & {
      startBlock?: startBlock;
    }
  ): AsyncGenerator<Response<T>, void, unknown> {
    const {
      eventSignatures = [intentFinishedSignature],
      query: sql = intentFinishedQuery,
      ...rest
    } = userRequest;
    const userRequestWithDefaults: Request<T> = {
      query: sql,
      eventSignatures,
      ...rest
    };
    addPredicates(userRequestWithDefaults);
    for await (const res of superQueryLive(userRequestWithDefaults)) {
      yield res
    }
  }
};
