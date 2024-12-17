import http from "http";
import fs from "fs/promises";
import path from "path";

function mimeType(filePath) {
  const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
  };
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

http
  .createServer(async (req, res) => {
    try {
      const filePath = path.join(process.cwd(), req.url);
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        "Content-Type": mimeType(filePath),
        "Content-Length": data.length,
      });
      res.end(data);
    } catch (error) {
      console.error(error);
    }
  })
  .listen(3000);
