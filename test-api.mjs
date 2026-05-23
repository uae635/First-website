// Quick API key test — run with: node test-api.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv needed for this test)
const envFile = join(__dirname, '.env');
const envLines = readFileSync(envFile, 'utf8').split('\n');
for (const line of envLines) {
  const [key, ...vals] = line.split('=');
  if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
}

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey || apiKey === 'PASTE_YOUR_KEY_HERE') {
  console.error('\n❌  No API key found in .env');
  console.error('   Open .env and replace PASTE_YOUR_KEY_HERE with your real key.\n');
  process.exit(1);
}

console.log(`\n🔑  Key found: ${apiKey.slice(0, 14)}...${apiKey.slice(-4)}`);
console.log('📡  Testing connection to Anthropic API...\n');

try {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word: WORKING' }]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`❌  API error ${res.status}: ${data.error?.message || JSON.stringify(data)}\n`);
    process.exit(1);
  }

  const reply = data.content?.[0]?.text?.trim();
  console.log(`✅  API is working! Claude replied: "${reply}"`);
  console.log('\n   You can now run:  node server.js\n');
} catch (err) {
  console.error(`❌  Network error: ${err.message}\n`);
  process.exit(1);
}
