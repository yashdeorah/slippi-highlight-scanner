#!/usr/bin/env node
import fs from "node:fs";
import { scanDirectory } from "./scanner.js";

function usage() {
  console.error("Usage: slippi-peach-scan <replay-directory> --code CODE [--tag TAG ...] [--top 10] [--max-files 200] [--json output.json]");
  process.exit(2);
}
const args = process.argv.slice(2);
if (!args.length) usage();
const root = args.shift();
const options = { code: "", tags: [], top: 10, maxFiles: 200 };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--code") options.code = args[++i];
  else if (args[i] === "--tag") options.tags.push(args[++i]);
  else if (args[i] === "--top") options.top = Number(args[++i]);
  else if (args[i] === "--max-files") options.maxFiles = Number(args[++i]);
  else if (args[i] === "--json") options.output = args[++i];
  else usage();
}
if (!options.code && !options.tags.length) usage();
const report = scanDirectory(root, options);
const json = JSON.stringify(report, null, 2);
if (options.output) fs.writeFileSync(options.output, json + "\n");
else console.log(json);
