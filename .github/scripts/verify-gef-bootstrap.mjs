import fs from "node:fs";

const mode = process.argv[2];
const EXPECTED_VERSION = "1.1.2";
const EXPECTED_SRI = "sha512-zLu0oaBWqwIPviZgN0PTk1/5QlsHK8r7aCNOkMop0MnlzqFZ1um3zfkRO2l8hx005nd/2xZ/Ll/lDzYUbH01uw==";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

if (mode === "package") {
  const pkg = readJson("node_modules/@gef-bootstrap/cli/package.json");
  if (pkg.version !== EXPECTED_VERSION) {
    throw new Error(`Expected @gef-bootstrap/cli ${EXPECTED_VERSION}, got ${pkg.version}`);
  }

  const lock = readJson("package-lock.json");
  const entry = lock.packages?.["node_modules/@gef-bootstrap/cli"];
  if (!entry) throw new Error("GEF package missing from lockfile");
  if (entry.version !== EXPECTED_VERSION) {
    throw new Error(`Lockfile version drift: ${entry.version}`);
  }
  if (entry.integrity !== EXPECTED_SRI) {
    throw new Error(`Registry SRI mismatch: ${entry.integrity}`);
  }

  console.log(JSON.stringify({ ok: true, mode, version: EXPECTED_VERSION, integrity: EXPECTED_SRI }));
  process.exit(0);
}

if (mode === "state") {
  const state = readJson(".gef/init-state.json");
  if (state.productVersion !== EXPECTED_VERSION) throw new Error("Unexpected GEF state version");
  if (state.kind !== "gef.init.state") throw new Error("Unexpected GEF state kind");
  if (state.commandId !== "gef.init.run") throw new Error("Unexpected GEF state command");
  if (state.transaction?.outcome !== "APPLIED") throw new Error("GEF init did not report APPLIED");
  if (!state.runId) throw new Error("GEF runId missing");

  const receiptPath = `.gef/receipts/${state.runId}.json`;
  const receipt = readJson(receiptPath);
  if (receipt.productVersion !== EXPECTED_VERSION) throw new Error("Unexpected receipt version");
  if (receipt.commandId !== "gef.init.run") throw new Error("Unexpected receipt command");
  if (receipt.runId !== state.runId) throw new Error("Receipt/state runId mismatch");

  console.log(JSON.stringify({ ok: true, mode, runId: state.runId, receiptPath }));
  process.exit(0);
}

throw new Error(`Unknown verification mode: ${mode}`);
