import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getMonthTransactions,
  getOverspendCategories,
  getBudgetForCategory,
} from '@/lib/financial-store';
import { MONTH_NAMES, EXPENSE_CATEGORIES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingDown, Flame, Target, BarChart2 } from 'lucide-react';

interface MonthOverspend {
  month: number;
  year: number;
  label: string;
  overspentCount: number;
  totalOverspend: number;
  totalBudget: number;
  totalSpent: number;
}

export default function OverspendAnalytics() {
  const { state, selectedYear } = useFinance();

  // ── Build 12-month overspend history for selected year ────────────────────
  const monthlyData = useMemo((): MonthOverspend[] => {
    return Array.from({ length: 12 }, (_, m) => {
      const cats = getOverspendCategories(state.transactions, state.budgets, selectedYear, m);
      const overspent = cats.filter(c => c.overspent);
      const totalBudget = cats.reduce((s, c) => s + c.budget, 0);
      const totalSpent = cats.reduce((s, c) => s + c.actual, 0);
      return {
        month: m,
        year: selectedYear,
        label: MONTH_NAMES[m].slice(0, 3),
        overspentCount: overspent.length,
        totalOverspend: overspent.reduce((s, c) => s + (c.actual - c.budget), 0),
        totalBudget,
        totalSpent,
      };
    });
  }, [state.transactions, state.budgets, selectedYear]);

  // ── Count months with any overspend ──────────────────────────────────────
  const overspentMonthsCount = monthlyData.filter(m => m.overspentCount > 0).length;
  const maxOverspend = Math.max(...monthlyData.map(m => m.totalOverspend), 1);

  // ── Top problem categories across the year ────────────────────────────────
  const categoryProblems = useMemo(() => {
    const map: Record<string, { totalOver: number; monthsOver: number; totalSpent: number; totalBudget: number }> = {};

    for (let m = 0; m < 12; m++) {
      const cats = getOverspendCategories(state.transactions, state.budgets, selectedYear, m);
      for (const c of cats) {
        if (!map[c.category]) map[c.category] = { totalOver: 0, monthsOver: 0, totalSpent: 0, totalBudget: 0 };
        map[c.category].totalSpent += c.actual;
        map[c.category].totalBudget += c.budget;
        if (c.overspent) {
          map[c.category].totalOver += c.actual - c.budget;
          map[c.category].monthsOver += 1;
        }
      }
    }

    return Object.entries(map)
      .filter(([, v]) => v.monthsOver > 0)
      .map(([cat, v]) => ({ category: cat, ...v }))
      .sort((a, b) => b.totalOver - a.totalOver)
      .slice(0, 8);
  }, [state.transactions, state.budgets, selectedYear]);

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const yearTotalOverspend = monthlyData.reduce((s, m) => s + m.totalOverspend, 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Flame className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-lg font-bold text-destructive">{overspentMonthsCount}</p>
          <p className="text-[10px] text-muted-foreground">Months Overspent</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          </div>
          <p className="text-lg font-bold text-warning">{categoryProblems.length}</p>
          <p className="text-[10px] text-muted-foreground">Problem Categories</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          </div>
          <p className="text-sm font-bold text-destructive">
            {yearTotalOverspend > 0 ? `₹${(yearTotalOverspend / 1000).toFixed(0)}k` : '₹0'}
          </p>
          <p className="text-[10px] text-muted-foreground">Year Overspend</p>
        </div>
      </div>

      {/* Monthly trend bar chart */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Monthly Overspend Trend — {selectedYear}</h3>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-24 mb-2">
          {monthlyData.map((m) => {
            const height = m.totalOverspend > 0
              ? Math.max((m.totalOverspend / maxOverspend) * 100, 8)
              : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative flex items-end" style={{ height: '80px' }}>
                  {m.totalOverspend > 0 ? (
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all',
                        m.overspentCount >= 5 ? 'bg-destructive' :
                        m.overspentCount >= 3 ? 'bg-warning' : 'bg-warning/60'
                      )}
                      style={{ height: `${height}%` }}
                      title={`${m.label}: ${fmt(m.totalOverspend)} over`}
                    />
                  ) : (
                    <div className="w-full rounded-t-sm bg-success/20" style={{ height: '4px' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Month labels */}
        <div className="flex gap-1.5">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex-1 text-center">
              <span className={cn(
                'text-[9px] font-medium',
                m.totalOverspend > 0 ? 'text-destructive' : 'text-muted-foreground/50'
              )}>
                {m.label}
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />5+ categories</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" />3-4 categories</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning/60 inline-block" />1-2 categories</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success/20 inline-block" />On track</span>
        </div>
      </div>

      {/* Month-by-month breakdown table */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Month-by-Month Summary</h3>
        <div className="space-y-1.5">
          {monthlyData.map((m) => {
            if (!m.totalSpent && !m.totalBudget) return null;
            const usagePct = m.totalBudget > 0 ? Math.min((m.totalSpent / m.totalBudget) * 100, 120) : 0;
            return (
              <div key={m.month} className={cn(
                'rounded-lg px-3 py-2',
                m.overspentCount > 0 ? 'bg-destructive/5' : 'bg-muted/20'
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-foreground">{MONTH_NAMES[m.month]}</span>
                  <div className="flex items-center gap-2">
                    {m.overspentCount > 0 && (
                      <span className="text-[10px] bg-destructive/15 text-destructive rounded-full px-1.5 py-0.5 font-medium">
                        {m.overspentCount} over
                      </span>
                    )}
                    <span className={cn(
                      'text-xs font-bold',
                      m.totalOverspend > 0 ? 'text-destructive' : 'text-success'
                    )}>
                      {m.totalOverspend > 0 ? `-${fmt(m.totalOverspend)}` : m.totalSpent > 0 ? '✓' : '—'}
                    </span>
                  </div>
                </div>
                {m.totalBudget > 0 && (
                  <Progress
                    value={usagePct}
                    className={cn(
                      'h-1',
                      m.overspentCount > 0 ? '[&>div]:bg-destructive' : '[&>div]:bg-success'
                    )}
                  />
                )}
              </div>
            );
          }).filter(Boolean)}
          {monthlyData.every(m => !m.totalSpent && !m.totalBudget) && (
            <p className="text-sm text-muted-foreground text-center py-4">No expense data for {selectedYear}</p>
          )}
        </div>
      </div>

      {/* Top problem categories */}
      {categoryProblems.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Top Problem Categories</h3>
          </div>
          <div className="space-y-2.5">
            {categoryProblems.map((c, i) => {
              const overPct = c.totalBudget > 0
                ? Math.round(((c.totalSpent - c.totalBudget) / c.totalBudget) * 100)
                : 0;
              return (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground/50 w-4">#{i + 1}</span>
                      <span className="text-xs font-semibold text-foreground">{c.category}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.monthsOver} month{c.monthsOver !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-destructive">{fmt(c.totalOver)} over</span>
                      {overPct > 0 && (
                        <span className="ml-1 text-[10px] text-destructive/70">+{overPct}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Progress
                      value={Math.min((c.totalSpent / Math.max(c.totalBudget, c.totalSpent)) * 100, 100)}
                      className="flex-1 h-1.5 [&>div]:bg-destructive"
                    />
                    <span className="text-[10px] text-muted-foreground w-16 text-right">
                      {fmt(c.totalSpent)} / {fmt(c.totalBudget)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}