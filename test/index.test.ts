import test from "node:test";
import assert from 'node:assert/strict';
import { query, queryLive, setLogLevel, LogLevel } from "../src/index"

setLogLevel(LogLevel.DEBUG);

test("query", async (t) => {
  await t.test("should work", async () => {
    const { rows } = await query({
      apiKey: process.env["IS_KEY"],
      chainId: 8453n,
      signatures: [
        "Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      query: `
        select block_num, log_idx, "from", "to", "value"
        from transfer
        where block_num = 2397613
        and log_idx = 1997
      `,
    });
    assert.deepStrictEqual(rows, [{
      block_num: 2397613,
      log_idx: 1997,
      from: "0x8ab39456f5c35910f30c391311806c06310b49fc",
      to: "0x4cf76043b3f97ba06917cbd90f9e3a2aac1b306e",
      value: "71817150413",
    }]);
  });
  await t.test("should handle many signatures", async () => {
    const { rows } = await query({
      apiKey: process.env["IS_KEY"],
      chainId: 8453n,
      signatures: ["Foo(uint a)", "Bar(uint b)"],
      query: "select a, b from foo, bar",
    });
    assert.deepStrictEqual(rows, []);
  });
  await t.test("should return user error for invalid sql", async () => {
    await assert.rejects(query({
      apiKey: process.env["IS_KEY"],
      chainId: 8453n,
      signatures: ["Foo(uint a)"],
      query: "select log_idx, bar from foo",
    }), { message: `column "bar" does not exist` });
  });
});

test("queryLive", async (t) => {
  await t.test("should work", async () => {
    const controller = new AbortController();
    const query = queryLive({
      apiKey: process.env["IS_KEY"],
      abortSignal: controller.signal,
      startBlock: async () => 2397612n,
      chainId: 8453n,
      signatures: [
        "Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      query: `
        select block_num, log_idx, "from", "to", "value"
        from transfer
        where block_num = 2397613
        and log_idx = 1997
      `,
    });
    for await (const { rows } of query) {
      assert.deepStrictEqual(rows, [{
        block_num: 2397613,
        log_idx: 1997,
        from: "0x8ab39456f5c35910f30c391311806c06310b49fc",
        to: "0x4cf76043b3f97ba06917cbd90f9e3a2aac1b306e",
        value: "71817150413",
      }]);
      controller.abort();
    }
  });

  await t.test("should return user error for invalid sql", async () => {
    const query = queryLive({
      apiKey: process.env["IS_KEY"],
      abortSignal: AbortSignal.timeout(1000),
      startBlock: async () => 2397612n,
      chainId: 8453n,
      signatures: ["Foo(uint a)"],
      query: "select log_idx, bar from foo",
    });
    await assert.rejects(query.next(), { message: 'column "bar" does not exist' });
  });

  await t.test("should buffer large responses", async () => {
    const controller = new AbortController();
    const query = queryLive({
      apiKey: process.env["IS_KEY"],
      abortSignal: controller.signal,
      startBlock: async () => 0n,
      chainId: 8453n,
      signatures: [],
      query: "select tx_hash from logs order by block_num desc limit 10000",
    });
    for await (const { rows } of query) {
      controller.abort();
      assert(rows.length == 10000);
    }
  });
});
