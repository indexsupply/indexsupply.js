import fetch from "cross-fetch";
import EventSource from 'eventsource'

const indexerUrl = 'https://api.indexsupply.net'

type APISchemaType = string[]
type APIQueryRow = string[]
type APIResultType = [] | [APISchemaType, ...APIQueryRow[]] 
type APIDataFormat = {
  block_height: number
  result: APIResultType[]
}

// TODO(mal1->ryan): should we put the supported chains in the types so you dont need to consult the docs?
// ex: 1 | 10 | 8453 | 84532
export type SupportedChainId = number

export type QuerySingleRawOptions = {
  chainId: SupportedChainId
  query: string
  eventSignatures: ReadonlyArray<string>
  // TODO: is this supported on single query, or just live query?
  // blockNumber?: number
}

export type QuerySingleData<FormattedRow> = {
  blockNumber: number
  result: FormattedRow[]
}

export type QuerySingleRawFunction = typeof querySingleRaw

export async function querySingleRaw(options: QuerySingleRawOptions): Promise<QuerySingleData<string[]>> {
  const params = new URLSearchParams();
  params.append("chain", options.chainId.toString());
  // if (options.blockNumber !== undefined) {
  //   params.append("block_height", options.blockNumber.toString());
  // }
  params.append("query", options.query);

  // TODO(mal1->ryan): Check if this is how we're supposed to pass multiple signatures
  params.append("event_signatures", options.eventSignatures.join(','));

  const response = await fetch(`${indexerUrl}/query?${params.toString()}`)
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
  chainId: SupportedChainId
  query: string
  eventSignatures: ReadonlyArray<string>
  blockNumber?: number
}

export async function* querySingleLiveRaw(options: QuerySingleLiveRawOptions): AsyncGenerator<QuerySingleData<string[]>> {
  const params = new URLSearchParams({
    chain: options.chainId.toString(),
    query: options.query,
    event_signatures: options.eventSignatures.join(','),
  })
  if (options.blockNumber) {
    params.append('block_height', options.blockNumber.toString())
  }
  const url = new URL(`${indexerUrl}/query-live?${params}`)

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