// fixSolImports.js
// ONLY rewrites our six icm‑contracts @aliases into proper relative paths

const fg   = require("fast-glob");
const fs   = require("fs");
const path = require("path");

const ICMDIR = path.resolve(__dirname, "contracts", "icm-contracts");

const ALIASES = [
  "ictt",
  "utilities",
  "teleporter",
  "mocks",
  "governance",
  "validator-manager"
];

const ALIAS_IMPORT = new RegExp(
  `import\\s+([^;]+)\\s+from\\s+['"]@(` +
    ALIASES.join("|") +
  `)\\/([^'"]+)['"];`,
  "g"
);

(async () => {
  const files = await fg(["**/*.sol","**/*.t.sol"], {
    cwd: ICMDIR,
    absolute: true,
    onlyFiles: true,
    ignore: ["**/node_modules/**"],
  });
  if (files.length === 0) {
    console.warn("⚠️ No solidity files under", ICMDIR);
    return;
  }

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const updated = src.replace(ALIAS_IMPORT, (_match, bindings, alias, rest) => {
      // alias is one of "mocks", "teleporter", etc.
      // rest is everything after that slash, e.g. "UnitTestMockERC20.sol" or "TeleporterMessenger.sol"
      const target = path.join(ICMDIR, alias, rest);
      let rel = path.relative(path.dirname(file), target);
      if (!rel.startsWith(".")) rel = "./" + rel;
      rel = rel.split(path.sep).join("/");

      return `import ${bindings} from "${rel}";`;
    });

    if (updated !== src) {
      fs.writeFileSync(file, updated, "utf8");
      console.log(`→ fixed icm import in ${path.relative(__dirname, file)}`);
    }
  }

  console.log("✅ Done rewriting only the six icm‑contracts aliases.");
})();
