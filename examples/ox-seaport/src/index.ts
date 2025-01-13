import { AbiEvent } from 'ox';
import { query, setLogLevel, LogLevel } from "indexsupply.js";

setLogLevel(LogLevel.DEBUG);

const orderFulfilled = AbiEvent.from("event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address recipient, (uint8, address, uint256, uint256)[] offer, (uint8, address, uint256, uint256, address)[] consideration)");

async function main() {
  const { blockNumber, result } = await query({
    chainId: 1n,
    query: `
      select topics, data
      from logs
      where topics[1] = 0x9d9af8e38d66c62e2c12f0225249fd9d721c54b83f48d9352c97c6cacdcb6f31
      and address = 0x00000000006c3852cbEf3e08E8dF289169EdE581
      and block_num = 16351176
      and log_idx = 12
    `,
    formatRow: ([topics, data]) => {
      return AbiEvent.decode(orderFulfilled, {
        topics: topics,
        data: data,
      });
    },
  });

  result.forEach((order) => {
    console.log({ offer: order.offer, consideration: order.consideration });
  })
}

main();
