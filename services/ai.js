import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

let client = null;

function getClient() {
  if (!client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    client = new Anthropic({ apiKey: key });
  }
  return client;
}

function fileToBase64(filePath) {
  return readFileSync(filePath).toString('base64');
}

function mimeType(mimetype, originalname) {
  if (mimetype && mimetype !== 'application/octet-stream') return mimetype;
  const ext = (originalname || '').split('.').pop().toLowerCase();
  const map = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'image/jpeg';
}

function buildMediaContent(file) {
  const mime = mimeType(file.mimetype, file.originalname);
  const b64 = fileToBase64(file.path);

  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };
  }
  return { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
}

export async function extractContract(file, apiKey) {
  const anthropic = apiKey ? new Anthropic({ apiKey }) : getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        buildMediaContent(file),
        {
          type: 'text',
          text: `Extract rental contract details and return ONLY valid JSON (no markdown, no explanation):
{
  "tenants": [{"name": "", "email": "", "phone": ""}],
  "unitNumber": "",
  "propertyAddress": "",
  "contractStartDate": "YYYY-MM-DD",
  "contractEndDate": "YYYY-MM-DD",
  "annualRent": 0,
  "paymentFrequency": "monthly",
  "paymentDueDay": 1,
  "securityDeposit": 0
}
annualRent is the TOTAL yearly rental amount as written in the contract (e.g. if contract says AED 33,000/year use 33000).
paymentFrequency must be one of: monthly, every-two-months, quarterly.
  - monthly = paid every month (12 times/year)
  - every-two-months = paid every 2 months (6 times/year)
  - quarterly = paid every 3 months (4 times/year)
paymentDueDay is the day of the month rent is due (1-31).
Use null for missing fields. Dates must be YYYY-MM-DD format.`
        }
      ]
    }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]);
}

export async function extractCheque(file, apiKey) {
  const anthropic = apiKey ? new Anthropic({ apiKey }) : getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        buildMediaContent(file),
        {
          type: 'text',
          text: `Extract cheque details and return ONLY valid JSON (no markdown, no explanation):
{
  "amount": 0,
  "date": "YYYY-MM-DD",
  "payee": "",
  "bankName": "",
  "chequeNumber": "",
  "memo": ""
}
Use null for missing fields. Date must be YYYY-MM-DD format.`
        }
      ]
    }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]);
}
