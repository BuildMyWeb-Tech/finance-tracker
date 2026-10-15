/**
 * LedgerPage.tsx
 * Monthly ledger matrix — income/expense categories × months.
 * Mirrors the Excel "Bachelor Finance Tracker" layout, but:
 *  - Data comes from Supabase transactions (live)
 *  - Layout/rows fully configurable per user (saved in app_config)
 *  - Import from AK Expenses xlsx format
 *  - Export to xlsx matching the Excel format
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { saveConfig } from '@/lib/supabase-store';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Settings2, Download, Upload, Plus, Trash2, GripVertical,
  ChevronLeft, ChevronRight, X, Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MONTH_NAMES } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LedgerRow {
  id: string;
  label: string;
  category: string;   // matches transaction.category
  type: 'income' | 'expense';
  person?: string;    // if set, only count transactions for this person
}

interface LedgerConfig {
  incomeRows: LedgerRow[];
  expenseRows: LedgerRow[];
  showPersonBreakdown: boolean;
  personRows: string[];          // persons to show in breakdown
  openingBalance: number;        // opening balance for Jan of the selected year
  openingMonth: number;          // which month the opening balance applies to (0-indexed)
  openingYear: number;
}

const CONFIG_KEY = 'ledgerConfig';

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function defaultConfig(): LedgerConfig {
  return {
    incomeRows: [],
    expenseRows: [],
    showPersonBreakdown: true,
    personRows: [],
    openingBalance: 0,
    openingMonth: 0,
    openingYear: new Date().getFullYear(),
  };
}

// ─── Hook: load/save ledger config ────────────────────────────────────────────

function useLedgerConfig() {
  const { currentUser } = useAuth();
  const { state } = useFinance();
  const [config, setConfigState] = useState<LedgerConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);

  // Load from state (app_config comes through FinanceContext)
  useEffect(() => {
    const raw = (state as any).ledgerConfig;
    if (raw && typeof raw === 'object') {
      setConfigState({ ...defaultConfig(), ...raw });
    } else {
      // Try localStorage fallback
      try {
        const stored = localStorage.getItem(`ledgerConfig-${currentUser}`);
        if (stored) setConfigState({ ...defaultConfig(), ...JSON.parse(stored) });
      } catch {}
    }
    setLoaded(true);
  }, [state, currentUser]);

  const saveConfigLocal = (cfg: LedgerConfig) => {
    setConfigState(cfg);
    try { localStorage.setItem(`ledgerConfig-${currentUser}`, JSON.stringify(cfg)); } catch {}
    if (currentUser) saveConfig(CONFIG_KEY, cfg, currentUser).catch(() => {});
  };

  return { config, setConfig: saveConfigLocal, loaded };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n === 0 ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtSigned = (n: number) =>
  n === 0 ? '—' : (n > 0 ? '+' : '') + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

function avg(nums: number[]) {
  const nonZero = nums.filter(n => n > 0);
  return nonZero.length ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : 0;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LedgerPage() {
  const { state, addTransaction } = useFinance();
  const { config, setConfig, loaded } = useLedgerConfig();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showConfig, setShowConfig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Derived: which months have any data ──────────────────────────────────
  const activeMonths = useMemo(() => {
    const set = new Set<number>();
    state.transactions.filter(t => t.year === year).forEach(t => set.add(t.month));
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [new Date().getMonth()];
  }, [state.transactions, year]);

  // ── Compute cell totals ───────────────────────────────────────────────────
  const getTotal = (row: LedgerRow, month: number): number =>
    state.transactions
      .filter(t =>
        t.year === year &&
        t.month === month &&
        t.type === row.type &&
        t.category === row.category &&
        (row.person ? t.person === row.person : true),
      )
      .reduce((s, t) => s + t.amount, 0);

  const getPersonTotal = (person: string, month: number): number =>
    state.transactions
      .filter(t =>
        t.year === year &&
        t.month === month &&
        t.type === 'expense' &&
        t.person === person,
      )
      .reduce((s, t) => s + t.amount, 0);

  // ── Summary rows ─────────────────────────────────────────────────────────
  const monthSummary = useMemo(() => {
    return activeMonths.map(m => {
      const income  = config.incomeRows.reduce((s, r) => s + getTotal(r, m), 0);
      const expense = config.expenseRows.reduce((s, r) => s + getTotal(r, m), 0);
      return { month: m, income, expense, net: income - expense };
    });
  }, [activeMonths, config, state.transactions, year]);

  // Opening balances: first month = config.openingBalance (if year/month matches), else chain
  const openingBalances = useMemo(() => {
    const map: Record<number, number> = {};
    activeMonths.forEach((m, i) => {
      if (i === 0) {
        // Use configured opening if year+month match
        if (config.openingYear === year && config.openingMonth === m) {
          map[m] = config.openingBalance;
        } else {
          map[m] = 0;
        }
      } else {
        const prev = activeMonths[i - 1];
        map[m] = map[prev] + monthSummary[i - 1].net;
      }
    });
    return map;
  }, [activeMonths, monthSummary, config, year]);

  // ── Row header cell ───────────────────────────────────────────────────────
  const Cell = ({ value, highlight, muted }: { value: string | number; highlight?: boolean; muted?: boolean }) => (
    <td className={cn(
      'px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums',
      highlight && Number(value) > 0 ? 'text-success font-semibold' :
      highlight && Number(value) < 0 ? 'text-destructive font-semibold' :
      muted ? 'text-muted-foreground' : 'text-foreground',
    )}>
      {typeof value === 'number' ? fmt(value) : value}
    </td>
  );

  // ── Export to xlsx ────────────────────────────────────────────────────────
  const handleExport = () => {
    const monthLabels = activeMonths.map(m => MONTH_NAMES[m].slice(0, 3));
    const header = ['Category', ...monthLabels, 'Avg'];

    const incomeRows = config.incomeRows.map(r => [
      r.label,
      ...activeMonths.map(m => getTotal(r, m)),
      avg(activeMonths.map(m => getTotal(r, m))),
    ]);
    const expenseRows = config.expenseRows.map(r => [
      r.label,
      ...activeMonths.map(m => getTotal(r, m)),
      avg(activeMonths.map(m => getTotal(r, m))),
    ]);

    const summaryRows = [
      ['Opening Balance', ...activeMonths.map(m => openingBalances[m]), ''],
      ['Total Income', ...monthSummary.map(s => s.income), avg(monthSummary.map(s => s.income))],
      ['Total Expenses', ...monthSummary.map(s => s.expense), avg(monthSummary.map(s => s.expense))],
      ['Net Balance', ...monthSummary.map(s => s.net), avg(monthSummary.map(s => s.net))],
    ];

    const data = [
      ['FINANCE LEDGER', year],
      [],
      ['INCOME'],
      header,
      ...incomeRows,
      ['Total Income', ...monthSummary.map(s => s.income), avg(monthSummary.map(s => s.income))],
      [],
      ['EXPENSES'],
      header,
      ...expenseRows,
      ['Total Expenses', ...monthSummary.map(s => s.expense), avg(monthSummary.map(s => s.expense))],
      [],
      ['MONTHLY SUMMARY'],
      ...summaryRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    XLSX.writeFile(wb, `Ledger_${year}.xlsx`);
    toast.success('Exported!');
  };

  // ── Import from AK Expenses xlsx format ──────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf);
      const ws  = wb.Sheets['Bachelor'] ?? wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][];

      // Detect month header row (row with 'Aug'/'Sep'/'Oct' etc.)
      let headerRow = -1;
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      for (let i = 0; i < raw.length; i++) {
        const found = raw[i].some((c: any) =>
          typeof c === 'string' && monthMap[c.toLowerCase().slice(0, 3)] !== undefined
        );
        if (found) { headerRow = i; break; }
      }
      if (headerRow < 0) { toast.error('Could not detect month columns'); return; }

      // Map column index → month number
      const colMonth: Record<number, number> = {};
      raw[headerRow].forEach((cell: any, ci: number) => {
        if (typeof cell === 'string') {
          const key = cell.toLowerCase().slice(0, 3);
          if (monthMap[key] !== undefined) colMonth[ci] = monthMap[key];
        }
      });

      // Scan rows for income/expense
      let currentSection: 'income' | 'expense' | null = null;
      let importedCount = 0;
      const newConfigIncomeRows: LedgerRow[] = [...config.incomeRows];
      const newConfigExpenseRows: LedgerRow[] = [...config.expenseRows];

      const existingIds = new Set(state.transactions.map(t => t.id));

      for (let ri = headerRow + 1; ri < raw.length; ri++) {
        const row = raw[ri];
        const label = String(row[0] || '').trim();
        if (!label) continue;
        if (/^income$/i.test(label)) { currentSection = 'income'; continue; }
        if (/^expense/i.test(label)) { currentSection = 'expense'; continue; }
        if (/^(total|opening|net|summary|dashboard|bachelor)/i.test(label)) continue;
        if (!currentSection) continue;

        // For each month column with a value
        let addedToConfig = false;
        for (const [ciStr, month] of Object.entries(colMonth)) {
          const ci = Number(ciStr);
          const val = Number(row[ci]);
          if (!val || val <= 0) continue;

          // Create a transaction dated 1st of that month
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          const synthId = `import_${label}_${year}_${month}`;
          // Skip if we already have this synthetic import
          if (existingIds.has(synthId)) continue;

          await addTransaction({
            date: dateStr,
            year,
            month,
            person: 'Ajai',
            type: currentSection,
            category: label,
            amount: val,
            paymentMode: 'bank',
            notes: 'Imported from Excel',
            homeOrDebt: 'home',
          });
          importedCount++;
          addedToConfig = true;
        }

        // Auto-add to config rows if not present
        if (addedToConfig) {
          const existing = currentSection === 'income'
            ? newConfigIncomeRows.find(r => r.category === label)
            : newConfigExpenseRows.find(r => r.category === label);
          if (!existing) {
            const row: LedgerRow = { id: makeId(), label, category: label, type: currentSection };
            if (currentSection === 'income') newConfigIncomeRows.push(row);
            else newConfigExpenseRows.push(row);
          }
        }
      }

      setConfig({ ...config, incomeRows: newConfigIncomeRows, expenseRows: newConfigExpenseRows });
      toast.success(`Imported ${importedCount} entries from Excel`);
    } catch (err: any) {
      toast.error('Import failed: ' + (err?.message || 'Unknown error'));
    }
  };

  if (!loaded) return null;

  return (
    <div className="pb-24 pt-4 px-3 max-w-full animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="p-1 rounded-lg hover:bg-muted/40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{year}</h1>
          <button onClick={() => setYear(y => y + 1)} className="p-1 rounded-lg hover:bg-muted/40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1.5">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1 text-xs h-7 px-2">
            <Upload className="h-3 w-3" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 text-xs h-7 px-2">
            <Download className="h-3 w-3" /> Export
          </Button>
          <Button
            variant={showConfig ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowConfig(v => !v)}
            className="gap-1 text-xs h-7 px-2"
          >
            <Settings2 className="h-3 w-3" /> Configure
          </Button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          allCategories={Array.from(new Set(state.transactions.map(t => t.category))).sort()}
          allPersons={
            state.customPersons?.length
              ? state.customPersons
              : Array.from(new Set(state.transactions.map(t => t.person))).sort()
          }
          incomeSources={state.incomeSources ?? []}
          expenseSources={state.expenseSources ?? []}
          initialBalances={state.initialBalances ?? {}}
          accountBalances={state.accountBalances ?? {}}
          year={year}
          onClose={() => setShowConfig(false)}
        />
      )}

      {config.incomeRows.length === 0 && config.expenseRows.length === 0 ? (
        <EmptyState
          onConfigure={() => setShowConfig(true)}
          hasSettings={(state.incomeSources?.length ?? 0) > 0 || (state.expenseSources?.length ?? 0) > 0}
          onAutoFill={() => {
            const incomeSources = state.incomeSources ?? [];
            const expenseSources = state.expenseSources ?? [];
            const initialBalances = state.initialBalances ?? {};
            const accountBalances = state.accountBalances ?? {};
            const newIncomeRows: LedgerRow[] = incomeSources.map(s => ({ id: makeId(), label: s.name, category: s.name, type: 'income' as const }));
            const newExpenseRows: LedgerRow[] = expenseSources.map(s => ({ id: makeId(), label: s.name, category: s.name, type: 'expense' as const }));
            const totalInitial = Object.values(initialBalances).reduce((s, v) => s + (Number(v) || 0), 0);
            const totalAccounts = Object.values(accountBalances).reduce((s, v) => s + (Number(v) || 0), 0);
            const total = totalInitial + totalAccounts;
            const updated: LedgerConfig = {
              ...config,
              incomeRows: newIncomeRows,
              expenseRows: newExpenseRows,
              openingBalance: total > 0 ? total : config.openingBalance,
              openingYear: year,
            };
            setConfig(updated);
            toast.success(`Auto-filled ${newIncomeRows.length} income + ${newExpenseRows.length} expense rows`);
          }}
        />
      ) : (
        <div ref={tableRef} className="overflow-x-auto rounded-xl border border-border/40 bg-card shadow-sm">
          <table className="w-full border-collapse text-xs min-w-max">
            {/* Month header */}
            <thead>
              <tr className="bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-36 sticky left-0 bg-muted/40">Category</th>
                {activeMonths.map(m => (
                  <th key={m} className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[72px]">
                    {MONTH_NAMES[m].slice(0, 3)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[72px] text-primary/70">Avg</th>
              </tr>
            </thead>
            <tbody>
              {/* ── INCOME ──────────────────────────────────────────────── */}
              <SectionHeader label="INCOME" colCount={activeMonths.length} />
              {config.incomeRows.map(row => (
                <tr key={row.id} className="border-t border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-1.5 text-xs text-foreground sticky left-0 bg-card font-medium">
                    {row.label}
                    {row.person && <span className="ml-1 text-[9px] text-muted-foreground">({row.person})</span>}
                  </td>
                  {activeMonths.map(m => {
                    const v = getTotal(row, m);
                    return <Cell key={m} value={v} highlight />;
                  })}
                  <td className="px-2 py-1.5 text-right text-xs text-primary/80 font-medium tabular-nums">
                    {fmt(avg(activeMonths.map(m => getTotal(row, m))))}
                  </td>
                </tr>
              ))}
              <TotalRow
                label="Total Income"
                values={monthSummary.map(s => s.income)}
                className="bg-success/5 text-success font-bold"
              />

              {/* ── EXPENSES ─────────────────────────────────────────────── */}
              <SectionHeader label="EXPENSES" colCount={activeMonths.length} />
              {config.expenseRows.map(row => (
                <tr key={row.id} className="border-t border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-1.5 text-xs text-foreground sticky left-0 bg-card font-medium">
                    {row.label}
                    {row.person && <span className="ml-1 text-[9px] text-muted-foreground">({row.person})</span>}
                  </td>
                  {activeMonths.map(m => {
                    const v = getTotal(row, m);
                    return (
                      <td key={m} className={cn('px-2 py-1.5 text-right text-xs tabular-nums whitespace-nowrap', v > 0 ? 'text-destructive/80' : 'text-muted-foreground')}>
                        {fmt(v)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right text-xs text-destructive/70 font-medium tabular-nums">
                    {fmt(avg(activeMonths.map(m => getTotal(row, m))))}
                  </td>
                </tr>
              ))}
              <TotalRow
                label="Total Expenses"
                values={monthSummary.map(s => s.expense)}
                className="bg-destructive/5 text-destructive font-bold"
              />

              {/* ── SUMMARY ──────────────────────────────────────────────── */}
              <SectionHeader label="SUMMARY" colCount={activeMonths.length} />
              <tr className="border-t border-border/20 bg-muted/10">
                <td className="px-3 py-1.5 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/10">Opening Balance</td>
                {activeMonths.map(m => (
                  <td key={m} className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground font-medium">
                    {fmt(openingBalances[m] ?? 0)}
                  </td>
                ))}
                <td />
              </tr>
              <tr className="border-t border-border/20">
                <td className="px-3 py-1.5 text-xs font-bold text-foreground sticky left-0 bg-card">Net Balance</td>
                {monthSummary.map(({ month, net }) => (
                  <td key={month} className={cn('px-2 py-1.5 text-right text-xs font-bold tabular-nums', net >= 0 ? 'text-success' : 'text-destructive')}>
                    {fmtSigned(net)}
                  </td>
                ))}
                <td className={cn('px-2 py-1.5 text-right text-xs font-bold tabular-nums',
                  avg(monthSummary.map(s => s.net)) >= 0 ? 'text-success' : 'text-destructive')}>
                  {fmtSigned(avg(monthSummary.map(s => s.net)))}
                </td>
              </tr>
              <tr className="border-t border-border/20 bg-muted/10">
                <td className="px-3 py-1.5 text-xs font-bold text-foreground sticky left-0 bg-muted/10">Closing Balance</td>
                {activeMonths.map((m, i) => {
                  const closing = (openingBalances[m] ?? 0) + monthSummary[i].net;
                  return (
                    <td key={m} className={cn('px-2 py-1.5 text-right text-xs font-bold tabular-nums', closing >= 0 ? 'text-success' : 'text-destructive')}>
                      {fmtSigned(closing)}
                    </td>
                  );
                })}
                <td />
              </tr>

              {/* ── PERSON BREAKDOWN ─────────────────────────────────────── */}
              {config.showPersonBreakdown && config.personRows.length > 0 && (
                <>
                  <SectionHeader label="BY PERSON (Expenses)" colCount={activeMonths.length} />
                  {config.personRows.map(person => (
                    <tr key={person} className="border-t border-border/20 hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-xs font-medium text-foreground sticky left-0 bg-card">{person}</td>
                      {activeMonths.map(m => (
                        <td key={m} className="px-2 py-1.5 text-right text-xs tabular-nums text-foreground">
                          {fmt(getPersonTotal(person, m))}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                        {fmt(avg(activeMonths.map(m => getPersonTotal(person, m))))}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, colCount }: { label: string; colCount: number }) {
  return (
    <tr>
      <td colSpan={colCount + 2} className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-muted-foreground bg-muted/20 uppercase">
        {label}
      </td>
    </tr>
  );
}

function TotalRow({ label, values, className }: { label: string; values: number[]; className: string }) {
  return (
    <tr className={cn('border-t border-border/30', className)}>
      <td className={cn('px-3 py-1.5 text-xs font-bold sticky left-0', className)}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-1.5 text-right text-xs font-bold tabular-nums">{fmt(v)}</td>
      ))}
      <td className="px-2 py-1.5 text-right text-xs font-bold tabular-nums">{fmt(avg(values))}</td>
    </tr>
  );
}

function EmptyState({ onConfigure, onAutoFill, hasSettings }: { onConfigure: () => void; onAutoFill: () => void; hasSettings: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="text-4xl">📊</div>
      <p className="text-sm text-muted-foreground max-w-xs">
        Set up your ledger rows to see income and expense totals across months.
      </p>
      <div className="flex flex-col gap-2 items-center">
        {hasSettings && (
          <Button onClick={onAutoFill} className="gap-2">
            ✨ Auto-fill from Settings
          </Button>
        )}
        <Button variant="outline" onClick={onConfigure} className="gap-2">
          <Settings2 className="h-4 w-4" /> Manual Configure
        </Button>
      </div>
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config, setConfig, allCategories, allPersons, incomeSources, expenseSources,
  initialBalances, accountBalances, year, onClose,
}: {
  config: LedgerConfig;
  setConfig: (c: LedgerConfig) => void;
  allCategories: string[];
  allPersons: string[];
  incomeSources: { id: string; name: string }[];
  expenseSources: { id: string; name: string }[];
  initialBalances: Record<string, number>;
  accountBalances: Record<string, number>;
  year: number;
  onClose: () => void;
}) {
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [openingVal, setOpeningVal] = useState(String(config.openingBalance));
  const [openingMonth, setOpeningMonth] = useState(config.openingMonth);

  const handleAutoFill = () => {
    // Build income rows from incomeSources (de-dup against existing)
    const existingIncomeCats = new Set(config.incomeRows.map(r => r.category));
    const newIncomeRows: LedgerRow[] = incomeSources
      .filter(s => !existingIncomeCats.has(s.name))
      .map(s => ({ id: makeId(), label: s.name, category: s.name, type: 'income' as const }));

    // Build expense rows from expenseSources (de-dup against existing)
    const existingExpenseCats = new Set(config.expenseRows.map(r => r.category));
    const newExpenseRows: LedgerRow[] = expenseSources
      .filter(s => !existingExpenseCats.has(s.name))
      .map(s => ({ id: makeId(), label: s.name, category: s.name, type: 'expense' as const }));

    // Opening balance = sum of all initialBalances (person cash totals)
    const totalInitial = Object.values(initialBalances).reduce((s, v) => s + (Number(v) || 0), 0);
    // Add account balances if set
    const totalAccounts = Object.values(accountBalances).reduce((s, v) => s + (Number(v) || 0), 0);
    const total = totalInitial + totalAccounts;

    const updated: LedgerConfig = {
      ...config,
      incomeRows: [...config.incomeRows, ...newIncomeRows],
      expenseRows: [...config.expenseRows, ...newExpenseRows],
      openingBalance: total > 0 && config.openingBalance === 0 ? total : config.openingBalance,
      openingYear: year,
    };
    setConfig(updated);
    setOpeningVal(String(updated.openingBalance));
    toast.success(
      `Auto-filled ${newIncomeRows.length} income + ${newExpenseRows.length} expense rows` +
      (total > 0 && config.openingBalance === 0 ? ` · Opening balance set to ₹${total.toLocaleString('en-IN')}` : ''),
    );
  };

  const addRow = (type: 'income' | 'expense', category: string) => {
    if (!category.trim()) return;
    const row: LedgerRow = { id: makeId(), label: category.trim(), category: category.trim(), type };
    if (type === 'income') {
      setConfig({ ...config, incomeRows: [...config.incomeRows, row] });
      setNewIncomeCat('');
    } else {
      setConfig({ ...config, expenseRows: [...config.expenseRows, row] });
      setNewExpenseCat('');
    }
  };

  const removeRow = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') setConfig({ ...config, incomeRows: config.incomeRows.filter(r => r.id !== id) });
    else setConfig({ ...config, expenseRows: config.expenseRows.filter(r => r.id !== id) });
  };

  const saveOpening = () => {
    setConfig({ ...config, openingBalance: Number(openingVal) || 0, openingMonth, openingYear: year });
    toast.success('Opening balance saved');
  };

  const togglePerson = (p: string) => {
    const rows = config.personRows.includes(p)
      ? config.personRows.filter(x => x !== p)
      : [...config.personRows, p];
    setConfig({ ...config, personRows: rows, showPersonBreakdown: rows.length > 0 });
  };

  return (
    <div className="mb-4 max-w-lg mx-auto glass-card rounded-xl p-4 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Configure Ledger</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* Auto-fill from Settings */}
      {(incomeSources.length > 0 || expenseSources.length > 0) && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/8 border border-primary/20">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Auto-fill from Settings</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {incomeSources.length} income · {expenseSources.length} expense categories from your settings
            </p>
          </div>
          <Button size="sm" className="h-7 px-3 text-xs shrink-0" onClick={handleAutoFill}>
            Auto-fill
          </Button>
        </div>
      )}

      {/* Opening balance */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Opening Balance</p>
        <div className="flex gap-2 items-center">
          <select
            className="bg-muted/30 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground"
            value={openingMonth}
            onChange={e => setOpeningMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <Input
            type="number"
            value={openingVal}
            onChange={e => setOpeningVal(e.target.value)}
            placeholder="₹ Opening balance"
            className="flex-1 h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-3" onClick={saveOpening}><Check className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Income rows */}
      <RowConfigSection
        label="Income Rows"
        rows={config.incomeRows}
        onRemove={id => removeRow('income', id)}
        newVal={newIncomeCat}
        setNewVal={setNewIncomeCat}
        onAdd={() => addRow('income', newIncomeCat)}
        suggestions={allCategories}
      />

      {/* Expense rows */}
      <RowConfigSection
        label="Expense Rows"
        rows={config.expenseRows}
        onRemove={id => removeRow('expense', id)}
        newVal={newExpenseCat}
        setNewVal={setNewExpenseCat}
        onAdd={() => addRow('expense', newExpenseCat)}
        suggestions={allCategories}
      />

      {/* Person breakdown */}
      {allPersons.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Person Breakdown</p>
          <div className="flex flex-wrap gap-1.5">
            {allPersons.map(p => (
              <button
                key={p}
                onClick={() => togglePerson(p)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  config.personRows.includes(p)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RowConfigSection({
  label, rows, onRemove, newVal, setNewVal, onAdd, suggestions,
}: {
  label: string; rows: LedgerRow[];
  onRemove: (id: string) => void;
  newVal: string; setNewVal: (v: string) => void;
  onAdd: () => void;
  suggestions: string[];
}) {
  const [showSugg, setShowSugg] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(newVal.toLowerCase()) && newVal.length > 0).slice(0, 6);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">No rows yet. Add below.</p>
      )}
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-muted/20 text-xs">
            <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="flex-1 text-foreground">{r.label}</span>
            <button onClick={() => onRemove(r.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={newVal}
            onChange={e => { setNewVal(e.target.value); setShowSugg(true); }}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            placeholder="Category name…"
            className="flex-1 h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-3" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showSugg && filtered.length > 0 && (
          <div className="absolute z-50 top-9 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {filtered.map(s => (
              <button
                key={s}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/40 text-foreground"
                onMouseDown={() => { setNewVal(s); setShowSugg(false); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
