/**
 * excel-import.ts
 * Parses a .xlsx file, validates every row, detects duplicates,
 * and returns a structured result for preview before committing.
 *
 * Usage:
 *   import { parseExcelFile, ImportResult } from '@/lib/excel-import';
 *   const result = await parseExcelFile(file, existingTransactions);
 */

import * as XLSX from 'xlsx';
import { Transaction, ACCOUNTS, Person, PERSONS, TransactionType, PaymentMode, HomeOrDebt } from './types';
import { generateId } from './financial-store';

// ── Public types ──────────────────────────────────────────────────────────

export interface ParsedRow {
  /** 1-based row index in the Excel sheet (for error messages) */
  rowIndex: number;
  /** The transaction if the row is valid */
  transaction?: Omit<Transaction, 'id'>;
  /** Errors if the row is invalid */
  errors: string[];
  /** True if this row is a duplicate of an existing transaction */
  isDuplicate: boolean;
  /** Raw values for display in the preview table */
  raw: Record<string, unknown>;
}

export interface ImportResult {
  valid:    ParsedRow[];   // valid, non-duplicate rows
  invalid:  ParsedRow[];   // rows with validation errors
  duplicates: ParsedRow[]; // valid but duplicate rows
  total:    number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const VALID_TYPES: TransactionType[] = ['income', 'expense', 'transfer'];
const VALID_PAYMENT_MODES: PaymentMode[] = ['cash', 'bank'];
const VALID_HOME_OR_DEBT: HomeOrDebt[] = ['home', 'debt'];
const ACCOUNT_IDS = new Set(ACCOUNTS.map(a => a.id));
const ACCOUNT_NAMES_MAP: Record<string, string> = {};
ACCOUNTS.forEach(a => { ACCOUNT_NAMES_MAP[a.name.toLowerCase().trim()] = a.id; });

// ── Normalizers ───────────────────────────────────────────────────────────

function normalizeStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : String(v ?? '').trim();
}

function normalizeType(raw: unknown): TransactionType | null {
  const s = normalizeStr(raw).toLowerCase();
  if (VALID_TYPES.includes(s as TransactionType)) return s as TransactionType;
  return null;
}

function normalizePaymentMode(raw: unknown): PaymentMode {
  const s = normalizeStr(raw).toLowerCase();
  return VALID_PAYMENT_MODES.includes(s as PaymentMode) ? (s as PaymentMode) : 'cash';
}

function normalizeHomeOrDebt(raw: unknown): HomeOrDebt {
  const s = normalizeStr(raw).toLowerCase();
  return VALID_HOME_OR_DEBT.includes(s as HomeOrDebt) ? (s as HomeOrDebt) : 'home';
}

function normalizePerson(raw: unknown): Person | null {
  const s = normalizeStr(raw);
  const match = PERSONS.find(p => p.toLowerCase() === s.toLowerCase());
  return match ?? null;
}

