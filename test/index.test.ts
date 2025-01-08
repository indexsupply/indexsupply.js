import test from "node:test";
import assert from "node:assert/strict";
import { query, queryLive, setLogLevel, LogLevel } from "../src/index";

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
    assert.deepStrictEqual(result, [
      {
        block_num: 2397613,
        log_idx: 1997,
        from: "0x8ab39456f5c35910f30c391311806c06310b49fc",
        to: "0x4cf76043b3f97ba06917cbd90f9e3a2aac1b306e",
        value: "71817150413",
      },
    ]);
  });

  await t.test("should throw", async () => {
    await assert.rejects(
      async () => {
        await query({
          chainId: 8453n,
          eventSignatures: [
            "Transfer(address indexed from, address indexed to, uint256 value)",
          ],
          query: "bad query",
        });
      },
      (err: any) => {
        assert.strictEqual(err, "InvalidRequest");
        return true;
      },
    );
  });
});

test("queryLive", async (t) => {
  const controller = new AbortController();
  await t.test("should work", async () => {
    const query = await queryLive({
      abortSignal: controller.signal,
      startBlock: () => 2397612n,
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
      assert.deepStrictEqual(result, [
        {
          block_num: 2397613,
          log_idx: 1997,
          from: "0x8ab39456f5c35910f30c391311806c06310b49fc",
          to: "0x4cf76043b3f97ba06917cbd90f9e3a2aac1b306e",
          value: "71817150413",
        },
      ]);
      controller.abort();
    }
  });
});
