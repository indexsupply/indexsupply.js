import { querySingle, querySingleLive, querySingleLiveRaw, type SupportedChainId } from "./api"

export type RowFormatter<FormattedRow> = (values: string[]) => FormattedRow
export type GetProgressFunction = () => Promise<number>
export type SaveProgressFunction<Data> = (blockNumber: number, data: Data) => Promise<void>

export type SyncClientOptions<FormattedRow> = {
  chainId: SupportedChainId
  query: string
  eventSignatures: string[]

  formatRow: RowFormatter<FormattedRow>
  getProgress: GetProgressFunction
  saveProgress: SaveProgressFunction<FormattedRow[]>
}

/**
 * Sync a single SQL query to your application.
 * 
 * This is commonly used to sync into a database like Postgres.
 * 
 * Example usage:
 *
 *     TODO
 */
export class SyncClientSingle<FormattedRow> {
  public readonly chainId: SupportedChainId;
  public readonly query: string;
  public readonly eventSignatures: ReadonlyArray<string>;

  public formatRow: RowFormatter<FormattedRow>;
  public getProgress: GetProgressFunction;
  public saveProgress: SaveProgressFunction<FormattedRow[]>;

  constructor({
    chainId,
    query,
    eventSignatures,
    formatRow,
    getProgress,
    saveProgress,
  }: SyncClientOptions<FormattedRow>) {
    this.chainId = chainId;
    this.query = query;
    this.eventSignatures = eventSignatures;
    this.formatRow = formatRow;
    this.getProgress = getProgress;
    this.saveProgress = saveProgress;
  }

  async sync(): Promise<void> {
    // This is tricky to make an API that uses the single GET endpoint combined with
    // the live endpoint because we need to filter from block >= start block. Unless
    // the SQL API provides this as a header option, we can't be sure we're modifying
    // the user's SQL query without making this library significantly more complicated by
    // parsing it in JS.

    const startBlock = await this.getProgress()

    const liveResults = querySingleLive({
      chainId: this.chainId,
      query: this.query,
      eventSignatures: this.eventSignatures,
      blockNumber: startBlock,
      formatRow: this.formatRow,
    })

    let lastBlock = startBlock

    for await (const { blockNumber, result } of liveResults) {
      // if (blockNumber < lastBlock) {
      //  // TODO: Handle reorgs
      //  // We can approach this a couple ways:
      //  // 1. Drop whole state, start over.
      //  // 2. Delete invalid state, fill in state we're missing.
      //  // 3. ?
      //  // throw new Error('reorg')
      // }

      await this.saveProgress(blockNumber, result)
      lastBlock = blockNumber
    }
  }
}