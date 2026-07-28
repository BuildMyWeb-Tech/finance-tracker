/**
 * AnalyticsCharts.tsx — "Where Did Money Go?" pie + Cash Flow timeline line chart.
 * Uses recharts (already in the project via shadcn chart.tsx).
 * Data always sourced from store functions — no manual re-computation.
 */

import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions, getTotalBalance, rc } from '@/lib/financial-store';
import { MONTH_NAMES } from '@/lib/types';
import { groupByDate, buildDaySummary, toDateStr } from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area, AreaChart,
} from 'recharts';

// ── Color palette for pie slices ────────────────────────────────────────────
const COLORS = [
  '#4CAF73', '#E53935', '#C9A84C', '#2196F3', '#9C27B0',
  '#FF7043', '#00BCD4', '#8BC34A', '#FF5722', '#607D8B',
  '#E91E63', '#3F51B5', '#009688', '#FFC107', '#795548',
  '#F44336', '#673AB7', '#03A9F4',
];

type TimeRange = 'monthly' | '3months' | '6months' | '9months' | 'yearly';

interface AnalyticsChartsProps {
  timeRange: TimeRange;
}

export default function AnalyticsCharts({ timeRange }: AnalyticsChartsProps) {
  const { state, selectedYear, selectedMonth } = useFinance();

  // ── Transactions for the selected time range ──────────────────────────────
  const rangeTxns = useMemo(() => {
    if (timeRange === 'monthly') {
      return getMonthTransactions(state.transactions, selectedYear, selectedMonth);
    }
    const months = timeRange === '3months' ? 3 : timeRange === '6months' ? 6 : timeRange === '9months' ? 9 : 12;
    // Collect last N months ending at selected month
    const result: typeof state.transactions = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      result.push(...getMonthTransactions(state.transactions, d.getFullYear(), d.getMonth()));
    }
    return result;
  }, [state.transactions, selectedYear, selectedMonth, timeRange]);

  // ── Category breakdown for pie ────────────────────────────────────────────
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of rangeTxns) {
      if (t.type !== 'expense') continue;
      map[t.category] = rc((map[t.category] || 0) + t.amount);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [rangeTxns]);

  const totalExpense = useMemo(() => categoryData.reduce((s, d) => s + d.value, 0), [categoryData]);

  // ── Daily cash flow for line chart ────────────────────────────────────────
  const cashFlowData = useMemo(() => {
    if (timeRange === 'monthly') {
      // Daily for the month
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const grouped = groupByDate(rangeTxns);
      const opening = getTotalBalance(
        state.transactions, selectedYear, selectedMonth,
        state.initialBalances, state.accountBalances,
      ).opening;

      let running = opening;
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dateStr = toDateStr(selectedYear, selectedMonth, day);
        const txns = grouped.get(dateStr) || [];
        const s = buildDaySummary(dateStr, txns);
        running = rc(running + s.income - s.expense);
        return {
          label: `${day}`,
          balance: running,
          income: s.income,
          expense: s.expense,
        };
      });
    }

    // Monthly for multi-month ranges
    const months = timeRange === '3months' ? 3 : timeRange === '6months' ? 6 : timeRange === '9months' ? 9 : 12;
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(selectedYear, selectedMonth - (months - 1 - i), 1);
      const y = d.getFullYear(), m = d.getMonth();
      const txns = getMonthTransactions(state.transactions, y, m);
      const income  = rc(txns.filter(t => t.type === 'income' ).reduce((s, t) => rc(s + t.amount), 0));
      const expense = rc(txns.filter(t => t.type === 'expense').reduce((s, t) => rc(s + t.amount), 0));
      return { label: MONTH_NAMES[m].slice(0, 3), balance: rc(income - expense), income, expense };
    });
  }, [rangeTxns, state.transactions, state.initialBalances, state.accountBalances, selectedYear, selectedMonth, timeRange]);

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const fmtK = (n: number) => {
    if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000)   return `${(n / 1000).toFixed(0)}k`;
    return `${n}`;
  };

  // Custom tooltip for pie
  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = totalExpense > 0 ? ((d.value / totalExpense) * 100).toFixed(1) : 0;
    return (
      <div className="bg-card border border-border/60 rounded-lg p-2.5 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-0.5">{d.name}</p>
        <p className="text-destructive font-bold">{fmt(d.value)}</p>
        <p className="text-muted-foreground">{pct}% of total</p>
      </div>
    );
  };

  // Custom tooltip for line
  const LineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border/60 rounded-lg p-2.5 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
            {p.name}: {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Pie Chart: Where Did Money Go? ─────────────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          🥧 Where Did Money Go?
          <span className="text-[10px] text-muted-foreground font-normal">
            {totalExpense > 0 ? `Total: ${fmt(totalExpense)}` : 'No expense data'}
          </span>
        </h3>

        {categoryData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No expense data for this period</p>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category legend with percentages */}
            <div className="grid grid-cols-2 gap-1 mt-2">
              {categoryData.map((d, i) => {
                const pct = totalExpense > 0 ? ((d.value / totalExpense) * 100).toFixed(1) : '0';
                return (
                  <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate flex-1">{d.name}</span>
                    <span className="text-foreground font-semibold tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Line Chart: Cash Flow Timeline ─────────────────────────────────── */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          📈 Cash Flow Timeline
          <span className="text-[10px] text-muted-foreground font-normal">
            {timeRange === 'monthly' ? 'Daily balance' : 'Monthly net'}
          </span>
        </h3>

        {cashFlowData.every(d => d.balance === 0 && d.income === 0) ? (
          <p className="text-xs text-muted-foreground text-center py-6">No data for this period</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4CAF73" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4CAF73" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtK}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip content={<LineTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" />
                <Area
                  type="monotone"
                  dataKey="balance"
                  name="Balance"
                  stroke="#4CAF73"
                  strokeWidth={2}
                  fill="url(#balGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}