# sqlapi.js

A Typescript wrapper for Index Supply Co's SQL API.

## Usage


### Single Query

Make a one-time query to get historical data:

```typescript
const { blockNumber, result } = await querySingle({
  chainId: 8453,
  query: 'select from, to, value from transfer',
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
const liveQuery = querySingleLive({
  chainId: 8453,
  query: 'select from, to, value from transfer',
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
  blockNumber: 1234567, // Optional: start from specific block
})

for await (const { blockNumber, result } of liveQuery) {
  console.log(`New data at block ${blockNumber}:`, result)
}
```

<!--

### Sync Client

```typescript
const client = new SyncClientSingle({
  chainId: 8453,
  query: 'select from, to, value from transfer',
  eventSignatures: ['Transfer(address indexed from, address indexed to, uint256 value)'],
  formatRow: ([from, to, value]) => ({
    from: from as Address,
    to: to as Address,
    value: BigInt(value),
  }),
  getProgress: async () => { return await db.query('select max(block_number) from progress') },
  saveProgress: async (blockNumber, newData) => {
    await db.transaction(async (tx) => {
      await tx.query('insert into progress (block_number) values ($1)', [blockNumber])
      for (const { from, to, value } of newData) {
        await tx.query('insert into transfers (from, to, value) values ($1, $2, $3)', [from, to, value])
      }
    })
  },
})

await client.sync()
```
-->
