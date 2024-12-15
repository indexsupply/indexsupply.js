import fetch from "cross-fetch";
import EventSource from "eventsource-platform-specific";

export type Response<T> = {
  blockNumber: bigint;
  result: T[];
};

type JsonValue = ReturnType<typeof JSON.parse>;
type DefaultType = { [key: string]: JsonValue };
type Formatter<T> = (row: JsonValue[]) => T;

export type Request<T> = {
  apiUrl?: string;
  apiKey?: string;
  chainId: bigint;
  query: string;
  eventSignatures?: ReadonlyArray<string>;
  formatRow?: T extends DefaultType ? undefined | Formatter<T> : Formatter<T>;
};

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

export async function query<T = DefaultType>(
  request: Request<T>,
): Promise<Response<T>> {
  const resp = await fetch(url("query", request));
  if (resp.status !== 200) {
    throw new Error(`Invalid API response: Status ${resp.status}`);
  }
  const data = await resp.json();
  if (data.result.length === 0) {
    return { blockNumber: data.block_height, result: [] };
  }
  if (data.result.length !== 1) {
    throw new Error(`Expected 1 result, got ${data.result.length}`);
  }
  const rows = data.result[0];
  if (rows.length === 0) {
    return { blockNumber: data.blockHeight, result: [] };
  }
  const columnNames = rows.shift();
  const formatRow = request.formatRow || defaultFormatRow(columnNames);
  return {
    blockNumber: data.block_height,
    result: rows.map(formatRow),
  };
}

export async function* queryLive<T = DefaultType>(
  request: Request<T> & { blockNumber?: bigint },
): AsyncGenerator<Response<T>> {
  const eventSource = new EventSource(url("query-live", request));
  try {
    while (true) {
      const event = await new Promise<MessageEvent>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          resolve(event);
        };
        eventSource.onerror = (error) => {
          reject(error);
        };
      });
      const data = JSON.parse(event.data);
      if (data.result.length === 0) {
        yield { blockNumber: data.block_height, result: [] };
        continue;
      }
      if (data.result.length !== 1) {
        throw new Error(`Expected 1 result, got ${data.result.length}`);
      }
      let result = data.result[0];
      if (result.length === 0) {
        yield { blockNumber: data.block_height, result: [] };
        continue;
      }
      const columnNames = result.shift();
      const formatRow = request.formatRow || defaultFormatRow(columnNames);
      yield {
        blockNumber: data.block_height,
        result: result.map(formatRow),
      };
    }
  } finally {
    eventSource.close();
  }
}
