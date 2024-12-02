import { querySingle } from '../src/index'

type Address = `0x${string}`

const result = await querySingle({
  chainId: 8453,
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  query: 'select "from", "to", "value" from transfer limit 5',
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  })
})

console.log(result)