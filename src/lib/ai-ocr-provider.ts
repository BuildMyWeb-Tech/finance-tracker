/**
 * ai-ocr-provider.ts
 *
 * Multi-AI handwriting OCR engine.
 * Priority: VITE_CLAUDE_AI_ENABLED → VITE_OPENAI_ENABLED → Tesseract fallback.
 *
 * .env keys used:
 *   VITE_CLAUDE_AI_ENABLED=true
 *   VITE_CLAUDE_AI_TOKEN=sk-ant-...
 *
 *   VITE_OPENAI_ENABLED=true
 *   VITE_OPENAI_API_KEY=sk-proj-...
 */

import {
  PERSONS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  DEBT_EXPENSE_CATEGORIES,
  ACCOUNTS,
} from './types';
import type { Transaction, Person, PaymentMode, HomeOrDebt, TransactionType } from './types';

// ─── Env flags ───────────────────────────────────────────────────────────────

function isClaudeEnabled(): boolean {
  return (
    import.meta.env.VITE_CLAUDE_AI_ENABLED === 'true' &&
    !!import.meta.env.VITE_CLAUDE_AI_TOKEN
  );
}

function isOpenAIEnabled(): boolean {
  return (
    import.meta.env.VITE_OPENAI_ENABLED === 'true' &&
    !!import.meta.env.VITE_OPENAI_API_KEY
  );
}

export function getActiveProviderName(): string {
  if (isClaudeEnabled()) return 'Claude AI';
  if (isOpenAIEnabled()) return 'OpenAI GPT-4o';
  return 'Tesseract OCR (local)';
}

// ─── Shared prompt ───────────────────────────────────────────────────────────

function buildPrompt(): string {
  const today = new Date().toISOString().split('T')[0];

  return `You are an expert accountant reading handwritten Tamil-family account notebook pages.

FAMILY MEMBERS & ABBREVIATIONS:
- Appa / AA / Ap = person "Appa"
- Ajai / AJ / Aj  = person "Ajai"
- Amma            = person "Amma"
- Mauli / Mauli   = person "Mauli"

ACCOUNT ABBREVIATIONS:
- CNB = Canara Bank (bank)
- SBI / MSBI / AJAI SBI = SBI bank (bank)
- Cash / A.Cash / AC / A.C / Cal = Cash (cash)
- PNB = Punjab National Bank (bank)
- CB = Canara Bank (bank)

TRANSACTION TYPE RULES:
- "IT [Person A] [Account] to [Person B] [Account]" = type "transfer"
  - fromPerson / toPerson extracted from left/right sides
  - e.g. "IT AJ CNB to A.Cash" → Ajai CNB → Appa Cash, type=transfer
- Lines with amount only (no IT prefix) under a date = expense by the main person of that date section
- "B → AC/Cash/A.C → [amount] (v)" = expense paid from B's cash
- "B → AC → [amount] (v)" means B paid cash expense of that amount

CATEGORY MAPPING (map handwritten to exact category names):
Expenses: Veg/Vegetables→"Vegetables", Crlo/Grocery→"Grocery", Bra/Snacks→"Snacks",
  Pet/Petrol→"Petrol", Milk→"Milk", Rice→"Rice", EB→"EB", Med/Medi→"Medicine",
  Hotel/Food→"Hotel/Food", Non Veg→"Non Veg", Cable→"Cable", Recharge→"Recharge",
  Maavu→"Maavu", Ration→"Ration", Mangal→"Mangal", Cylinder→"Cylinder",
  Rent→"Rent", Others/Oth→"Others", Kovil/Kovil Comm→"Others",
  Bag/Bag(mom)→"Others", Bike Tyre→"Petrol", Chicken→"Non Veg",
  Bill Comm→"Others", Chama medi/Chamo medi→"Medicine",
  mill(SPBM)/Mill SVRM→"Mill SVRM Mann.", exela→"Others",
  Pet.Comm→"Petrol", Xerox→"Others", Rick→"Petrol"

Income: Salary→"Ajai Salary" or "Appa Salary" (based on person), Allowance→"Allowance",
  Vaati→"Vaati", Ration Income→"Ration Income"

PAYMENT MODE:
- Cash account → "cash"
- Any bank account (CNB, SBI, MSBI, PNB, CB) → "bank"

HOME OR DEBT:
- Default "home" unless clearly loan/debt related
- Loan, Debt, EMI → "debt"

ACCOUNT ID MAPPING (use these exact IDs):
Appa Cash: "appa-cash", Appa SBI: "appa-sbi", Appa CNB: "appa-cnb", Appa Ajai SBI: "appa-ajai-sbi"
Ajai Cash: "ajai-cash", Ajai CNB: "ajai-cnb", Ajai PNB: "ajai-pnb", Ajai CB: "ajai-cb"
Amma Cash: "amma-cash"
Mauli Cash: "mauli-cash", Mauli SBI: "mauli-sbi", Mauli CNB: "mauli-cnb"

OUTPUT FORMAT — Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "date": "YYYY-MM-DD",
    "person": "Appa|Ajai|Amma|Mauli",
    "type": "income|expense|transfer",
    "category": "exact category name or empty string for transfer",
    "amount": 123,
    "paymentMode": "cash|bank",
    "accountId": "account-id or null",
    "transferTo": "Appa|Ajai|Amma|Mauli or null",
    "transferToAccountId": "account-id or null",
    "homeOrDebt": "home|debt",
    "notes": "short note about this entry"
  }
]

Today's date is ${today}. If the notebook shows only day+month (e.g. "18/6"), assume year ${new Date().getFullYear()}.
Extract EVERY transaction visible. If amount is unclear, skip that row.
Return ONLY the JSON array. No prose.`;
}

