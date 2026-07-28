/**
 * BudgetPage.tsx — Updated with:
 * ✅ Time range filter (Monthly / 3M / 6M / 9M / Yearly)
 * ✅ Overall Usage bar → click → category breakdown
 * ✅ AnalyticsCharts (pie + line) section
 * ✅ All existing expand/collapse row behaviour preserved
 */

import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getOverspendCategories, getMonthTransactions } from '@/lib/financial-store';
import {
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, DEFAULT_EXPECTED_DEBT_EXPENSE, ACCOUNTS,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Pencil, Check, X, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import TimeRangeFilter, { TimeRange, getTransactionsForRange } from '@/components/TimeRangeFilter';
import AnalyticsCharts from '@/components/AnalyticsCharts';

// ── Mini transaction row ─────────────────────────────────────────────────────
function CategoryTxnRow({ t }: { t: Transaction }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const accountName = t.accountId ? ACCOUNTS.find(a => a.id === t.accountId)?.name : null;
  return (
    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/20 border-b border-border/15 last:border-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="h-5 w-5 rounded-full bg-destructive/15 text-destructive flex items-center justify-center text-[9px] font-bold shrink-0">↓</div>
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
        <span className="font-semibold text-destructive tabular-nums">{fmt(t.amount)}</span>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const { state, selectedYear, selectedMonth, setBudget } = useFinance();
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const customExpense = state.expenseSources || [];
  const customHome = customExpense.filter(s => s.group === 'home');
  const customDebt = customExpense.filter(s => s.group === 'debt');

  // For budget calculations — always use selected month (budgets are per-month)
  const categories = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);

  // For transaction display — use time range
  const rangeTxns = useMemo(
    () => getTransactionsForRange(state.transactions, selectedYear, selectedMonth, timeRange),
    [state.transactions, selectedYear, selectedMonth, timeRange],
  );

  // Monthly txns (for budget overspend — always per-month)
  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth],
  );

  // Per-category txn map (uses range txns for display)
  const categoryTxnMap = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of rangeTxns) {
      if (t.type !== 'expense') continue;
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    for (const cat in map) {
      map[cat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  }, [rangeTxns]);

  // Custom home expense categories (budget from per-month)
  const customHomeCategories = useMemo(() => {
    return customHome.map(s => {
      const actual = monthTxns
        .filter(t => t.type === 'expense' && t.homeOrDebt === 'home' && t.category === s.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const budget = s.defaultBudget;
      const remaining = budget - actual;
      const percent = budget > 0 ? (actual / budget) * 100 : 0;
      return { category: s.name, budget, actual, remaining, percent, overspent: actual > budget };
    });
  }, [monthTxns, customHome]);

  const allHomeCategories = [...categories, ...customHomeCategories];

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedHomeCategory, setExpandedHomeCategory] = useState<string | null>(null);
  const [expandedDebtCategory, setExpandedDebtCategory] = useState<string | null>(null);

  // Debt actuals (range)
  const debtActuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of rangeTxns) {
      if (t.type === 'expense' && t.homeOrDebt === 'debt')
        map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return map;
  }, [rangeTxns]);

  const allDebtCats = [...DEBT_EXPENSE_CATEGORIES, ...customDebt.map(s => s.name)];
  const defaultDebtExpected = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_EXPECTED_DEBT_EXPENSE };
    for (const s of customDebt) map[s.name] = s.defaultBudget;
    return map;
  }, [customDebt]);

  const [debtExpectedOverrides, setDebtExpectedOverrides] = useState<Record<string, number>>({});
  const [editingDebt, setEditingDebt] = useState<string | null>(null);
  const [editDebtValue, setEditDebtValue] = useState('');

  const getDebtExpected = (cat: string) =>
    cat in debtExpectedOverrides ? debtExpectedOverrides[cat] : (defaultDebtExpected[cat] ?? 0);

  const handleSave = (category: string) => {
    const val = Number(editValue);
    if (val >= 0) { setBudget(category, val, selectedYear, selectedMonth); toast.success(`Budget updated for ${category}`); }
    setEditing(null);
  };
  const handleSaveDebt = (cat: string) => {
    const val = Number(editDebtValue);
    if (val >= 0) { setDebtExpectedOverrides(m => ({ ...m, [cat]: val })); toast.success(`Expected updated for ${cat}`); }
    setEditingDebt(null);
  };

  // Totals
  const homeExpected  = allHomeCategories.reduce((s, c) => s + c.budget, 0);
  const homeActual    = allHomeCategories.reduce((s, c) => s + c.actual, 0);
  const homeBalance   = homeExpected - homeActual;
  const debtExpected  = allDebtCats.reduce((s, c) => s + getDebtExpected(c), 0);
  const debtActual    = allDebtCats.reduce((s, c) => s + (debtActuals[c] || 0), 0);
  const debtBalance   = debtExpected - debtActual;
  const overallExpected = homeExpected + debtExpected;
  const overallActual   = homeActual + debtActual;
  const overallBalance  = overallExpected - overallActual;
  const homeOverspend   = allHomeCategories.filter(c => c.overspent).reduce((s, c) => s + (c.actual - c.budget), 0);
  const overspentCount  = allHomeCategories.filter(c => c.overspent).length;
  const nearLimitCount  = allHomeCategories.filter(c => !c.overspent && c.percent >= 80).length;
  const overallUsagePct = overallExpected > 0 ? Math.round((overallActual / overallExpected) * 100) : 0;

  const fmt    = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const fmtBal = (n: number) => n >= 0 ? fmt(n) : `-${fmt(Math.abs(n))}`;

  const statusIcon = (c: { overspent: boolean; percent: number }) => {
    if (c.overspent) return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    if (c.percent >= 80) return <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />;
    return <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />;
  };

  // Category percentages for expanded usage breakdown
  const categoryUsageBreakdown = useMemo(() => {
    if (overallActual === 0) return [];
    return allHomeCategories
      .filter(c => c.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .map(c => ({
        name: c.category,
        amount: c.actual,
        pct: Math.round((c.actual / overallActual) * 100),
        overspent: c.overspent,
      }));
  }, [allHomeCategories, overallActual]);

  return (
    <div className="pb-20 px-2 sm:px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-2 gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-foreground">Expenses</h1>
        <div className="flex items-center gap-2">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          <MonthSelector />
        </div>
      </div>

      {/* TOP 3 SUMMARY CARDS */}
      <div className="grid grid-cols-3 gap-2 px-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Expected</p>
          <p className="text-base font-bold text-foreground">{fmt(overallExpected)}</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Actual</p>
          <p className={cn('text-base font-bold', overallActual > overallExpected ? 'text-destructive' : 'text-foreground')}>
            {fmt(overallActual)}
          </p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Balance</p>
          <p className={cn('text-base font-bold', overallBalance < 0 ? 'text-destructive' : 'text-success')}>
            {fmtBal(overallBalance)}
          </p>
        </div>
      </div>

      {/* ── Overall Usage — CLICKABLE for category breakdown ── */}
      <div className="glass-card rounded-xl p-4 mx-2">
        <button
          className="w-full text-left"
          onClick={() => setUsageExpanded(o => !o)}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Overall Usage</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{overallUsagePct}%</span>
              {usageExpanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
          <Progress
            value={Math.min(overallUsagePct, 100)}
            className={cn('h-2.5', overallActual > overallExpected ? '[&>div]:bg-destructive' : '[&>div]:bg-primary')}
          />
          <div className="flex gap-4 mt-2 text-xs flex-wrap">
            {overspentCount > 0 && (
              <span className="text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{overspentCount} overspent
              </span>
            )}
            {nearLimitCount > 0 && (
              <span className="text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{nearLimitCount} near limit
              </span>
            )}
            {homeOverspend > 0 && (
              <span className="text-destructive font-medium ml-auto">Over by {fmt(homeOverspend)}</span>
            )}
          </div>
        </button>

        {/* Expanded category breakdown */}
        {usageExpanded && categoryUsageBreakdown.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Category Breakdown
            </p>
            {categoryUsageBreakdown.map(c => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={cn('font-medium', c.overspent ? 'text-destructive' : 'text-foreground')}>
                    {c.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">{fmt(c.amount)}</span>
                    <span className={cn('font-bold w-9 text-right', c.overspent ? 'text-destructive' : 'text-foreground')}>
                      {c.pct}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={c.pct}
                  className={cn('h-1.5', c.overspent ? '[&>div]:bg-destructive' : '[&>div]:bg-primary')}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analytics toggle */}
      <div className="px-2">
        <button
          onClick={() => setShowAnalytics(o => !o)}
          className={cn(
            'w-full rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-all',
            showAnalytics
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary',
          )}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>
      </div>

      {showAnalytics && (
        <div className="px-2">
          <AnalyticsCharts timeRange={timeRange} />
        </div>
      )}

      {/* ── HOME EXPENSE TABLE ── */}
      <div className="glass-card rounded-xl p-4 mx-2 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">🏠 Home Expenses</h2>
          {customHome.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              +{customHome.length} custom
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
        </div>
        <div className="min-w-[520px]">
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 mb-2 font-semibold border-b border-border/40 pb-2">
            <span className="w-5 shrink-0" />
            <span className="flex-1 min-w-[100px]">Category</span>
            <span className="w-24 text-right shrink-0">Expected</span>
            <span className="w-24 text-right shrink-0">Actual</span>
            <span className="w-24 text-right shrink-0">Balance</span>
            <span className="w-20 text-right shrink-0">Overspend</span>
            <span className="w-4 shrink-0" />
          </div>
          <div className="space-y-0">
            {allHomeCategories.map(c => {
              const overspendAmt = c.overspent ? c.actual - c.budget : 0;
              const txns = categoryTxnMap[c.category] || [];
              const isExpanded = expandedHomeCategory === c.category;

              return (
                <div key={c.category}>
                  <button
                    className={cn(
                      'w-full rounded-lg px-2 py-2 transition-colors text-left',
                      c.overspent ? 'bg-destructive/8' : c.percent >= 80 ? 'bg-warning/8' : 'hover:bg-muted/20',
                      isExpanded ? 'rounded-b-none border-b-0' : '',
                    )}
                    onClick={() => setExpandedHomeCategory(isExpanded ? null : c.category)}
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(c)}
                      <span className="flex-1 text-xs font-medium text-foreground min-w-[100px] truncate text-left">
                        {c.category}
                        {txns.length > 0 && (
                          <span className="ml-1.5 text-[9px] bg-muted/80 text-muted-foreground rounded px-1 py-0.5">
                            {txns.length}
                          </span>
                        )}
                      </span>
                      {editing === c.category ? (
                        <div className="flex items-center gap-1 w-24 justify-end shrink-0" onClick={e => e.stopPropagation()}>
                          <Input type="number" className="w-20 h-6 text-xs px-1" value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(c.category); if (e.key === 'Escape') setEditing(null); }}
                            autoFocus />
                          <button onClick={e => { e.stopPropagation(); handleSave(c.category); }} className="text-success"><Check className="h-3 w-3" /></button>
                          <button onClick={e => { e.stopPropagation(); setEditing(null); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button
                          className="w-24 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group shrink-0"
                          onClick={e => { e.stopPropagation(); setEditing(c.category); setEditValue(String(c.budget)); }}>
                          {fmt(c.budget)}<Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                        </button>
                      )}
                      <span className={cn('w-24 text-right text-xs font-semibold shrink-0', c.actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                        {fmt(c.actual)}
                      </span>
                      <span className={cn('w-24 text-right text-xs font-bold shrink-0',
                        c.remaining < 0 ? 'text-destructive' : c.remaining < c.budget * 0.2 ? 'text-warning' : 'text-success')}>
                        {fmtBal(c.remaining)}
                      </span>
                      <span className={cn('w-20 text-right text-xs font-bold shrink-0', overspendAmt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {overspendAmt > 0 ? fmt(overspendAmt) : '—'}
                      </span>
                      <div className="w-4 shrink-0 flex justify-center">
                        {txns.length > 0 && (isExpanded
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
                      </div>
                    </div>
                    <div className="mt-1.5 ml-8 mr-4">
                      <Progress value={Math.min(c.percent, 100)}
                        className={cn('h-1',
                          c.overspent ? '[&>div]:bg-destructive' :
                          c.percent >= 80 ? '[&>div]:bg-warning' : '[&>div]:bg-success')} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={cn(
                      'ml-2 mr-2 mb-1 rounded-b-lg border border-t-0 px-3 py-2',
                      c.overspent ? 'bg-destructive/5 border-destructive/15' :
                      c.percent >= 80 ? 'bg-warning/5 border-warning/15' :
                      'bg-muted/20 border-border/20',
                    )}>
                      {txns.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No transactions recorded</p>
                      ) : (
                        <>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
                            {txns.length} transaction{txns.length > 1 ? 's' : ''}
                          </p>
                          <div className="space-y-0">
                            {txns.map(t => <CategoryTxnRow key={t.id} t={t} />)}
                          </div>
                          <div className="flex justify-between text-xs font-bold pt-2 mt-1 border-t border-border/20">
                            <span className="text-muted-foreground">Total</span>
                            <span className="text-destructive tabular-nums">{fmt(c.actual)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 px-2 pt-3 mt-2 border-t border-border/50 text-xs font-bold bg-muted/30 rounded-lg py-2">
            <span className="w-5 shrink-0" />
            <span className="flex-1 min-w-[100px]">Total Home Expenses</span>
            <span className="w-24 text-right shrink-0">{fmt(homeExpected)}</span>
            <span className="w-24 text-right text-destructive shrink-0">{fmt(homeActual)}</span>
            <span className={cn('w-24 text-right shrink-0', homeBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {fmtBal(homeBalance)}
            </span>
            <span className={cn('w-20 text-right shrink-0', homeOverspend > 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {homeOverspend > 0 ? fmt(homeOverspend) : '—'}
            </span>
            <span className="w-4 shrink-0" />
          </div>
        </div>
      </div>

      {/* ── DEBT EXPENSE TABLE ── */}
      <div className="glass-card rounded-xl p-4 mx-2 overflow-x-auto">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">💳 Debt Expenses</h2>
          {customDebt.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              +{customDebt.length} custom
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
        </div>
        <div className="min-w-[520px]">
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 mb-2 font-semibold border-b border-border/40 pb-2">
            <span className="w-5 shrink-0" />
            <span className="flex-1 min-w-[100px]">Category</span>
            <span className="w-24 text-right shrink-0">Expected</span>
            <span className="w-24 text-right shrink-0">Actual</span>
            <span className="w-24 text-right shrink-0">Balance</span>
            <span className="w-20 text-right shrink-0">Overspend</span>
            <span className="w-4 shrink-0" />
          </div>
          <div className="space-y-0">
            {allDebtCats.map(cat => {
              const exp    = getDebtExpected(cat);
              const actual = debtActuals[cat] || 0;
              const bal    = exp - actual;
              const over   = actual > exp && exp > 0;
              const overspendAmt = over ? actual - exp : 0;
              const txns = categoryTxnMap[cat] || [];
              const isExpanded = expandedDebtCategory === cat;

              return (
                <div key={cat}>
                  <button
                    className={cn(
                      'w-full rounded-lg px-2 py-2 transition-colors text-left',
                      over ? 'bg-destructive/8 hover:bg-destructive/12' : 'hover:bg-muted/20',
                      isExpanded ? 'rounded-b-none' : '',
                    )}
                    onClick={() => setExpandedDebtCategory(isExpanded ? null : cat)}
                  >
                    <div className="flex items-center gap-3">
                      {over
                        ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        : <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 opacity-50" />}
                      <span className="flex-1 text-xs font-medium text-foreground min-w-[100px] truncate">
                        {cat}
                        {txns.length > 0 && (
                          <span className="ml-1.5 text-[9px] bg-muted/80 text-muted-foreground rounded px-1 py-0.5">
                            {txns.length}
                          </span>
                        )}
                      </span>
                      {editingDebt === cat ? (
                        <div className="flex items-center gap-1 w-24 justify-end shrink-0" onClick={e => e.stopPropagation()}>
                          <Input type="number" className="w-20 h-6 text-xs px-1" value={editDebtValue}
                            onChange={e => setEditDebtValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveDebt(cat); if (e.key === 'Escape') setEditingDebt(null); }}
                            autoFocus />
                          <button onClick={e => { e.stopPropagation(); handleSaveDebt(cat); }} className="text-success"><Check className="h-3 w-3" /></button>
                          <button onClick={e => { e.stopPropagation(); setEditingDebt(null); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <button
                          className="w-24 text-right text-xs text-muted-foreground hover:text-primary flex items-center justify-end gap-0.5 group shrink-0"
                          onClick={e => { e.stopPropagation(); setEditingDebt(cat); setEditDebtValue(String(exp)); }}>
                          {fmt(exp)}<Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60" />
                        </button>
                      )}
                      <span className={cn('w-24 text-right text-xs font-semibold shrink-0', actual > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                        {fmt(actual)}
                      </span>
                      <span className={cn('w-24 text-right text-xs font-bold shrink-0', bal >= 0 ? 'text-success' : 'text-destructive')}>
                        {fmtBal(bal)}
                      </span>
                      <span className={cn('w-20 text-right text-xs font-bold shrink-0', overspendAmt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {overspendAmt > 0 ? fmt(overspendAmt) : '—'}
                      </span>
                      <div className="w-4 shrink-0 flex justify-center">
                        {txns.length > 0 && (isExpanded
                          ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={cn(
                      'ml-2 mr-2 mb-1 rounded-b-lg border border-t-0 px-3 py-2',
                      over ? 'bg-destructive/5 border-destructive/15' : 'bg-muted/20 border-border/20',
                    )}>
                      {txns.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No transactions recorded</p>
                      ) : (
                        <>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
                            {txns.length} transaction{txns.length > 1 ? 's' : ''}
                          </p>
                          <div className="space-y-0">
                            {txns.map(t => <CategoryTxnRow key={t.id} t={t} />)}
                          </div>
                          <div className="flex justify-between text-xs font-bold pt-2 mt-1 border-t border-border/20">
                            <span className="text-muted-foreground">Total</span>
                            <span className="text-destructive tabular-nums">{fmt(actual)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 px-2 pt-3 mt-2 border-t border-border/50 text-xs font-bold bg-muted/30 rounded-lg py-2">
            <span className="w-5 shrink-0" />
            <span className="flex-1 min-w-[100px]">Total Debt Expenses</span>
            <span className="w-24 text-right shrink-0">{fmt(debtExpected)}</span>
            <span className="w-24 text-right text-destructive shrink-0">{fmt(debtActual)}</span>
            <span className={cn('w-24 text-right shrink-0', debtBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {fmtBal(debtBalance)}
            </span>
            <span className="w-20 text-right text-muted-foreground shrink-0">—</span>
            <span className="w-4 shrink-0" />
          </div>
        </div>
      </div>

      {/* BOTTOM SUMMARY */}
      <div className="glass-card rounded-xl p-4 mx-2 border border-destructive/20 space-y-4">
        <h2 className="text-sm font-semibold text-destructive">Overall Expenses Summary</h2>
        <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">🏠 Home</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Home Expected</span><span className="font-semibold tabular-nums">{fmt(homeExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Home Actual</span><span className="font-semibold text-destructive tabular-nums">{fmt(homeActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance in Home</span>
            <span className={cn('tabular-nums', homeBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtBal(homeBalance)}</span>
          </div>
        </div>
        <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">💳 Debt</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Debt Expected</span><span className="font-semibold tabular-nums">{fmt(debtExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Debt Actual</span><span className="font-semibold text-destructive tabular-nums">{fmt(debtActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance in Debt</span>
            <span className={cn('tabular-nums', debtBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtBal(debtBalance)}</span>
          </div>
        </div>
        <div className="rounded-xl bg-primary/8 border border-primary/20 p-3 space-y-1.5 text-xs">
          <p className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2">📊 Overall</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Overall Expected</span><span className="font-semibold tabular-nums">{fmt(overallExpected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Overall Actual</span><span className="font-semibold text-destructive tabular-nums">{fmt(overallActual)}</span></div>
          <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
            <span>Balance</span>
            <span className={cn('tabular-nums', overallBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {overallBalance >= 0 ? `Under by ${fmt(overallBalance)}` : `Over by ${fmt(Math.abs(overallBalance))}`}
            </span>
          </div>
          {homeOverspend > 0 && (
            <div className="flex justify-between border-t border-border/40 pt-1.5">
              <span className="text-muted-foreground">Home Overspend</span>
              <span className="font-bold text-destructive tabular-nums">{fmt(homeOverspend)}</span>
            </div>
          )}
        </div>
      </div>

      <TransactionForm />
    </div>
  );
}