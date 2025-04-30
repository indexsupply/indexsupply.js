import test from "node:test";
import assert from "node:assert/strict";
import { readStream, Stream, JsonValue, setLogLevel, LogLevel } from "../src/index"

function createReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;

  return {
    read() {
      if (i < chunks.length) {
        return Promise.resolve({
          done: false,
          value: encoder.encode(chunks[i++]),
        });
      } else {
        return Promise.resolve({ done: true, value: undefined });
      }
    },
    cancel() {
      return Promise.resolve();
    },
    releaseLock() { },
    closed: Promise.resolve(),
  } as ReadableStreamDefaultReader<Uint8Array>;
}


test("reads single JSON message", async () => {
  const reader = createReader([
    "data: {\"foo\": 1}\n\n",
  ]);
  const results: JsonValue[] = [];
  for await (const obj of readStream(reader)) {
    results.push(obj);
  }
  assert.deepEqual(results, [{ foo: 1 }]);
});

test("reads multiple JSON messages in one chunk", async () => {
  const reader = createReader([
    "data: {\"foo\": 1}\n\ndata: {\"bar\": 2}\n\n",
  ]);
  const results: JsonValue[] = [];
  for await (const obj of readStream(reader)) {
    results.push(obj);
  }
  assert.deepEqual(results, [{ foo: 1 }, { bar: 2 }]);
});

test("reads JSON messages across multiple chunks", async () => {
  const reader = createReader([
    "data: {\"foo\":",
    " 1}\n\n",
    "data: {\"bar\": 2}\n\n",
  ]);
  const results: JsonValue[] = [];
  for await (const obj of readStream(reader)) {
    results.push(obj);
  }
  assert.deepEqual(results, [{ foo: 1 }, { bar: 2 }]);
});

test("throws on invalid JSON", async () => {
  const reader = createReader([
    "data: {invalid}\n\n",
  ]);
  let threw = false;
  try {
    for await (const _ of readStream(reader)) { }
  } catch (e) {
    threw = true;
    assert.equal((e as Error).message, "Failed to parse JSON");
  }
  assert.ok(threw, "Expected to throw on invalid JSON");
});
