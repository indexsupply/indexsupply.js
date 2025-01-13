import { queryLive, setLogLevel, LogLevel } from "../src/index.ts";

setLogLevel(LogLevel.DEBUG);

type Hex = `0x${string}`;

type Transfer = {
  tx: Hex;
  block: bigint;
};

const controller = new AbortController();
setTimeout(() => {
  controller.abort();
}, 60_000);

let latest = 23815440n;

const query = queryLive({
  abortSignal: controller.signal,
  startBlock: async () => (latest + 1n),
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

for await (const { result } of query) {
  result.forEach((row) => {
    if (row.block > latest) {
      latest = row.block;
    }
    console.log(row);
  });
}
