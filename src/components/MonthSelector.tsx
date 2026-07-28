/**
 * MonthSelector.tsx — Updated.
 * - Clicking the YEAR number opens YearView popup (new feature).
 * - Calendar icon opens the existing month picker.
 * - Left/Right arrows navigate months as before.
 */

import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { MONTH_NAMES } from '@/lib/types';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMonthTransactions } from '@/lib/financial-store';
import { cn } from '@/lib/utils';
import YearView from './YearView';

export default function MonthSelector() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, state } = useFinance();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [yearViewOpen, setYearViewOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);

  const prev = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };
  const next = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };
  const goToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  const selectMonth = (month: number) => {
    setSelectedYear(viewYear);
    setSelectedMonth(month);
    setCalendarOpen(false);
  };

  // Get summary for each month of the view year
  const monthSummaries = Array.from({ length: 12 }, (_, m) => {
    const txns = getMonthTransactions(state.transactions, viewYear, m);
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const hasTxns = txns.length > 0;
    return { income, expense, net: income - expense, hasTxns, count: txns.length };
  });

  const isCurrentMonth = (m: number) => {
    const now = new Date();
    return viewYear === now.getFullYear() && m === now.getMonth();
  };

  const isSelected = (m: number) => viewYear === selectedYear && m === selectedMonth;

  const fmt = (n: number) => {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return `${n}`;
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={prev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Month name — clicks to today */}
        <button
          onClick={goToday}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {MONTH_NAMES[selectedMonth]}
        </button>

        {/* Year — click to open YearView */}
        <button
          onClick={() => { setYearViewOpen(true); }}
          className="text-sm font-semibold text-primary hover:text-primary/70 transition-colors underline-offset-2 hover:underline"
          title="Open yearly calendar"
        >
          {selectedYear}
        </button>

        <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setViewYear(selectedYear); setCalendarOpen(true); }}
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          title="Month picker"
        >
          <Calendar className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── YearView popup ─────────────────────────────────────────────────── */}
      <YearView
        open={yearViewOpen}
        onClose={() => setYearViewOpen(false)}
        initialYear={selectedYear}
      />

      {/* ── Month picker (existing behaviour, unchanged) ───────────────────── */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold">
                📅 Yearly Calendar — {viewYear}
              </DialogTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setViewYear(v => v - 1)} className="h-7 w-7">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-sm font-bold text-primary w-12 text-center">{viewYear}</span>
                <Button variant="ghost" size="icon" onClick={() => setViewYear(v => v + 1)} className="h-7 w-7">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Year summary */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(() => {
              const yearIncome = monthSummaries.reduce((s, m) => s + m.income, 0);
              const yearExpense = monthSummaries.reduce((s, m) => s + m.expense, 0);
              const activeMonths = monthSummaries.filter(m => m.hasTxns).length;
              return (
                <>
                  <div className="glass-card rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Year Income</p>
                    <p className="text-xs font-bold text-success">₹{fmt(yearIncome)}</p>
                  </div>
                  <div className="glass-card rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Year Expense</p>
                    <p className="text-xs font-bold text-destructive">₹{fmt(yearExpense)}</p>
                  </div>
                  <div className="glass-card rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Active Months</p>
                    <p className="text-xs font-bold text-foreground">{activeMonths}/12</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTH_NAMES.map((name, m) => {
              const summary = monthSummaries[m];
              const selected = isSelected(m);
              const current = isCurrentMonth(m);
              const hasData = summary.hasTxns;

              return (
                <button
                  key={m}
                  onClick={() => selectMonth(m)}
                  className={cn(
                    'relative rounded-xl p-2.5 text-left transition-all border',
                    selected
                      ? 'border-primary bg-primary/15 ring-1 ring-primary'
                      : current
                        ? 'border-success/50 bg-success/8'
                        : hasData
                          ? 'border-border/50 bg-card/50 hover:border-primary/40 hover:bg-primary/5'
                          : 'border-border/30 bg-muted/20 hover:border-border/60',
                    'active:scale-95',
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn('text-xs font-bold',
                      selected ? 'text-primary' : current ? 'text-success' : 'text-foreground')}>
                      {name.slice(0, 3)}
                    </span>
                    {current && <span className="text-[8px] bg-success/20 text-success rounded-full px-1 font-semibold">NOW</span>}
                    {selected && !current && <span className="text-[8px] bg-primary/20 text-primary rounded-full px-1 font-semibold">SEL</span>}
                  </div>

                  {hasData ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-2.5 w-2.5 text-success shrink-0" />
                        <span className="text-[10px] text-success font-medium truncate">₹{fmt(summary.income)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-2.5 w-2.5 text-destructive shrink-0" />
                        <span className="text-[10px] text-destructive font-medium truncate">₹{fmt(summary.expense)}</span>
                      </div>
                      <div className={cn('text-[10px] font-bold', summary.net >= 0 ? 'text-success' : 'text-destructive')}>
                        {summary.net >= 0 ? '+' : ''}₹{fmt(Math.abs(summary.net))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/50 mt-1">No data</p>
                  )}

                  {summary.count > 0 && (
                    <div className="absolute top-1.5 right-1.5 text-[9px] bg-muted/60 text-muted-foreground rounded-full px-1 min-w-[14px] text-center">
                      {summary.count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}