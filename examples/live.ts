import { queryLive, setLogLevel, LogLevel } from "../src/index.ts";

setLogLevel(LogLevel.DEBUG);

type Hex = `0x${string}`;

const controller = new AbortController();
setTimeout(() => {
  controller.abort();
}, 60_000);

let latest = 29728979n;

const query = queryLive({
  abortSignal: controller.signal,
  startBlock: async () => (latest + 1n),
  chainId: 8453n,
  signatures: [
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

for await (const { rows } of query) {
  rows.forEach((row) => {
    if (row.block > latest) {
      latest = row.block;
    }
    console.log(row);
  });
}
