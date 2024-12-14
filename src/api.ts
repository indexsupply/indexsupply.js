import fetch from "cross-fetch";
import EventSource from 'eventsource-platform-specific';

const apiUrl = 'https://api.indexsupply.net'

type APISchemaType = string[]
type APIQueryRow = string[]
type APIResultType = [] | [APISchemaType, ...APIQueryRow[]]
type APIDataFormat = {
  block_height: number
  result: APIResultType[]
}

export type SupportedChainId = number

export type QuerySingleRawOptions = {
  apiKey?: string,
  chainId: SupportedChainId
  query: string
  eventSignatures: ReadonlyArray<string>
}

export type QuerySingleData<FormattedRow> = {
  blockNumber: number
  result: FormattedRow[]
}

export type QuerySingleRawFunction = typeof querySingleRaw

export async function querySingleRaw(options: QuerySingleRawOptions): Promise<QuerySingleData<string[]>> {
  const params = new URLSearchParams();
  params.append("chain", options.chainId.toString());
  params.append("query", options.query);
  params.append("event_signatures", options.eventSignatures.join(','));
  if (options.apiKey) {
    params.append("api-key", options.apiKey.toString());
  }

  const response = await fetch(`${apiUrl}/query?${params.toString()}`)
  if (response.status !== 200) {
    throw new Error(`Invalid API response: Status ${response.status}`)
  }
  const data = await response.json() as APIDataFormat;

  if (data.result.length === 0) {
    return { blockNumber: data.block_height, result: [] }
  }

  if (data.result.length !== 1) {
    throw new Error(`Expected 1 result, got ${data.result.length}`)
  }

  const result = data.result[0]

  if (result.length === 0) {
    return { blockNumber: data.block_height, result: [] }
  }

  return {
    blockNumber: data.block_height,
    result: result.slice(1),
  }
}

export type QuerySingleLiveRawFunction = typeof querySingleLiveRaw

export type QuerySingleOptions<FormattedRow> = QuerySingleRawOptions & {
  formatRow: (row: string[]) => FormattedRow
}

export async function querySingle<FormattedRow>(
  { formatRow, ...options }: QuerySingleOptions<FormattedRow>
): Promise<QuerySingleData<FormattedRow>> {
  const { blockNumber, result } = await querySingleRaw(options)

  return {
    blockNumber,
    result: result.map(formatRow)
  }
}

export type QuerySingleLiveRawOptions = {
  apiKey?: string
  chainId: SupportedChainId
  query: string
  eventSignatures: ReadonlyArray<string>
  blockNumber?: number
}

export async function* querySingleLiveRaw(options: QuerySingleLiveRawOptions): AsyncGenerator<QuerySingleData<string[]>> {
  const params = new URLSearchParams();
  params.append("chain", options.chainId.toString());
  params.append("query", options.query);
  params.append("event_signatures", options.eventSignatures.join(','));
  if (options.apiKey) {
    params.append("api-key", options.apiKey.toString());
  }
  if (options.blockNumber) {
    params.append('block_height', options.blockNumber.toString())
  }
  const url = new URL(`${apiUrl}/query-live?${params}`)

  const eventSource = new EventSource(url.toString())

  try {
    while (true) {
      const event = await new Promise<MessageEvent>((resolve, reject) => {
        eventSource.onmessage = (event) => {
          resolve(event)
        }

        eventSource.onerror = (error) => {
          reject(error)
        }
      })

      const data = JSON.parse(event.data) as APIDataFormat
      if (data.result.length === 0) {
        yield { blockNumber: data.block_height, result: [] }
        continue
      }

      if (data.result.length !== 1) {
        throw new Error(`Expected 1 result, got ${data.result.length}`)
      }

      const result = data.result[0]
      if (result.length === 0) {
        yield { blockNumber: data.block_height, result: [] }
        continue
      }

      yield {
        blockNumber: data.block_height,
        result: result.slice(1),
      }
    }
  } finally {
    eventSource.close()
  }
}

export type QuerySingleLiveOptions<FormattedRow> = QuerySingleLiveRawOptions & {
  formatRow: (row: string[]) => FormattedRow
}

export async function* querySingleLive<FormattedRow>(
  { formatRow, ...options }: QuerySingleLiveOptions<FormattedRow>
): AsyncGenerator<QuerySingleData<FormattedRow>> {
  for await (const { blockNumber, result } of querySingleLiveRaw(options)) {
    yield {
      blockNumber,
      result: result.map(formatRow),
    }
  }
}
