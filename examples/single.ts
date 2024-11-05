import type { Address } from 'viem'
import { querySingle } from '../src/index'

const result = await querySingle({
  chainId: 8453,
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  query: 'select from, to, value, address from transfer limit 5',
  formatRow: ([from, to, value, address]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
    address: address as Address,
  })
})

console.log(result)