/** Parse date from multiple formats. Returns "YYYY-MM-DD" or null. */
function parseDate(raw: unknown): string | null {
  if (!raw) return null;

  // Excel serial date number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    }
    return null;
  }

  const s = normalizeStr(raw);
  if (!s) return null;

  // Try ISO
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) {
    return iso.toISOString().split('T')[0];
  }

  // Try DD-MMM-YYYY (our export format)
  const match = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const months: Record<string, string> = {
      Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
      Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
    };
    const m = months[match[2]];
    if (m) return `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
  }

  return null;
}

/** Resolve account ID from either an ID string or a display name. */
function resolveAccountId(raw: unknown): string | null {
  if (!raw) return null;
  const s = normalizeStr(raw);
  if (!s) return null;

  // Direct ID match
  if (ACCOUNT_IDS.has(s)) return s;

  // Name match (case-insensitive)
  const byName = ACCOUNT_NAMES_MAP[s.toLowerCase()];
  if (byName) return byName;

  return null; // unknown account
}

// ── Duplicate detection key ────────────────────────────────────────────────

function dupKey(t: Omit<Transaction, 'id'>): string {
  return [t.date, t.amount, t.person, (t.notes ?? '').trim()].join('|');
}

// ── Core validator ────────────────────────────────────────────────────────

function validateRow(raw: Record<string, unknown>, rowIndex: number): ParsedRow {
  const errors: string[] = [];

  // ── Date ──────────────────────────────────────────────────────────────
  const dateRaw = raw['Date'] ?? raw['date'];
  const date = parseDate(dateRaw);
  if (!date) errors.push('Invalid or missing Date');

  // ── Type ──────────────────────────────────────────────────────────────
  const typeRaw = raw['Type'] ?? raw['type'];
  const type = normalizeType(typeRaw);
  if (!type) errors.push(`Invalid Type "${typeRaw}" — must be income, expense, or transfer`);

  // ── Amount ────────────────────────────────────────────────────────────
  const amountRaw = raw['Amount'] ?? raw['amount'];
  const amount = Math.abs(Number(amountRaw));
  if (!amountRaw || isNaN(amount) || amount <= 0) {
    errors.push('Amount must be a number greater than 0');
  }

  // ── Person ────────────────────────────────────────────────────────────
  const personRaw = raw['Person'] ?? raw['person'];
  const person = normalizePerson(personRaw);
  if (!person) errors.push(`Unknown Person "${personRaw}" — must be one of ${PERSONS.join(', ')}`);

  // ── Account ───────────────────────────────────────────────────────────
  const accountRaw = raw['Account'] ?? raw['account'];
  const accountId  = resolveAccountId(accountRaw) ?? undefined;
  // Account not found is a warning, not a hard error (legacy data may lack accountId)

  // ── Transfer-specific validation ──────────────────────────────────────
  let transferToAccountId: string | undefined;
  let transferTo: Person | undefined;

  if (type === 'transfer') {
    const toRaw = raw['Transfer To'] ?? raw['transferTo'] ?? raw['transfer_to'];
    transferTo  = normalizePerson(toRaw) ?? undefined;
    if (!transferTo) errors.push('Transfer must have a "Transfer To" person');

    const toAccRaw  = raw['Transfer Account'] ?? raw['transferToAccountId'] ?? raw['transfer_account'];
    transferToAccountId = resolveAccountId(toAccRaw) ?? undefined;
    if (!transferToAccountId) errors.push('Transfer must have a valid "Transfer Account"');

    if (accountId && transferToAccountId && accountId === transferToAccountId) {
      errors.push('Cannot transfer to the same account');
    }
  }

  // ── Build transaction if valid ─────────────────────────────────────────
  if (errors.length === 0 && date && type && person) {
    const d = new Date(date);
    const txn: Omit<Transaction, 'id'> = {
      date,
      year:  d.getFullYear(),
      month: d.getMonth(),
      type,
      person,
      amount,
      category:           normalizeStr(raw['Category'] ?? raw['category']),
      paymentMode:        normalizePaymentMode(raw['Payment Mode'] ?? raw['paymentMode']),
      notes:              normalizeStr(raw['Notes'] ?? raw['notes']),
      homeOrDebt:         normalizeHomeOrDebt(raw['HomeOrDebt'] ?? raw['homeOrDebt']),
      accountId,
      transferTo,
      transferToAccountId,
    };
    return { rowIndex, transaction: txn, errors: [], isDuplicate: false, raw };
  }

  return { rowIndex, errors, isDuplicate: false, raw };
}

// ── Main parse function ───────────────────────────────────────────────────

export async function parseExcelFile(
  file: File,
  existingTransactions: Transaction[],
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array', cellDates: false });

        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('Excel file has no sheets');

        const ws = wb.Sheets[sheetName];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
          raw: true,  // keep raw numbers (for date serials)
        });

        if (rawRows.length === 0) throw new Error('No data rows found in Excel file');
        if (rawRows.length > 5000) throw new Error('File too large — max 5000 rows per import');

        // Build existing duplicate key set
        const existingKeys = new Set(existingTransactions.map(t => dupKey(t)));

        const valid: ParsedRow[]      = [];
        const invalid: ParsedRow[]    = [];
        const duplicates: ParsedRow[] = [];

        rawRows.forEach((row, idx) => {
          const parsed = validateRow(row, idx + 2); // +2: 1-based + header row

          if (parsed.errors.length > 0) {
            invalid.push(parsed);
            return;
          }

          // Duplicate check
          if (parsed.transaction) {
            const key = dupKey(parsed.transaction);
            if (existingKeys.has(key)) {
              duplicates.push({ ...parsed, isDuplicate: true });
              return;
            }
          }

          valid.push(parsed);
        });

        resolve({ valid, invalid, duplicates, total: rawRows.length });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse Excel file'));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// ── Convert ParsedRows to Transactions (add IDs) ──────────────────────────

export function buildTransactions(rows: ParsedRow[]): Transaction[] {
  return rows
    .filter(r => r.transaction && r.errors.length === 0 && !r.isDuplicate)
    .map(r => ({ ...r.transaction!, id: generateId() }));
}