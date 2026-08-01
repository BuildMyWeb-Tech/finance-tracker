/**
 * IncomePage.tsx — Updated with:
 * ✅ Time range filter
 * ✅ Category row click → show transactions (mirrors BudgetPage)
 * ✅ AnalyticsCharts (income pie + timeline)
 * ✅ All existing expected/actual/balance logic preserved
 */

import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAppData } from '@/hooks/useAppData';
import { getMonthTransactions } from '@/lib/financial-store';
import type { Transaction } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Pencil, Check, X, TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import TimeRangeFilter, { TimeRange, getTransactionsForRange } from '@/components/TimeRangeFilter';
import AnalyticsCharts from '@/components/AnalyticsCharts';

type ExpectedMap = Record<string, number>;

// ── Mini transaction row for income ─────────────────────────────────────────
function IncomeTxnRow({ t, accounts }: { t: Transaction; accounts: { id: string; name: string }[] }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const accountName = t.accountId ? accounts.find(a => a.id === t.accountId)?.name : null;
  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/20 border-b border-border/15 last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="h-5 w-5 rounded-full bg-success/15 text-success flex items-center justify-center text-[9px] font-bold shrink-0">↑</div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
          {t.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{t.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-right">
        {accountName && (
          <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-1.5 py-0.5 hidden sm:inline">
            {accountName}
          </span>
        )}
        <span className="font-semibold text-success tabular-nums">{fmt(t.amount)}</span>
      </div>
    </div>
  );
}

// ── Income row with expand ───────────────────────────────────────────────────
function IncomeRow({
  category, expected, actual, onEditExpected, transactions, accounts,
}: {
  category: string; expected: number; actual: number;
  onEditExpected: (cat: string, val: number) => void;
  transactions: Transaction[];
  accounts: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(expected));
  const [expanded, setExpanded] = useState(false);
  const balance = expected - actual;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const save = () => {
    const n = Number(val);
    if (!isNaN(n) && n >= 0) { onEditExpected(category, n); toast.success(`Expected updated for ${category}`); }
    setEditing(false);
  };

  return (
    <div className={cn('rounded-xl', actual === 0 ? 'opacity-70' : '')}>
      {/* Main row */}
      <button
        className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs hover:bg-muted/20 transition-colors text-left"
        onClick={() => transactions.length > 0 && setExpanded(o => !o)}
      >
        <span className="flex-1 font-medium text-foreground truncate min-w-0">{category}
          {transactions.length > 0 && (
            <span className="ml-1.5 text-[9px] bg-muted/80 text-muted-foreground rounded px-1 py-0.5">
              {transactions.length}
            </span>
          )}
        </span>

        {/* Expected — editable */}
        <div className="w-24 text-right shrink-0" onClick={e => e.stopPropagation()}>
          {editing ? (
            <div className="flex items-center gap-1 justify-end">
              <Input type="number" className="h-6 w-20 text-xs px-1" value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus />
              <button onClick={save} className="text-success"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditing(false)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1 justify-end w-full hover:text-primary group"
              onClick={() => { setVal(String(expected)); setEditing(true); }}>
              <span className="text-muted-foreground tabular-nums">{fmt(expected)}</span>
              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
            </button>
          )}
        </div>

        <span className={cn('w-20 text-right font-semibold shrink-0 tabular-nums',
          actual > 0 ? 'text-success' : 'text-muted-foreground')}>
          {fmt(actual)}
        </span>
        <span className={cn('w-20 text-right font-bold shrink-0 tabular-nums',
          balance > 0 ? 'text-warning' : balance < 0 ? 'text-success' : 'text-muted-foreground')}>
          {balance > 0 ? `-${fmt(Math.abs(balance))}` : balance < 0 ? `+${fmt(Math.abs(balance))}` : '—'}
        </span>

        {transactions.length > 0 && (
          <div className="w-4 shrink-0 flex justify-center">
            {expanded
              ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
              : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </div>
        )}
      </button>

      {/* Expanded transactions */}
      {expanded && transactions.length > 0 && (
        <div className="ml-2 mr-2 mb-1 rounded-b-lg border border-t-0 bg-success/5 border-success/15 px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
            {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
          </p>
          {transactions.map(t => <IncomeTxnRow key={t.id} t={t} accounts={accounts} />)}
          <div className="flex justify-between text-xs font-bold pt-2 mt-1 border-t border-border/20">
            <span className="text-muted-foreground">Total</span>
            <span className="text-success tabular-nums">{fmt(actual)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncomePage() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const [expectedOverrides, setExpectedOverrides] = useState<ExpectedMap>({});
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Range transactions for display
  const rangeTxns = useMemo(
    () => getTransactionsForRange(state.transactions, selectedYear, selectedMonth, timeRange),
    [state.transactions, selectedYear, selectedMonth, timeRange],
  );

  // Month transactions for expected calculations (always per-month)
  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth],
  );

  const { transactionGroups, incomeCategoriesByGroup } = useAppData();
  const customIncome = state.incomeSources || [];
  const accounts = state.customAccounts || [];

  const defaultExpected = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of customIncome) map[s.name] = s.defaultExpected;
    return map;
  }, [customIncome]);

  const getExpected = (cat: string) =>
    cat in expectedOverrides ? expectedOverrides[cat] : (defaultExpected[cat] ?? 0);
  const handleEditExpected = (cat: string, val: number) =>
    setExpectedOverrides(m => ({ ...m, [cat]: val }));

  // Actuals per group from range transactions
  const actualsByGroup = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const t of rangeTxns) {
      if (t.type !== 'income') continue;
      if (!map[t.homeOrDebt]) map[t.homeOrDebt] = {};
      map[t.homeOrDebt][t.category] = (map[t.homeOrDebt][t.category] || 0) + t.amount;
    }
    return map;
  }, [rangeTxns]);

  // Per-category transaction map (range)
  const categoryTxnMap = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of rangeTxns) {
      if (t.type !== 'income') continue;
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    for (const cat in map)
      map[cat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return map;
  }, [rangeTxns]);

  // Per-group totals — fully dynamic
  const groupTotals = useMemo(() =>
    transactionGroups.map(g => {
      const cats = incomeCategoriesByGroup[g.id] || [];
      const totalExpected = cats.reduce((s, c) => s + getExpected(c), 0);
      const groupActuals  = actualsByGroup[g.id] || {};
      const totalActual   = cats.reduce((s, c) => s + (groupActuals[c] || 0), 0);
      return { group: g, cats, totalExpected, totalActual, balance: totalExpected - totalActual };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactionGroups, incomeCategoriesByGroup, actualsByGroup, expectedOverrides, defaultExpected]);

  const overallExpected = groupTotals.reduce((s, g) => s + g.totalExpected, 0);
  const overallActual   = groupTotals.reduce((s, g) => s + g.totalActual, 0);
  const overallBalance  = overallExpected - overallActual;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const TableHeader = () => (
    <div className="flex items-center gap-2 py-2 px-3 text-xs font-semibold text-muted-foreground border-b border-border/40 mb-1">
      <span className="flex-1 min-w-0">Source</span>
      <span className="w-24 text-right shrink-0">Expected</span>
      <span className="w-20 text-right shrink-0">Actual</span>
      <span className="w-20 text-right shrink-0">Balance</span>
      <span className="w-4 shrink-0" />
    </div>
  );

  const SectionTotal = ({ label, expected, actual, balance, colorCls }: {
    label: string; expected: number; actual: number; balance: number; colorCls: string;
  }) => (
    <div className={cn('flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold mt-1', colorCls)}>
      <span className="flex-1 min-w-0">{label}</span>
      <span className="w-24 text-right shrink-0 tabular-nums">{fmt(expected)}</span>
      <span className="w-20 text-right shrink-0 tabular-nums">{fmt(actual)}</span>
      <span className="w-20 text-right shrink-0 tabular-nums">
        {balance > 0 ? `-${fmt(balance)}` : balance < 0 ? `+${fmt(Math.abs(balance))}` : '—'}
      </span>
      <span className="w-4 shrink-0" />
    </div>
  );

  return (
    <div className="pb-20 px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">Income</h1>
        <div className="flex items-center gap-2">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          <MonthSelector />
        </div>
      </div>

      {/* TOP 3 SUMMARY CARDS */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Expected</p>
          <p className="text-base font-bold text-foreground tabular-nums">{fmt(overallExpected)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Actual</p>
          <p className="text-base font-bold text-success tabular-nums">{fmt(overallActual)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className={cn('text-base font-bold tabular-nums', overallBalance > 0 ? 'text-warning' : overallBalance < 0 ? 'text-success' : 'text-muted-foreground')}>
            {overallBalance > 0 ? `-${fmt(overallBalance)}` : overallBalance < 0 ? `+${fmt(Math.abs(overallBalance))}` : '—'}
          </p>
        </div>
      </div>

      {/* Analytics toggle */}
      {/* <button
        onClick={() => setShowAnalytics(o => !o)}
        className={cn(
          'w-full rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-all',
          showAnalytics
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary',
        )}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        {showAnalytics ? 'Hide Analytics' : 'Show Analytics (Income Charts)'}
      </button> */}

      {showAnalytics && <AnalyticsCharts timeRange={timeRange} />}

      {/* ── DYNAMIC GROUP INCOME TABLES ── */}
      {groupTotals.map(({ group: g, cats, totalExpected, totalActual, balance }) => (
        <div key={g.id} className="glass-card rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-base">
              {g.emoji}
            </div>
            <h2 className="text-sm font-semibold text-foreground">{g.label} Income</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
          </div>
          <div className="min-w-[380px]">
            <TableHeader />
            {cats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No {g.label} income sources. Add them in Settings.
              </p>
            ) : (
              cats.map(cat => (
                <IncomeRow
                  key={cat}
                  category={cat}
                  expected={getExpected(cat)}
                  actual={(actualsByGroup[g.id]?.[cat]) || 0}
                  onEditExpected={handleEditExpected}
                  transactions={categoryTxnMap[cat] || []}
                  accounts={accounts}
                />
              ))
            )}
            <SectionTotal
              label={`Total ${g.label} Income`}
              expected={totalExpected} actual={totalActual} balance={balance}
              colorCls="bg-primary/10 text-primary"
            />
          </div>
        </div>
      ))}

      {/* BOTTOM SUMMARY */}
      <div className="glass-card rounded-xl p-4 border border-primary/20 space-y-4">
        <h2 className="text-sm font-semibold text-primary">Overall Income Summary</h2>

        {groupTotals.map(({ group: g, totalExpected, totalActual, balance }) => (
          <div key={g.id} className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
              {g.emoji} {g.label}
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected</span>
              <span className="font-semibold tabular-nums">{fmt(totalExpected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual</span>
              <span className="font-semibold text-success tabular-nums">{fmt(totalActual)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
              <span>Balance</span>
              <span className={cn('tabular-nums', balance > 0 ? 'text-warning' : balance < 0 ? 'text-success' : 'text-muted-foreground')}>
                {balance > 0 ? `Short by ${fmt(balance)}` : balance < 0 ? `Extra ${fmt(Math.abs(balance))}` : '✓ On track'}
              </span>
            </div>
          </div>
        ))}

        <div className="rounded-xl bg-primary/8 border border-primary/20 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2">📊 Overall</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Overall Expected</span><span className="font-semibold tabular-nums">{fmt(overallExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Overall Actual</span><span className="font-semibold text-success tabular-nums">{fmt(overallActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance</span>
            <span className={cn('tabular-nums', overallBalance > 0 ? 'text-warning' : overallBalance < 0 ? 'text-success' : 'text-muted-foreground')}>
              {overallBalance > 0 ? `Short by ${fmt(overallBalance)}` : overallBalance < 0 ? `Extra ${fmt(Math.abs(overallBalance))}` : '✓ On track'}
            </span>
          </div>
        </div>
      </div>

      <TransactionForm />
    </div>
  );
}