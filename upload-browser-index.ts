import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const s3Client = new S3Client({region: "us-west-2"});
await s3Client.send(new PutObjectCommand({
	Bucket: "static.indexsupply.net",
	Key: "indexsupply.js",
	Body: await Bun.file("dist/browser-index.js").bytes(),
}));
