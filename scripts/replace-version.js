import fs from "fs";

const version = JSON.parse(fs.readFileSync("./package.json", "utf8")).version;
const lines = fs.readFileSync("src/index.ts", "utf8").split("\n");
const newLines = lines.map((line) => {
  if (line.includes("const userAgentVersion =")) {
    return `const userAgentVersion = "${version}";`;
  }
  return line;
});
fs.writeFileSync("src/index.ts", newLines.join("\n"));
