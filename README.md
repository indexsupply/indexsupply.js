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

## Installation and Development Workflow

### Installation

1. **Install Dependencies**

    Use Bun to install dependencies quickly:

        bun install

2. **Build the Project**

    We use esbuild to build the project. Compile the project into the `dist` folder:

        bun run build

3. **Testing**

    Run tests using Bun to ensure everything is working as expected:

        bun test