// ─── Claude AI ───────────────────────────────────────────────────────────────

async function parseWithClaude(images: { base64: string; mimeType: string }[]): Promise<RawParsedRow[]> {
  const content: object[] = [
    { type: 'text', text: buildPrompt() },
  ];
  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
    });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_CLAUDE_AI_TOKEN,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Claude API error');
  const text = data.content?.[0]?.text || '[]';
  return safeParseJSON(text);
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function parseWithOpenAI(images: { base64: string; mimeType: string }[]): Promise<RawParsedRow[]> {
  const msgContent: object[] = [{ type: 'text', text: buildPrompt() }];
  for (const img of images) {
    msgContent.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: msgContent }],
      max_tokens: 4096,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'OpenAI API error');
  const text = data.choices?.[0]?.message?.content || '[]';
  return safeParseJSON(text);
}

// ─── Tesseract fallback ──────────────────────────────────────────────────────

async function parseWithTesseract(_images: { base64: string; mimeType: string }[]): Promise<RawParsedRow[]> {
  // Tesseract can't do structured parsing — return a template row the user must fill
  return [{
    date: new Date().toISOString().split('T')[0],
    person: 'Ajai',
    type: 'expense',
    category: 'Others',
    amount: 0,
    paymentMode: 'cash',
    accountId: 'ajai-cash',
    transferTo: null,
    transferToAccountId: null,
    homeOrDebt: 'home',
    notes: 'OCR fallback — please fill manually',
  }];
}

// ─── JSON parser ─────────────────────────────────────────────────────────────

type RawParsedRow = {
  date: string;
  person: string;
  type: string;
  category: string;
  amount: number;
  paymentMode: string;
  accountId: string | null;
  transferTo: string | null;
  transferToAccountId: string | null;
  homeOrDebt: string;
  notes: string;
};

function safeParseJSON(text: string): RawParsedRow[] {
  // Strip markdown code fences
  const clean = text.replace(/```json|```/gi, '').trim();
  // Find first [ ... ] block
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return [];
  }
}

