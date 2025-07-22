// contracts/fixForgeImports.js
// This script normalizes imports from forge-std in Solidity files.
const fg   = require("fast-glob");
const fs   = require("fs");
const path = require("path");

// Project root is liveduel-demo-2/contracts
const ROOT = path.resolve(__dirname, "contracts");

// Regex matches imports like:
//   import { Test } from "../../forge-std/Test.sol";
//   import { Test } from "@forge-std/Test.sol";
const FORGE_IMPORT = /import\s+([^;]+)\s+from\s+['"](?:\.\.\/+)*(?:@)?(forge-std\/[^'"]+)['"];/g;

(async () => {
  const files = await fg(["**/*.sol", "**/*.t.sol"], {
    cwd: ROOT,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**"],
  });

  if (!files.length) {
    console.warn("⚠️ No Solidity files found under", ROOT);
    return;
  }

  for (const file of files) {
    const src     = fs.readFileSync(file, "utf8");
    const updated = src.replace(FORGE_IMPORT, (_m, bindings, forgePath) =>
      `import ${bindings} from "${forgePath}";`
    );

    if (updated !== src) {
      fs.writeFileSync(file, updated, "utf8");
      console.log(`→ fixed forge-std import in ${path.relative(__dirname, file)}`);
    }
  }

  console.log("✅ All forge-std imports normalized.");
})();
