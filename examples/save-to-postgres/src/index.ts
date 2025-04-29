import { promises as fs } from 'fs';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { queryLive, setLogLevel, LogLevel } from "indexsupply.js";

type Hex = `0x${string}`;

setLogLevel(LogLevel.DEBUG);

class TestDatabase {
  public client: Client | undefined;
  private server: EmbeddedPostgres;
  constructor() {
    this.server = new EmbeddedPostgres({
      databaseDir: '/tmp/examples/save-to-postgres',
      user: 'postgres',
      port: 5433,
      persistent: true,
      onLog: (_) => { },
    });
    this.client = undefined;
  }

  async start(schema: string): Promise<Client> {
    try {
      await this.server.start();
    } catch (e) {
      console.log("resetting the database")
      await fs.rm("/tmp/examples/save-to-postgres", { recursive: true, force: true });
      await this.server.initialise();
      await this.server.start();
      await this.server.createDatabase('index-supply-save-to-postgres');
    } finally {
      this.client = this.server.getPgClient();
      await this.client.connect();
      await this.client.query(schema);
    }
    return this.client;
  }

  async stop() {
    await this.client!.end();
    await this.server.stop();
  }
}

async function main() {
  const pg = new TestDatabase()
  await pg.start(`
    create table if not exists my_transfers(
       block_num int8,
       "from" bytea,
       "to" bytea,
       value numeric
     )
  `);

  const query = queryLive({
    startBlock: async () => {
      const res = await pg.client!.query<{ latest: string }>(`
        select coalesce(max(block_num), 20000000) latest from my_transfers
      `);
      return BigInt(res.rows[0].latest);
    },
    chainId: 8453n,
    signatures: [
      "Transfer(address indexed from, address indexed to, uint256 value)",
    ],
    query: `select tx_hash, block_num, "from", "to", value from transfer order by block_num desc limit 1`,
    formatRow: ([tx_hash, block_num, from, to, value]) => {
      return {
        tx: tx_hash as Hex,
        block: BigInt(block_num),
        from: from as Hex,
        to: to as Hex,
        value: BigInt(value)
      };
    },
  });
  for await (const { rows } of query) {
    await Promise.all(rows.map(async (row) => {
      await pg.client!.query(`
        insert into my_transfers(block_num, "from", "to", value)
        values ($1, $2, $3, $4)
      `, [row.block, row.from, row.to, row.value]
      );
    }));
  }
  await pg.stop();
}

main();
