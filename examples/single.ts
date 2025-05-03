import { Cursor, query, setLogLevel, LogLevel } from "../src/index.ts";
setLogLevel(LogLevel.DEBUG);
let { cursor, rows } = await query({
  cursor: new Cursor([[8453n, 29728143n]]),
  signatures: [
    "Transfer(address indexed from, address indexed to, uint256 value)",
  ],
  query:
    'select block_num, log_idx, "from", "to", "value" from transfer limit 5',
});

console.log({ cursor: cursor });
rows.forEach((r) => console.log(r.block_num));
