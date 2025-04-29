import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";

const gitSha = execSync("git rev-parse --short HEAD").toString().trim();
const s3Client = new S3Client({ region: "us-west-2" });
await s3Client.send(
  new PutObjectCommand({
    Bucket: "static.indexsupply.net",
    Key: `indexsupply.js-${gitSha}`,
    Body: await readFile("dist/index.js"),
    ContentType: "text/javascript",
  }),
);

console.log("finished uploading script");
