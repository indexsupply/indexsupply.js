import { querySingleLive } from '../src/index'

type Address = `0x${string}`

const liveQuery = querySingleLive({
  chainId: 8453,
  eventSignatures: ['Transfer(address indexed f, address indexed t, uint256 v)'],
  query: 'select f, t, v from transfer limit 20',
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  })
})

for await (const { blockNumber, result } of liveQuery) {
  console.log(`New data at block ${blockNumber}:`, result)
}