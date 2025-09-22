// scripts/test-parse.ts
import { parseFileToText } from "../src/parser.js";

const fp = process.argv[2];
if (!fp) {
    console.error("Usage: npx tsx scripts/test-parse.ts <path-to-file>");
    process.exit(1);
}

(async () => {
    const txt = await parseFileToText(fp);
    console.log("=== Parsed text (first 1000 chars) ===");
    console.log(txt.slice(0, 1000));
})();