# indexsupply.js

A Typescript wrapper for Index Supply's API.

## Usage


### Single Query

Make a one-time query to get historical data:

```typescript
const { blockNumber, result } = await query({
  apiKey: "face",
  chainId: 8453,
  query: 'select "from", "to", value from transfer',
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
const liveQuery = queryLive({
  apiKey: "face",
  chainId: 8453,
  blockNumber: 1234567, // Optional: start from specific block
  query: 'select from, to, value from transfer',
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
})

for await (const { blockNumber, result } of liveQuery) {
  console.log(`New data at block ${blockNumber}:`, result)
}
```

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
