import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'apps', 'web', '.next', 'static');
if (!fs.existsSync(root))
  throw new Error('Next.js client bundle does not exist; run the web build first');
const secretKeys = Object.keys(process.env).filter((name) =>
  /(?:SECRET|TOKEN|PRIVATE|API_KEY|DATABASE_URL|PASSWORD)/i.test(name),
);
const secretValues = secretKeys
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => typeof value === 'string' && value.length >= 8);
const forbiddenMarkers = [
  'DATABASE_URL=',
  'PRIVATE_KEY=',
  'SEED_PHRASE=',
  'OPENAI_API_KEY=',
  'Bearer eyJ',
];
let filesScanned = 0;
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else {
      filesScanned += 1;
      const content = fs.readFileSync(file, 'utf8');
      for (const marker of forbiddenMarkers)
        if (content.includes(marker))
          throw new Error(
            `Secret-bearing marker found in client asset ${path.relative(root, file)}`,
          );
      for (const [name, value] of secretValues)
        if (content.includes(value))
          throw new Error(`Environment value for ${name} found in a client asset`);
    }
  }
}
scan(root);
console.log(
  JSON.stringify({
    ok: true,
    filesScanned,
    environmentValuesChecked: secretValues.length,
    result: 'no server secret material in client assets',
  }),
);
