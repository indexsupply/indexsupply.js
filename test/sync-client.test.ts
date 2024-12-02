import { describe, it, expect, mock, afterEach, beforeEach } from 'bun:test'
import { SyncClientSingle } from '../src/sync-client'
import { randomAddress } from './helpers'

type Address = `0x${string}`

describe('SyncClientSingle', () => {
  beforeEach(() => {
    mock.module('../src/api', () => ({
      querySingleLiveRaw: () => {
        throw new Error('Not expected to be called, mock in specific test')
      }
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  it('should save then exit after event stream ends', async () => {
    let currentBlock = 0
    let data: string[][][] = []

    mock.module('../src/api', () => ({
      querySingleLiveRaw: async function* () {
        yield {
          blockNumber: 1,
          result: [['a'], ['b']],
        }

        yield {
          blockNumber: 2,
          result: [['c'], ['d']],
        }
      }
    }))

    const client = new SyncClientSingle({
      chainId: 8453,
      query: '',
      eventSignatures: [''],
      formatRow: (row) => row,
      getProgress: async () => { return currentBlock },
      saveProgress: async (blockNumber, newData) => {
        currentBlock = blockNumber
        data.push(newData)
      },
    })

    expect(currentBlock).toBe(0)
    expect(data).toEqual([])

    await client.sync()

    expect(currentBlock).toBe(2)
    expect(data).toEqual([
      [['a'], ['b']],
      [['c'], ['d']],
    ])
  })

  it('should transform the rows using the transform row function', async () => {
    type Transfer = {
      from: Address
      to: Address
      value: bigint
    }

    let data: Transfer[] = []

    const exampleAddress = randomAddress()

    mock.module('../src/api', () => ({
      querySingleLiveRaw: async function* () {
        yield {
          blockNumber: 1,
          result: [
            ['0x0000000000000000000000000000000000000000', exampleAddress, '42'],
          ],
        }
      }
    }))

    const client = new SyncClientSingle({
      chainId: 8453,
      query: '',
      eventSignatures: [''],
      formatRow: ([from, to, value]) => ({
        from: from as Address,
        to: to as Address,
        value: BigInt(value),
      } as Transfer),
      getProgress: async () => { return 0 },
      saveProgress: async (_blockNumber, newData) => {
        data = data.concat(newData)
      },
    })

    expect(data).toEqual([])

    await client.sync()

    expect(data).toEqual([
      {
        from: '0x0000000000000000000000000000000000000000',
        to: exampleAddress,
        value: 42n
      }
    ])
  })

  // it('should throw an error during a reorg', async () => {
  //   mock.module('../src/api', () => ({
  //     querySingleLiveRaw: async function* () {
  //       yield {
  //         blockNumber: 1,
  //         result: [['a']],
  //       }

  //       yield {
  //         blockNumber: 2,
  //         result: [['b']],
  //       }

  //       yield {
  //         blockNumber: 1,
  //         result: [['b']],
  //       }
  //     }
  //   }))

  //   let currentBlock = 0

  //   const client = new SyncClientSingle({
  //     chainId: 8453,
  //     query: '',
  //     eventSignatures: [''],
  //     formatRow: (row) => row,
  //     getProgress: async () => { return currentBlock },
  //     saveProgress: async (blockNumber, _newData) => {
  //       currentBlock = blockNumber
  //     },
  //   })

  //   expect(() => client.sync()).toThrow('reorg')
  // })

  it('should error if `getProgress` errors', async () => {
    mock.module('../src/api', () => ({
      querySingleLiveRaw: async function* () { }
    }))

    const client = new SyncClientSingle({
      chainId: 8453,
      query: '',
      eventSignatures: [''],
      formatRow: (row) => row,
      getProgress: async () => {
        throw new Error('getProgress Error')
      },
      saveProgress: async () => { },
    })

    expect(() => client.sync()).toThrow('getProgress Error')
  })

  it('should error if the live query errors', async () => {
    mock.module('../src/api', () => ({
      querySingleLiveRaw: async function* () {
        throw new Error('querySingleLiveRaw Error')
      }
    }))

    const client = new SyncClientSingle({
      chainId: 8453,
      query: '',
      eventSignatures: [''],
      formatRow: (row) => row,
      getProgress: async () => { return 0 },
      saveProgress: async () => { },
    })

    expect(() => client.sync()).toThrow('querySingleLiveRaw Error')
  })

  it('should error if the transform function errors', async () => {
    mock.module('../src/api', () => ({
      querySingleLiveRaw: async function* () {
        yield {
          blockNumber: 1,
          result: [['a']],
        }
      }
    }))

    const client = new SyncClientSingle({
      chainId: 8453,
      query: '',
      eventSignatures: [''],
      formatRow: (_row) => {
        throw new Error('formatRow Error')
      },
      getProgress: async () => { return 0 },
      saveProgress: async () => { },
    })

    expect(() => client.sync()).toThrow('formatRow Error')
  })
})