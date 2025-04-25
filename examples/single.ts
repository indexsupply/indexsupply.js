import { query } from "../src/index.ts";

type Address = `0x${string}`;

const { blockNumber, result } = await query({
  chainId: 8453n,
  signatures: [
    "Transfer(address indexed from, address indexed to, uint256 value)",
  ],
  query:
    'select block_num, log_idx, "from", "to", "value" from transfer limit 5',
});

console.log(`current block: ${blockNumber}`);
result.forEach((r) => console.log(r.block_num));