// ─── Normalise AI output → Transaction ──────────────────────────────────────

const VALID_PERSONS: Person[] = ['Appa', 'Ajai', 'Amma', 'Mauli'];
const VALID_MODES: PaymentMode[] = ['cash', 'bank'];
const VALID_TYPES: TransactionType[] = ['income', 'expense', 'transfer'];
const VALID_HOME_DEBT: HomeOrDebt[] = ['home', 'debt'];
const ALL_CATS = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...DEBT_EXPENSE_CATEGORIES] as string[];
const VALID_ACCOUNT_IDS = ACCOUNTS.map(a => a.id);

function coercePerson(raw: string): Person {
  const map: Record<string, Person> = {
    appa: 'Appa', aa: 'Appa', ap: 'Appa',
    ajai: 'Ajai', aj: 'Ajai', ajai1: 'Ajai',
    amma: 'Amma',
    mauli: 'Mauli',
  };
  const key = (raw || '').toLowerCase().trim();
  return map[key] ?? (VALID_PERSONS.includes(raw as Person) ? (raw as Person) : 'Ajai');
}

function coerceCategory(raw: string, type: TransactionType): string {
  if (!raw) return type === 'transfer' ? '' : 'Others';
  if (ALL_CATS.includes(raw)) return raw;
  // fuzzy partial match
  const lc = raw.toLowerCase();
  const found = ALL_CATS.find(c => c.toLowerCase().includes(lc) || lc.includes(c.toLowerCase()));
  return found ?? (type === 'transfer' ? '' : 'Others');
}

function generateDraftId() {
  return 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

export type DraftTransaction = Omit<Transaction, 'id' | 'year' | 'month'> & { _draftId: string };

function normaliseRow(raw: RawParsedRow): DraftTransaction {
  const person = coercePerson(raw.person);
  const type = VALID_TYPES.includes(raw.type as TransactionType) ? (raw.type as TransactionType) : 'expense';
  const category = coerceCategory(raw.category, type);
  const amount = Math.abs(Number(raw.amount) || 0);
  const paymentMode = VALID_MODES.includes(raw.paymentMode as PaymentMode) ? (raw.paymentMode as PaymentMode) : 'cash';
  const homeOrDebt = VALID_HOME_DEBT.includes(raw.homeOrDebt as HomeOrDebt) ? (raw.homeOrDebt as HomeOrDebt) : 'home';

  // date
  let date = raw.date || new Date().toISOString().split('T')[0];
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    date = new Date().toISOString().split('T')[0];
  }

  // accountId
  const accountId = raw.accountId && VALID_ACCOUNT_IDS.includes(raw.accountId) ? raw.accountId : undefined;

  // transfer fields
  const transferTo = raw.transferTo
    ? (VALID_PERSONS.includes(raw.transferTo as Person) ? (raw.transferTo as Person) : undefined)
    : undefined;
  const transferToAccountId = raw.transferToAccountId && VALID_ACCOUNT_IDS.includes(raw.transferToAccountId)
    ? raw.transferToAccountId
    : undefined;

  return {
    _draftId: generateDraftId(),
    date,
    person,
    type,
    category,
    amount,
    paymentMode,
    accountId,
    transferTo,
    transferToAccountId,
    homeOrDebt,
    notes: raw.notes || '',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function extractTransactionsFromImages(
  images: { base64: string; mimeType: string }[]
): Promise<DraftTransaction[]> {
  let rows: RawParsedRow[] = [];

  if (isClaudeEnabled()) {
    rows = await parseWithClaude(images);
  } else if (isOpenAIEnabled()) {
    rows = await parseWithOpenAI(images);
  } else {
    rows = await parseWithTesseract(images);
  }

  return rows
    .filter(r => r && typeof r === 'object')
    .map(normaliseRow)
    .filter(r => r.amount > 0 || r.type === 'transfer');
}