import type { Address, Hex } from "viem";

export function randomHex(length: number): Hex {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return `0x${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function randomAddress(): Address {
  return randomHex(20)
}