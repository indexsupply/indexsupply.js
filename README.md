# indexsupply.js

A Typescript wrapper for Index Supply's API.

## Usage

This package is available on [NPM](https://www.npmjs.com/package/@indexsupply/indexsupply.js).

```
npm i @indexsupply/indexsupply.js
```

### Single Query

Make a one-time query to get historical data:

```typescript
import { query } from "@indexsupply/indexsupply.js";

const { blockNumber, result } = await query({
  apiKey: "face",
  chainId: 8453,
  query: 'select "from", "to", value from transfer limit 1',
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
})

console.log(`Block ${blockNumber}:`, result)
```

### Live Query

Subscribe to new data as it arrives:

```typescript
import { queryLive } from "@indexsupply/indexsupply.js";

const q = queryLive({
  apiKey: "face",
  chainId: 8453,
  startBlock: async () => 1234567n,
  query: 'select "from", "to", value from transfer limit 1',
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
})

for await (const { blockNumber, result } of q) {
  console.log(`New data at block ${blockNumber}:`, result)
}
```

`queryLive` will call `startBlock` each time a new connection to the server is established. If the connection is restarted
then `queryLive` will automatically restablish the connection and will call `startBlock` to ensure we resume at the correct
block height.

A common pattern for `startBlock` is to use your database to figure out the last block you've processed. For example:

```javascript
const liveQuery = queryLive({
  startBlock: async () => {
    const rows = await pg.query("select max(block_num) block_num from my_table");
    return BigInt(rows[0].block_num);
  },
  ...
});
for await (const { blockNumber, result } of liveQuery) {
  await pg.query("insert into my_table(block_num, ...) values (blockNumber, ...)");
}
```

See the [examples/save-to-postgres](examples/save-to-postgres/src/index.ts) source for a complete example.


### Using Hosted Package in the Browser

See [this page](https://indexsupply.github.io/indexsupply.js/examples/index.html) for a working demonstration.

```html
<html>
    <head>
        <script src="https://static.indexsupply.net/indexsupply.js" type="module"></script>
    </head>
    <script type="module">
        import { query } from "https://static.indexsupply.net/indexsupply.js";
        const { blockNumber, result } = await query({
            chainId: 8453n,
            eventSignatures: [],
            query: "select block_num from logs limit 1",
        });
        document.querySelector("body pre").textContent = JSON.stringify({ blockNumber, result });
    </script>
    <body>
        <pre></pre>
    </body>
</html>
```

## Local Development Setup

```
% node --version
v22.12.0

% npm run example

> @indexsupply/indexsupply.js@0.0.7 example
> npx tsx examples/live.ts

{
  tx: '0x3f6664da84f4cc2f3bbfd5b9968ea0c06c4d89b682c920ee240f13d9824cbabf',
  block: 23815441n
}
```
