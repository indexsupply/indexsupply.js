import test from "node:test";
import assert from 'node:assert/strict';
import { guessBlockTime, query, queryLive } from "../src/index"

test("query", async (t) => {
  await t.test("should work", async () => {
    const { result } = await query({
      chainId: 8453n,
      eventSignatures: [
        "Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      query: `
        select block_num, log_idx, "from", "to", "value"
        from transfer
        where block_num = 2397613
        and log_idx = 1997
      `,
    });
    assert.deepStrictEqual(result, [{
      block_num: 2397613,
      log_idx: 1997,
      from: "0x8ab39456f5c35910f30c391311806c06310b49fc",
      to: "0x4cf76043b3f97ba06917cbd90f9e3a2aac1b306e",
      value: "71817150413",
    }]);
  });
  await t.test("should return user error for invalid sql", async () => {
    await assert.rejects(query({
      chainId: 8453n,
      eventSignatures: ["Foo(uint a)"],
      query: "select log_idx, bar from foo",
    }), { message: `column "bar" does not exist` });
  });
});

test("queryLive", async (t) => {
  await t.test("should work", async () => {
    const controller = new AbortController();
    const query = queryLive({
      abortSignal: controller.signal,
      startBlock: async () => 2397612n,
      chainId: 8453n,
      eventSignatures: [
        "Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      query: `
        select block_num, log_idx, "from", "to", "value"
        from transfer
        where block_num = 2397613
        and log_idx = 1997
      `,
    });
    for await (const { result } of query) {
      assert.deepStrictEqual(result, [{
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
      abortSignal: AbortSignal.timeout(1000),
      startBlock: async () => 2397612n,
      chainId: 8453n,
      eventSignatures: ["Foo(uint a)"],
      query: "select log_idx, bar from foo",
    });
    await assert.rejects(query.next(), { message: 'column "bar" does not exist' });
  });
});

test("blockTimestamp", (t) => {
  t.test("valid chain", () => {
    assert.equal(guessBlockTime(8453, 26041515).toISOString(), "2025-02-06T20:06:17.000Z")
  });
});
