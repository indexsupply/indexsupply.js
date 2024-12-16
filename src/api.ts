import { createEventSource } from "eventsource-client";

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
