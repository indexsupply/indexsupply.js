import { queryLive } from "../src/index";

type Hex = `0x${string}`;

type Transfer = {
  tx: Hex;
  block: bigint;
};

const query = queryLive({
  chainId: 8453n,
  eventSignatures: [
    "Transfer(address indexed from, address indexed to, uint256 v)",
  ],
  query: "select tx_hash, block_num from transfer limit 1",
  formatRow: ([tx_hash, block_num]) => {
    return {
      tx: tx_hash as Hex,
      block: BigInt(block_num),
    };
  },
});

for await (const { blockNumber, result } of query) {
  console.log(result);
}
