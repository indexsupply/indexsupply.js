import { SyncClientSingle } from "../src/sync-client";

type Address = `0x${string}`

// This is not ready for production use.

const client = new SyncClientSingle({
  chainId: 8453,
  eventSignatures: ['Transfer(address indexed f, address indexed t, uint256 v)'],
  query: 'select f, t, v from transfer',
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
  getProgress: async () => {
    // fetch the latest block number from base scan rpc
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    })

    const json = await res.json() as {
      result: string
    }

    const blockHeight = parseInt(json.result, 16)
    console.log(blockHeight)

    return blockHeight - 5
  },
  saveProgress: async (blockNumber, data) => {
    console.log(blockNumber, data.length)
  },
})

setTimeout(() => process.exit(0), 10_000)
await client.sync()