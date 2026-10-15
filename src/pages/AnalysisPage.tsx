/**
 * AnalysisPage.tsx — Desktop-only detailed financial analysis
 * On mobile (< md) the page shows a "use desktop" message.
 */
import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAppData } from '@/hooks/useAppData';
import { getMonthTransactions } from '@/lib/financial-store';
import { MONTH_NAMES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, PieChart as PieIcon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = [
  '#C9A84C','#4CAF73','#ef4444','#3b82f6','#a855f7',
  '#f97316','#06b6d4','#ec4899','#84cc16','#f59e0b',
  '#6366f1','#10b981','#e11d48','#0ea5e9','#8b5cf6',
];

const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

export default function AnalysisPage() {
  const { state, selectedYear, selectedMonth } = useFinance();
  const { customExpense } = useAppData();
  const [tab, setTab] = useState<'trends' | 'categories' | 'mom'>('trends');

  // ── 12-month trend data ───────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const months: { month: string; income: number; expense: number; net: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const txns = getMonthTransactions(state.transactions, selectedYear, m);
      const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      months.push({ month: MONTH_NAMES[m - 1].slice(0, 3), income, expense, net: income - expense });
    }
    return months;
  }, [state.transactions, selectedYear]);

  // ── Category breakdown (selected month) ──────────────────────────────────
  const categoryData = useMemo(() => {
    const txns = getMonthTransactions(state.transactions, selectedYear, selectedMonth)
      .filter(t => t.type === 'expense');
    const map: Record<string, number> = {};
    for (const t of txns) map[t.category] = (map[t.category] || 0) + t.amount;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [state.transactions, selectedYear, selectedMonth]);

  // ── Month-over-month comparison: current vs prev ──────────────────────────
  const momData = useMemo(() => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear  = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const curTxns   = getMonthTransactions(state.transactions, selectedYear, selectedMonth).filter(t => t.type === 'expense');
    const prevTxns  = getMonthTransactions(state.transactions, prevYear, prevMonth).filter(t => t.type === 'expense');
    const allCats = Array.from(new Set([...curTxns, ...prevTxns].map(t => t.category)));
    return allCats.map(cat => ({
      category: cat,
      current:  curTxns.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0),
      previous: prevTxns.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0),
    })).sort((a, b) => b.current - a.current).slice(0, 12);
  }, [state.transactions, selectedYear, selectedMonth]);

  // ── Summary cards ─────────────────────────────────────────────────────────
  const monthTxns  = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
  const totalInc   = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExp   = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings    = totalInc - totalExp;
  const savingsPct = totalInc > 0 ? Math.round((savings / totalInc) * 100) : 0;

  const yearInc  = trendData.reduce((s, m) => s + m.income, 0);
  const yearExp  = trendData.reduce((s, m) => s + m.expense, 0);

  const tabs = [
    { id: 'trends',     label: 'Trends',     icon: TrendingUp  },
    { id: 'categories', label: 'Categories', icon: PieIcon     },
    { id: 'mom',        label: 'MoM Compare',icon: BarChart3   },
  ] as const;

  return (
    <div className="pb-20 px-4 pt-4 max-w-5xl mx-auto space-y-5 animate-slide-up">
      {/* Mobile placeholder */}
      <div className="md:hidden flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <Monitor className="h-12 w-12 text-muted-foreground opacity-40" />
        <h2 className="text-lg font-semibold text-foreground">Desktop view recommended</h2>
        <p className="text-sm text-muted-foreground">
          The Analysis page is optimised for larger screens. Open it on a laptop or desktop for the full experience.
        </p>
      </div>

      {/* Desktop content */}
      <div className="hidden md:block space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Analysis</h1>
          <MonthSelector />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Monthly Income',   value: fmt(totalInc),  color: 'text-success'     },
            { label: 'Monthly Expense',  value: fmt(totalExp),  color: 'text-destructive' },
            { label: 'Monthly Savings',  value: fmt(savings),   color: savings >= 0 ? 'text-success' : 'text-destructive' },
            { label: 'Savings Rate',     value: `${savingsPct}%`, color: savingsPct >= 20 ? 'text-success' : 'text-warning' },
          ].map(c => (
            <div key={c.label} className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className={cn('text-xl font-bold', c.color)}>{c.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{selectedYear} Total Income</p>
            <p className="text-xl font-bold text-success">{fmt(yearInc)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{selectedYear} Total Expense</p>
            <p className="text-xl font-bold text-destructive">{fmt(yearExp)}</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                tab === t.id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Trends tab */}
        {tab === 'trends' && (
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">{selectedYear} Income vs Expense</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1e2318', border: '1px solid #333', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income"  stroke="#4CAF73" strokeWidth={2} dot={false} name="Income"  />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} dot={false} name="Expense" />
                <Line type="monotone" dataKey="net"     stroke="#C9A84C" strokeWidth={1.5} dot={false} name="Net"  strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Categories tab */}
        {tab === 'categories' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Expense by Category — {MONTH_NAMES[selectedMonth - 1]}
              </h3>
              {categoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No expense data</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                      dataKey="value" nameKey="name" paddingAngle={2}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e2318', border: '1px solid #333', borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="glass-card rounded-2xl p-5 overflow-y-auto max-h-[380px]">
              <h3 className="text-sm font-semibold text-foreground mb-3">Breakdown</h3>
              <div className="space-y-2">
                {categoryData.map((c, i) => {
                  const pct = totalExp > 0 ? Math.round((c.value / totalExp) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-foreground flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                      <span className="text-xs font-semibold text-foreground">{fmt(c.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* MoM tab */}
        {tab === 'mom' && (
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {MONTH_NAMES[selectedMonth - 1]} vs {MONTH_NAMES[selectedMonth === 1 ? 11 : selectedMonth - 2]} (Expenses)
            </h3>
            {momData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No data for comparison</p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={momData} margin={{ top: 4, right: 20, bottom: 60, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="category" tick={{ fill: '#888', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#1e2318', border: '1px solid #333', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="current"  name={MONTH_NAMES[selectedMonth - 1].slice(0, 3)} fill="#C9A84C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previous" name={MONTH_NAMES[selectedMonth === 1 ? 11 : selectedMonth - 2].slice(0, 3)} fill="#4CAF7366" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
