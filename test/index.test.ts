import test from "node:test";
import assert from 'node:assert/strict';
import { Daimo, guessBlockTime, query, queryLive, setLogLevel, LogLevel } from "../src/index"

setLogLevel(LogLevel.DEBUG);

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
  await t.test("should handle many signatures", async () => {
    const { result } = await query({
      chainId: 8453n,
      eventSignatures: ["Foo(uint a)", "Bar(uint b)"],
      query: "select a, b from foo, bar",
    });
    assert.deepStrictEqual(result, []);
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

  await t.test("should buffer large responses", async () => {
    const controller = new AbortController();
    const query = queryLive({
      abortSignal: controller.signal,
      startBlock: async () => 0n,
      chainId: 8453n,
      eventSignatures: [],
      query: "select tx_hash from logs order by block_num desc limit 10000",
    });
    for await (const { result } of query) {
      controller.abort();
      assert(result.length == 10000);
    }
  });
});

test("blockTimestamp", (t) => {
  t.test("valid chain", () => {
    assert.equal(guessBlockTime(8453, 26041515).toISOString(), "2025-02-06T20:06:17.000Z")
  });
});

test("daimoPay", async (t) => {
  await t.test("query", async () => {
    const { blockNumber, result } = await Daimo.query({
      chainId: 8453n,
      destinationAddr: "0x7531f00dbc616b3466990e615bf01eff507c88d4",
      id: "7iNRoKprdvcNbafqixKSGJrW1T8vjyHzxfRj8jmfEeSR",
    });
    assert.deepStrictEqual(result, [{
      block_num: 26227261,
      tx_hash: '0xa96bc68abf96458413392aceecdab17d85aef02520e3a4502b488c6732da4958',
      success: true
    }]);
  });

  await t.test("live query", async () => {
    const controller = new AbortController();
    const query = Daimo.queryLive({
      abortSignal: controller.signal,
      startBlock: async () => 26227260n,
      chainId: 8453n,
      query: `
        select block_num, tx_hash, success
        from intentfinished
        where destinationAddr = 0x7531f00dbc616b3466990e615bf01eff507c88d4
        order by block_num asc
        limit 1
      `
    });
    for await (const { result } of query) {
      assert.deepStrictEqual(result, [{
        block_num: 26227261,
        tx_hash: '0xa96bc68abf96458413392aceecdab17d85aef02520e3a4502b488c6732da4958',
        success: true
      }]);
      controller.abort();
    }
  });
});
