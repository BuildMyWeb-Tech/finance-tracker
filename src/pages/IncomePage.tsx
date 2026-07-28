/**
 * IncomePage.tsx — Updated with:
 * ✅ Time range filter
 * ✅ Category row click → show transactions (mirrors BudgetPage)
 * ✅ AnalyticsCharts (income pie + timeline)
 * ✅ All existing expected/actual/balance logic preserved
 */

import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import { HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES, DEFAULT_EXPECTED_INCOME, ACCOUNTS } from '@/lib/types';
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
function IncomeTxnRow({ t }: { t: Transaction }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const accountName = t.accountId ? ACCOUNTS.find(a => a.id === t.accountId)?.name : null;
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
  category, expected, actual, onEditExpected, transactions,
}: {
  category: string; expected: number; actual: number;
  onEditExpected: (cat: string, val: number) => void;
  transactions: Transaction[];
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
          {transactions.map(t => <IncomeTxnRow key={t.id} t={t} />)}
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

  const customIncome = state.incomeSources || [];
  const customHome = customIncome.filter(s => s.group === 'home');
  const customDebt = customIncome.filter(s => s.group === 'debt');
  const homeCategories = [...HOME_INCOME_CATEGORIES, ...customHome.map(s => s.name)];
  const debtCategories = [...DEBT_INCOME_CATEGORIES, ...customDebt.map(s => s.name)];

  const defaultExpected = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_EXPECTED_INCOME };
    for (const s of customIncome) map[s.name] = s.defaultExpected;
    return map;
  }, [customIncome]);

  const getExpected = (cat: string) =>
    cat in expectedOverrides ? expectedOverrides[cat] : (defaultExpected[cat] ?? 0);
  const handleEditExpected = (cat: string, val: number) =>
    setExpectedOverrides(m => ({ ...m, [cat]: val }));

  // Actuals from range transactions
  const homeActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of rangeTxns)
      if (t.type === 'income' && t.homeOrDebt === 'home')
        map[t.category] = (map[t.category] || 0) + t.amount;
    return map;
  }, [rangeTxns]);

  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of rangeTxns)
      if (t.type === 'income' && t.homeOrDebt === 'debt')
        map[t.category] = (map[t.category] || 0) + t.amount;
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
    for (const cat in map) {
      map[cat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  }, [rangeTxns]);

  // Totals (expected always uses month)
  const homeTotalExpected = homeCategories.reduce((s, c) => s + getExpected(c), 0);
  const homeTotalActual   = homeCategories.reduce((s, c) => s + (homeActuals[c] || 0), 0);
  const homeBalance       = homeTotalExpected - homeTotalActual;

  const debtTotalExpected = debtCategories.reduce((s, c) => s + getExpected(c), 0);
  const debtTotalActual   = debtCategories.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const debtBalance       = debtTotalExpected - debtTotalActual;

  const overallExpected = homeTotalExpected + debtTotalExpected;
  const overallActual   = homeTotalActual   + debtTotalActual;
  const overallBalance  = overallExpected   - overallActual;

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

      {/* ── HOME INCOME TABLE ── */}
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Home Income</h2>
          {customHome.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              +{customHome.length} custom
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
        </div>
        <div className="min-w-[380px]">
          <TableHeader />
          {homeCategories.map(cat => (
            <IncomeRow
              key={cat}
              category={cat}
              expected={getExpected(cat)}
              actual={homeActuals[cat] || 0}
              onEditExpected={handleEditExpected}
              transactions={categoryTxnMap[cat] || []}
            />
          ))}
          <SectionTotal label="Total Home Income"
            expected={homeTotalExpected} actual={homeTotalActual} balance={homeBalance}
            colorCls="bg-success/10 text-success" />
        </div>
      </div>

      {/* ── DEBT INCOME TABLE ── */}
      <div className="glass-card rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
            <TrendingDown className="h-3.5 w-3.5 text-warning" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Debt Income</h2>
          {customDebt.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              +{customDebt.length} custom
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
        </div>
        <div className="min-w-[380px]">
          <TableHeader />
          {debtCategories.map(cat => (
            <IncomeRow
              key={cat}
              category={cat}
              expected={getExpected(cat)}
              actual={debtActuals[cat] || 0}
              onEditExpected={handleEditExpected}
              transactions={categoryTxnMap[cat] || []}
            />
          ))}
          <SectionTotal label="Total Debt Income"
            expected={debtTotalExpected} actual={debtTotalActual} balance={debtBalance}
            colorCls="bg-warning/10 text-warning" />
        </div>
      </div>

      {/* BOTTOM SUMMARY */}
      <div className="glass-card rounded-xl p-4 border border-primary/20 space-y-4">
        <h2 className="text-sm font-semibold text-primary">Overall Income Summary</h2>

        <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">🏠 Home</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Home Expected</span><span className="font-semibold tabular-nums">{fmt(homeTotalExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Home Actual</span><span className="font-semibold text-success tabular-nums">{fmt(homeTotalActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance in Home</span>
            <span className={cn('tabular-nums', homeBalance > 0 ? 'text-warning' : homeBalance < 0 ? 'text-success' : 'text-muted-foreground')}>
              {homeBalance > 0 ? `Short by ${fmt(homeBalance)}` : homeBalance < 0 ? `Extra ${fmt(Math.abs(homeBalance))}` : '✓ On track'}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">💳 Debt</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Debt Expected</span><span className="font-semibold tabular-nums">{fmt(debtTotalExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Debt Actual</span><span className="font-semibold text-success tabular-nums">{fmt(debtTotalActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance in Debt</span>
            <span className={cn('tabular-nums', debtBalance > 0 ? 'text-warning' : debtBalance < 0 ? 'text-success' : 'text-muted-foreground')}>
              {debtBalance > 0 ? `Short by ${fmt(debtBalance)}` : debtBalance < 0 ? `Extra ${fmt(Math.abs(debtBalance))}` : '✓ On track'}
            </span>
          </div>
        </div>

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