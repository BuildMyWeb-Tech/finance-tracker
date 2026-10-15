/**
 * BudgetPage.tsx — Updated with:
 * ✅ Time range filter (Monthly / 3M / 6M / 9M / Yearly)
 * ✅ Overall Usage bar → click → category breakdown
 * ✅ AnalyticsCharts (pie + line) section
 * ✅ All existing expand/collapse row behaviour preserved
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAppData } from '@/hooks/useAppData';
import { getOverspendCategories, getMonthTransactions } from '@/lib/financial-store';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Pencil, Check, X, AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp, BarChart2, Target } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import TimeRangeFilter, { TimeRange, getTransactionsForRange } from '@/components/TimeRangeFilter';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

// ── Mini transaction row ─────────────────────────────────────────────────────
function CategoryTxnRow({ t, accounts }: { t: Transaction; accounts: { id: string; name: string }[] }) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const accountName = t.accountId ? accounts.find((a: { id: string; name: string }) => a.id === t.accountId)?.name : null;
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
  const { state, selectedYear, selectedMonth, setBudget, setOverallBudget } = useFinance();
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingOverall, setEditingOverall] = useState(false);
  const [overallEditVal, setOverallEditVal] = useState('');
  const alertedRef = useRef<Set<string>>(new Set());

  const { transactionGroups, expenseCategoriesByGroup } = useAppData();
  const customExpense = state.expenseSources || [];
  const accounts = state.customAccounts || [];

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
    for (const cat in map)
      map[cat].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return map;
  }, [rangeTxns]);

  // Default budgets from settings
  const defaultBudgets = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of customExpense) map[s.name] = s.defaultBudget;
    return map;
  }, [customExpense]);

  // Budget overrides (user edits inline)
  const [budgetOverrides, setBudgetOverrides] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const getBudget = (cat: string) => {
    if (cat in budgetOverrides) return budgetOverrides[cat];
    const stored = state.budgets.find(b => b.category === cat && b.month === selectedMonth && b.year === selectedYear);
    return stored?.amount ?? (defaultBudgets[cat] ?? 0);
  };

  const handleSave = (category: string) => {
    const val = Number(editValue);
    if (val >= 0) { setBudget(category, val, selectedYear, selectedMonth); setBudgetOverrides(m => ({ ...m, [category]: val })); toast.success(`Budget updated for ${category}`); }
    setEditing(null);
  };

  // Per-group expense data — fully dynamic
  const groupData = useMemo(() =>
    transactionGroups.map(g => {
      const cats = expenseCategoriesByGroup[g.id] || [];
      const rows = cats.map(cat => {
        const budget = getBudget(cat);
        const actual = monthTxns
          .filter(t => t.type === 'expense' && t.homeOrDebt === g.id && t.category === cat)
          .reduce((s, t) => s + t.amount, 0);
        const remaining = budget - actual;
        const percent = budget > 0 ? (actual / budget) * 100 : 0;
        return { category: cat, budget, actual, remaining, percent, overspent: actual > budget };
      });
      const totalBudget  = rows.reduce((s, r) => s + r.budget, 0);
      const totalActual  = rows.reduce((s, r) => s + r.actual, 0);
      const totalBalance = totalBudget - totalActual;
      const overspendAmt = rows.filter(r => r.overspent).reduce((s, r) => s + (r.actual - r.budget), 0);
      return { group: g, rows, totalBudget, totalActual, totalBalance, overspendAmt };
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [transactionGroups, expenseCategoriesByGroup, monthTxns, state.budgets, selectedYear, selectedMonth, budgetOverrides, defaultBudgets]);

  const overallExpected = groupData.reduce((s, g) => s + g.totalBudget, 0);
  const overallActual   = groupData.reduce((s, g) => s + g.totalActual, 0);
  const overallBalance  = overallExpected - overallActual;
  const homeOverspend   = groupData.find(g => g.group.id === 'home')?.overspendAmt ?? 0;
  const homeGroupData = groupData.find(g => g.group.id === 'home');
  const allRowsFlat   = groupData.flatMap(g => g.rows);
  const overspentCount  = allRowsFlat.filter(c => c.overspent).length;
  const nearLimitCount  = allRowsFlat.filter(c => !c.overspent && c.percent >= 80).length;
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
    return allRowsFlat
      .filter(c => c.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .map(c => ({
        name: c.category,
        amount: c.actual,
        pct: Math.round((c.actual / overallActual) * 100),
        overspent: c.overspent,
      }));
  }, [allRowsFlat, overallActual]);

  // ── Overspend alert toasts (fire once per category per month) ──────────────
  useEffect(() => {
    const key = `${selectedYear}-${selectedMonth}`;
    allRowsFlat.forEach(c => {
      if (c.budget > 0 && c.percent >= 80 && !alertedRef.current.has(`${key}-${c.category}`)) {
        alertedRef.current.add(`${key}-${c.category}`);
        const msg = c.overspent
          ? `⚠ ${c.category} overspent by ₹${(c.actual - c.budget).toLocaleString('en-IN')}`
          : `⚠ ${c.category} at ${Math.round(c.percent)}% of budget`;
        toast.warning(msg, { duration: 4000 });
      }
    });
  }, [allRowsFlat, selectedYear, selectedMonth]);

  // ── 6-month sparkline data per category ──────────────────────────────────
  const sparklineData = useMemo(() => {
    const result: Record<string, { m: string; v: number }[]> = {};
    const allCats = allRowsFlat.map(r => r.category);
    for (const cat of allCats) {
      const points: { m: string; v: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let m = selectedMonth - i;
        let y = selectedYear;
        while (m <= 0) { m += 12; y--; }
        const v = state.transactions
          .filter(t => t.type === 'expense' && t.category === cat && t.year === y && t.month === m)
          .reduce((s, t) => s + t.amount, 0);
        points.push({ m: String(m), v });
      }
      result[cat] = points;
    }
    return result;
  }, [allRowsFlat, state.transactions, selectedYear, selectedMonth]);

  // ── Overall budget cap ────────────────────────────────────────────────────
  const overallBudgetCap = state.overallBudget ?? 0;
  const overallCapPct = overallBudgetCap > 0 ? Math.round((overallActual / overallBudgetCap) * 100) : 0;

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

      {/* ── Overall Budget Cap ── */}
      <div className="glass-card rounded-xl p-3 mx-2 flex items-center gap-3">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Overall Budget Cap</span>
            {overallBudgetCap > 0 && (
              <span className={cn('text-xs font-semibold', overallCapPct > 100 ? 'text-destructive' : overallCapPct >= 80 ? 'text-warning' : 'text-success')}>
                {overallCapPct}% of ₹{overallBudgetCap.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {overallBudgetCap > 0 && (
            <Progress
              value={Math.min(overallCapPct, 100)}
              className={cn('h-1.5 mb-1', overallCapPct > 100 ? '[&>div]:bg-destructive' : overallCapPct >= 80 ? '[&>div]:bg-warning' : '[&>div]:bg-success')}
            />
          )}
          {editingOverall ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                className="h-6 text-xs w-28 px-2"
                value={overallEditVal}
                onChange={e => setOverallEditVal(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const v = Number(overallEditVal);
                    if (v >= 0) { await setOverallBudget(v); toast.success('Overall budget saved'); }
                    setEditingOverall(false);
                  }
                  if (e.key === 'Escape') setEditingOverall(false);
                }}
                autoFocus
                placeholder="e.g. 50000"
              />
              <button
                className="text-success"
                onClick={async () => {
                  const v = Number(overallEditVal);
                  if (v >= 0) { await setOverallBudget(v); toast.success('Overall budget saved'); }
                  setEditingOverall(false);
                }}
              ><Check className="h-3.5 w-3.5" /></button>
              <button className="text-muted-foreground" onClick={() => setEditingOverall(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => { setOverallEditVal(String(overallBudgetCap || '')); setEditingOverall(true); }}
            >
              <Pencil className="h-3 w-3" />
              {overallBudgetCap > 0 ? 'Edit cap' : 'Set a monthly cap'}
            </button>
          )}
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

      {/* ── DYNAMIC GROUP EXPENSE TABLES ── */}
      {groupData.map(({ group: g, rows, totalBudget, totalActual, totalBalance, overspendAmt }) => (
        <div key={g.id} className="glass-card rounded-xl p-4 mx-2 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{g.emoji}</span>
            <h2 className="text-sm font-semibold text-foreground">{g.label} Expenses</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Tap row to expand</span>
          </div>
          <div className="min-w-[520px]">
            <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 mb-2 font-semibold border-b border-border/40 pb-2">
              <span className="w-5 shrink-0" />
              <span className="flex-1 min-w-[100px]">Category</span>
              <span className="w-24 text-right shrink-0">Budget</span>
              <span className="w-24 text-right shrink-0">Actual</span>
              <span className="w-24 text-right shrink-0">Balance</span>
              <span className="w-20 text-right shrink-0">Overspend</span>
              <span className="w-16 text-right shrink-0 hidden sm:block">6M Trend</span>
              <span className="w-4 shrink-0" />
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No {g.label} expense sources. Add them in Settings.
              </p>
            ) : (
              <div className="space-y-0">
                {rows.map(c => {
                  const overspendRow = c.overspent ? c.actual - c.budget : 0;
                  const txns = categoryTxnMap[c.category] || [];
                  const isExpanded = expandedCategory === c.category;
                  return (
                    <div key={c.category}>
                      <button
                        className={cn(
                          'w-full rounded-lg px-2 py-2 transition-colors text-left',
                          c.overspent ? 'bg-destructive/8' : c.percent >= 80 ? 'bg-warning/8' : 'hover:bg-muted/20',
                          isExpanded ? 'rounded-b-none border-b-0' : '',
                        )}
                        onClick={() => setExpandedCategory(isExpanded ? null : c.category)}
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
                          <span className={cn('w-20 text-right text-xs font-bold shrink-0', overspendRow > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                            {overspendRow > 0 ? fmt(overspendRow) : '—'}
                          </span>
                          {/* 6-month sparkline */}
                          <div className="w-16 h-8 shrink-0 hidden sm:block">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparklineData[c.category] || []}>
                                <Line type="monotone" dataKey="v" stroke={c.overspent ? '#ef4444' : c.percent >= 80 ? '#f59e0b' : '#4CAF73'} strokeWidth={1.5} dot={false} />
                                <Tooltip
                                  contentStyle={{ background: '#1e2318', border: '1px solid #333', borderRadius: 8, fontSize: 10, padding: '2px 6px' }}
                                  formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                                  labelFormatter={() => ''}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
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
                        <div className={cn('ml-2 mr-2 mb-1 rounded-b-lg border border-t-0 px-3 py-2',
                          c.overspent ? 'bg-destructive/5 border-destructive/15' : 'bg-muted/20 border-border/20')}>
                          {txns.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2 text-center">No transactions recorded</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
                                {txns.length} transaction{txns.length > 1 ? 's' : ''}
                              </p>
                              <div className="space-y-0">
                                {txns.map(t => <CategoryTxnRow key={t.id} t={t} accounts={accounts} />)}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex items-center gap-3 px-2 pt-3 mt-2 border-t border-border/50 text-xs font-bold bg-muted/30 rounded-lg py-2">
                <span className="w-5 shrink-0" />
                <span className="flex-1 min-w-[100px]">Total {g.label} Expenses</span>
                <span className="w-24 text-right shrink-0">{fmt(totalBudget)}</span>
                <span className="w-24 text-right text-destructive shrink-0">{fmt(totalActual)}</span>
                <span className={cn('w-24 text-right shrink-0', totalBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtBal(totalBalance)}</span>
                <span className={cn('w-20 text-right shrink-0', overspendAmt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {overspendAmt > 0 ? fmt(overspendAmt) : '—'}
                </span>
                <span className="w-16 shrink-0 hidden sm:block" />
                <span className="w-4 shrink-0" />
              </div>
            )}
          </div>
        </div>
      ))}

      {/* BOTTOM SUMMARY */}
      <div className="glass-card rounded-xl p-4 mx-2 border border-destructive/20 space-y-4">
        <h2 className="text-sm font-semibold text-destructive">Overall Expenses Summary</h2>
        {groupData.map(({ group: g, totalBudget, totalActual, totalBalance }) => (
          <div key={g.id} className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{g.emoji} {g.label}</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span className="font-semibold tabular-nums">{fmt(totalBudget)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className="font-semibold text-destructive tabular-nums">{fmt(totalActual)}</span></div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-bold text-sm">
              <span>Balance</span>
              <span className={cn('tabular-nums', totalBalance >= 0 ? 'text-success' : 'text-destructive')}>{fmtBal(totalBalance)}</span>
            </div>
          </div>
        ))}
      </div>

      <TransactionForm />
    </div>
  );
}