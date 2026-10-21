/**
 * SummaryPage.tsx
 * Monthly Summary + Expense by Person (custom groups).
 * Layout mirrors the Excel sheet: months as columns, categories as rows.
 */

import { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { useAppData } from '@/hooks/useAppData';
import { MONTH_NAMES, SummaryConfig, SummaryGroup } from '@/lib/types';
import { getMonthTransactions } from '@/lib/financial-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings2, Plus, Trash2, X, Check, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

const fmt = (n: number) =>
  n === 0 ? '—' : Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtSigned = (n: number) =>
  n === 0 ? '—' : (n >= 0 ? '' : '-') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function avg(nums: number[]) {
  const nz = nums.filter(n => n !== 0);
  return nz.length ? Math.round(nz.reduce((a, b) => a + b, 0) / nz.length) : 0;
}

function total(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function defaultSummaryConfig(): SummaryConfig {
  return {
    groups: [],
    openingBalance: 0,
    openingMonth: 1,
    openingYear: new Date().getFullYear(),
  };
}

// ─── Sticky header/label cell ────────────────────────────────────────────────

function LabelCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn(
      'sticky left-0 z-10 px-3 py-2 text-xs font-medium whitespace-nowrap bg-card border-r border-border/20',
      className,
    )}>
      {children}
    </td>
  );
}

function NumCell({ value, color, bold }: { value: number; color?: string; bold?: boolean }) {
  return (
    <td className={cn(
      'px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap',
      bold && 'font-bold',
      color,
    )}>
      {fmtSigned(value)}
    </td>
  );
}

function AvgCell({ value, color, bold }: { value: number; color?: string; bold?: boolean }) {
  return (
    <td className={cn(
      'px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap bg-primary/5',
      bold && 'font-bold',
      color,
    )}>
      {fmtSigned(value)}
    </td>
  );
}

function TotalCell({ value, color, bold }: { value: number; color?: string; bold?: boolean }) {
  return (
    <td className={cn(
      'px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap bg-muted/20',
      bold && 'font-bold',
      color,
    )}>
      {fmtSigned(value)}
    </td>
  );
}

// ─── Section header row ───────────────────────────────────────────────────────

function SectionHeaderRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-white bg-primary sticky left-0"
      >
        {label}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SummaryPage() {
  const { state, setSummaryConfig } = useFinance();
  const { customExpense } = useAppData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [showConfig, setShowConfig] = useState(false);

  // Load config from state
  const config: SummaryConfig = useMemo(
    () => ({ ...defaultSummaryConfig(), ...(state.summaryConfig ?? {}) }),
    [state.summaryConfig],
  );

  // Which months have data this year
  const activeMonths = useMemo(() => {
    const set = new Set<number>();
    state.transactions.filter(t => t.year === year).forEach(t => set.add(t.month));
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [new Date().getMonth() + 1];
  }, [state.transactions, year]);

  // Per-month income / expense totals
  const monthlyData = useMemo(() => {
    return activeMonths.map(m => {
      const txns = getMonthTransactions(state.transactions, year, m);
      const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return { month: m, income, expense, net: income - expense };
    });
  }, [state.transactions, year, activeMonths]);

  // Opening / closing balance chain
  const prevBalances = useMemo(() => {
    const map: Record<number, number> = {};
    activeMonths.forEach((m, i) => {
      if (i === 0) {
        map[m] =
          config.openingYear === year && config.openingMonth === m
            ? config.openingBalance
            : 0;
      } else {
        const prev = activeMonths[i - 1];
        map[m] = map[prev] + monthlyData[i - 1].net;
      }
    });
    return map;
  }, [activeMonths, monthlyData, config, year]);

  // Per-group totals
  const groupMonthTotals = useMemo(() => {
    return config.groups.map(g => {
      const vals = activeMonths.map(m =>
        state.transactions
          .filter(t =>
            t.year === year &&
            t.month === m &&
            t.type === 'expense' &&
            g.categories.includes(t.category),
          )
          .reduce((s, t) => s + t.amount, 0),
      );
      return { group: g, vals };
    });
  }, [config.groups, activeMonths, state.transactions, year]);

  // "Total" row = sum of groups flagged includeInTotal
  const totalRowVals = useMemo(() => {
    const inTotal = groupMonthTotals.filter(gd => gd.group.includeInTotal);
    return activeMonths.map((_, i) =>
      inTotal.reduce((s, gd) => s + gd.vals[i], 0),
    );
  }, [groupMonthTotals, activeMonths]);

  const colCount = activeMonths.length + 3; // months + Avg + Total + label

  return (
    <div className="pb-24 pt-4 px-3 max-w-full animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="p-1 rounded-lg hover:bg-muted/40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{year}</h1>
          <button onClick={() => setYear(y => y + 1)} className="p-1 rounded-lg hover:bg-muted/40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Button
          variant={showConfig ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowConfig(v => !v)}
          className="gap-1 text-xs h-7 px-2"
        >
          <Settings2 className="h-3 w-3" /> Configure
        </Button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <ConfigPanel
          config={config}
          setConfig={cfg => { setSummaryConfig(cfg); }}
          allExpenseCategories={
            customExpense.length
              ? customExpense.map(s => s.name)
              : Array.from(new Set(state.transactions.filter(t => t.type === 'expense').map(t => t.category))).sort()
          }
          year={year}
          onClose={() => setShowConfig(false)}
        />
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card shadow-sm">
        <table className="w-full border-collapse text-xs min-w-max">
          <thead>
            <tr className="bg-muted/30">
              <th className="sticky left-0 z-20 px-3 py-2 text-left text-xs font-semibold text-muted-foreground bg-muted/40 min-w-[140px]" />
              {activeMonths.map(m => (
                <th key={m} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground min-w-[72px]">
                  {MONTH_NAMES[m - 1].slice(0, 3)}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold text-primary/70 bg-primary/5 min-w-[68px]">Avg</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground bg-muted/20 min-w-[72px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {/* ── MONTHLY SUMMARY ── */}
            <SectionHeaderRow label="Monthly Summary" colSpan={colCount} />

            {/* Prev Month Balance */}
            <tr className="border-t border-border/20 bg-blue-500/5">
              <LabelCell className="text-blue-400">Prev Month Balance</LabelCell>
              {activeMonths.map(m => (
                <td key={m} className="px-3 py-2 text-right text-xs tabular-nums text-blue-400 font-medium">
                  {fmtSigned(prevBalances[m] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2 bg-primary/5" />
              <td className="px-3 py-2 bg-muted/20" />
            </tr>

            {/* Total Income */}
            <tr className="border-t border-border/20 bg-success/5">
              <LabelCell className="text-success">Total Income</LabelCell>
              {monthlyData.map(d => (
                <NumCell key={d.month} value={d.income} color="text-success" />
              ))}
              <AvgCell value={avg(monthlyData.map(d => d.income))} color="text-success" />
              <TotalCell value={total(monthlyData.map(d => d.income))} color="text-success" />
            </tr>

            {/* Total Expenses */}
            <tr className="border-t border-border/20 bg-destructive/5">
              <LabelCell className="text-destructive">Total Expenses</LabelCell>
              {monthlyData.map(d => (
                <NumCell key={d.month} value={d.expense} color="text-destructive" />
              ))}
              <AvgCell value={avg(monthlyData.map(d => d.expense))} color="text-destructive" />
              <TotalCell value={total(monthlyData.map(d => d.expense))} color="text-destructive" />
            </tr>

            {/* Net Balance */}
            <tr className="border-t-2 border-border/50">
              <LabelCell className="font-bold text-foreground">Net Balance</LabelCell>
              {monthlyData.map(d => (
                <NumCell key={d.month} value={d.net} color={d.net >= 0 ? 'text-success' : 'text-destructive'} bold />
              ))}
              <AvgCell value={avg(monthlyData.map(d => d.net))} color={avg(monthlyData.map(d => d.net)) >= 0 ? 'text-success' : 'text-destructive'} bold />
              <TotalCell value={total(monthlyData.map(d => d.net))} color={total(monthlyData.map(d => d.net)) >= 0 ? 'text-success' : 'text-destructive'} bold />
            </tr>

            {/* ── EXPENSE BY PERSON ── */}
            {config.groups.length > 0 && (
              <>
                <SectionHeaderRow label="Expense by Person" colSpan={colCount} />

                {/* Column sub-header */}
                <tr className="bg-muted/10">
                  <LabelCell className="font-semibold text-muted-foreground">Person</LabelCell>
                  {activeMonths.map(m => (
                    <td key={m} className="px-3 py-1.5 text-right text-[10px] font-semibold text-muted-foreground">
                      {MONTH_NAMES[m - 1].slice(0, 3)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-primary/70 bg-primary/5">Avg</td>
                  <td className="px-3 py-1.5 text-right text-[10px] font-semibold text-muted-foreground bg-muted/20">Total</td>
                </tr>

                {groupMonthTotals.map(({ group, vals }) => (
                  <tr key={group.id} className="border-t border-border/20 hover:bg-muted/10 transition-colors">
                    <LabelCell>{group.name}</LabelCell>
                    {vals.map((v, i) => (
                      <td key={activeMonths[i]} className="px-3 py-2 text-right text-xs tabular-nums text-foreground">
                        {fmt(v)}
                      </td>
                    ))}
                    <AvgCell value={avg(vals)} />
                    <TotalCell value={total(vals)} />
                  </tr>
                ))}

                {/* Total row */}
                {config.groups.some(g => g.includeInTotal) && (
                  <tr className="border-t-2 border-border/50 bg-yellow-500/5">
                    <LabelCell className="font-bold text-foreground">
                      Total {config.groups.filter(g => g.includeInTotal).map(g => g.name).join(' + ')}
                    </LabelCell>
                    {totalRowVals.map((v, i) => (
                      <td key={activeMonths[i]} className="px-3 py-2 text-right text-xs font-bold tabular-nums text-foreground">
                        {fmt(v)}
                      </td>
                    ))}
                    <AvgCell value={avg(totalRowVals)} bold />
                    <TotalCell value={total(totalRowVals)} bold />
                  </tr>
                )}
              </>
            )}

            {config.groups.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No groups configured. Tap <strong>Configure</strong> to add expense groups.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  config, setConfig, allExpenseCategories, year, onClose,
}: {
  config: SummaryConfig;
  setConfig: (c: SummaryConfig) => void;
  allExpenseCategories: string[];
  year: number;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<SummaryGroup[]>(() => config.groups);
  const [newGroupName, setNewGroupName] = useState('');
  const [openingVal, setOpeningVal] = useState(String(config.openingBalance));
  const [openingMonth, setOpeningMonth] = useState(config.openingMonth);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const save = (g: SummaryGroup[]) => {
    const updated: SummaryConfig = {
      ...config,
      groups: g,
      openingBalance: Number(openingVal) || 0,
      openingMonth,
      openingYear: year,
    };
    setConfig(updated);
    toast.success('Config saved');
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const g: SummaryGroup = { id: makeId(), name: newGroupName.trim(), categories: [], includeInTotal: true };
    const updated = [...groups, g];
    setGroups(updated);
    setNewGroupName('');
    setExpandedGroup(g.id);
    save(updated);
  };

  const removeGroup = (id: string) => {
    const updated = groups.filter(g => g.id !== id);
    setGroups(updated);
    save(updated);
  };

  const renameGroup = (id: string, name: string) => {
    const updated = groups.map(g => g.id === id ? { ...g, name } : g);
    setGroups(updated);
    save(updated);
  };

  const toggleCategory = (groupId: string, cat: string) => {
    const updated = groups.map(g => {
      if (g.id !== groupId) return g;
      const cats = g.categories.includes(cat)
        ? g.categories.filter(c => c !== cat)
        : [...g.categories, cat];
      return { ...g, categories: cats };
    });
    setGroups(updated);
    save(updated);
  };

  const toggleInTotal = (id: string) => {
    const updated = groups.map(g => g.id === id ? { ...g, includeInTotal: !g.includeInTotal } : g);
    setGroups(updated);
    save(updated);
  };

  const saveOpening = () => {
    const updated: SummaryConfig = {
      ...config,
      groups,
      openingBalance: Number(openingVal) || 0,
      openingMonth,
      openingYear: year,
    };
    setConfig(updated);
    toast.success('Opening balance saved');
  };

  return (
    <div className="mb-4 max-w-2xl mx-auto glass-card rounded-xl p-4 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Configure Summary</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      {/* Opening balance */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Opening Balance ({year})</p>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="bg-muted/30 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground"
            value={openingMonth}
            onChange={e => setOpeningMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <Input
            type="number"
            value={openingVal}
            onChange={e => setOpeningVal(e.target.value)}
            placeholder="₹ Opening balance"
            className="flex-1 h-8 text-xs min-w-[120px]"
          />
          <Button size="sm" className="h-8 px-3" onClick={saveOpening}><Check className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">Expense Groups</p>
        <p className="text-[11px] text-muted-foreground">Each group sums the selected categories. Tap a group to assign categories.</p>

        {groups.map(g => (
          <div key={g.id} className="rounded-xl border border-border/30 overflow-hidden">
            {/* Group header row */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
              <button
                className="flex-1 text-left text-xs font-semibold text-foreground"
                onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}
              >
                {g.name}
                <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                  {g.categories.length} categories
                </span>
              </button>

              {/* Include in total toggle */}
              <button
                onClick={() => toggleInTotal(g.id)}
                title="Include in Total row"
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  g.includeInTotal
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'border-border/40 text-muted-foreground',
                )}
              >
                {g.includeInTotal ? '∑ in total' : 'exclude'}
              </button>

              <button
                onClick={() => removeGroup(g.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Category checkboxes */}
            {expandedGroup === g.id && (
              <div className="px-3 py-2 bg-card border-t border-border/20">
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                  {allExpenseCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(g.id, cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs border transition-colors',
                        g.categories.includes(cat)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {allExpenseCategories.length === 0 && (
                  <p className="text-xs text-muted-foreground">No expense categories found. Add transactions or expense sources in Settings.</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add group */}
        <div className="flex gap-2">
          <Input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()}
            placeholder="New group name (e.g. Ajai Personal)"
            className="flex-1 h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-3" onClick={addGroup}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
