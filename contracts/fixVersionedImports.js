// fixVersionedImports.js
// ONLY removes @X.Y.Z (or @vX.Y.Z) *immediately* before a slash under contracts/icm-contracts.
// Leaves every quote and semicolon alone.

const fg   = require("fast-glob");
const fs   = require("fs");
const path = require("path");

const ICMDIR = path.resolve(__dirname, "contracts", "icm-contracts");

// Matches exactly "@1.2.3" or "@v0.8.25" when it’s immediately before a "/"
const STRIP_VERSION = /@v?\d+\.\d+\.\d+(?=\/)/g;

(async () => {
  const files = await fg(["**/*.sol","**/*.t.sol"], {
    cwd: ICMDIR,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**"],
  });
  if (!files.length) {
    console.warn("⚠️ No .sol/.t.sol under", ICMDIR);
    return;
  }
  for (const file of files) {
    const src     = fs.readFileSync(file, "utf8");
    const updated = src.replace(STRIP_VERSION, "");
    if (updated !== src) {
      fs.writeFileSync(file, updated, "utf8");
      console.log(`→ stripped @version in ${path.relative(__dirname, file)}`);
    }
  }
  console.log("✅ All @version suffixes removed cleanly.");
})();
