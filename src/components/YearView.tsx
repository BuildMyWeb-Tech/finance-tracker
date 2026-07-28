/**
 * YearView.tsx — Yearly calendar popup.
 * Shows all 12 months with FULL values (no k/L abbreviation per spec).
 * Left/Right arrows navigate years. Click month → opens MonthView.
 */

import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions, rc } from '@/lib/financial-store';
import { MONTH_NAMES } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MonthView from './MonthView';

interface YearViewProps {
  open: boolean;
  onClose: () => void;
  initialYear: number;
}

export default function YearView({ open, onClose, initialYear }: YearViewProps) {
  const { state, setSelectedYear, setSelectedMonth } = useFinance();
  const [viewYear, setViewYear] = useState(initialYear);
  const [monthView, setMonthView] = useState<{ year: number; month: number } | null>(null);

  // Compute all 12 month summaries for the view year
  const monthSummaries = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const txns = getMonthTransactions(state.transactions, viewYear, m);
      const income  = rc(txns.filter(t => t.type === 'income' ).reduce((s, t) => rc(s + t.amount), 0));
      const expense = rc(txns.filter(t => t.type === 'expense').reduce((s, t) => rc(s + t.amount), 0));
      return { month: m, income, expense, balance: rc(income - expense), txnCount: txns.length };
    });
  }, [state.transactions, viewYear]);

  const yearTotals = useMemo(() => ({
    income:  rc(monthSummaries.reduce((s, m) => rc(s + m.income),  0)),
    expense: rc(monthSummaries.reduce((s, m) => rc(s + m.expense), 0)),
    balance: rc(monthSummaries.reduce((s, m) => rc(s + m.balance), 0)),
  }), [monthSummaries]);

  const now = new Date();
  const isCurrentMonth = (m: number) => viewYear === now.getFullYear() && m === now.getMonth();

  // Full format — no abbreviation per spec
  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  const handleMonthClick = (m: number) => {
    setMonthView({ year: viewYear, month: m });
  };

  const handleMonthSelect = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onClose();
  };

  if (monthView) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-4">
          <MonthView
            year={monthView.year}
            month={monthView.month}
            onBack={() => setMonthView(null)}
            onChangeMonth={(y, m) => setMonthView({ year: y, month: m })}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader className="pb-0">
          {/* Year navigation */}
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground">
              📅 Yearly Calendar
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setViewYear(y => y - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <button
                className="text-sm font-bold text-primary w-14 text-center hover:text-primary/80 transition-colors"
                onClick={() => setViewYear(now.getFullYear())}
                title="Go to current year"
              >
                {viewYear}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setViewYear(y => y + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Year totals banner */}
        <div className="grid grid-cols-3 gap-2 my-3">
          <div className="rounded-xl bg-success/10 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <p className="text-[9px] text-muted-foreground">Year Income</p>
            </div>
            <p className="text-xs font-bold text-success tabular-nums">{fmt(yearTotals.income)}</p>
          </div>
          <div className="rounded-xl bg-destructive/10 p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <p className="text-[9px] text-muted-foreground">Year Expense</p>
            </div>
            <p className="text-xs font-bold text-destructive tabular-nums">{fmt(yearTotals.expense)}</p>
          </div>
          <div className={cn('rounded-xl p-2.5 text-center', yearTotals.balance >= 0 ? 'bg-success/10' : 'bg-destructive/10')}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground">Net Balance</p>
            </div>
            <p className={cn('text-xs font-bold tabular-nums', yearTotals.balance >= 0 ? 'text-success' : 'text-destructive')}>
              {yearTotals.balance >= 0 ? '+' : '-'}{fmt(yearTotals.balance)}
            </p>
          </div>
        </div>

        {/* 12 month cards */}
        <div className="grid grid-cols-2 gap-2">
          {MONTH_NAMES.map((name, m) => {
            const s = monthSummaries[m];
            const isCurrent = isCurrentMonth(m);
            const hasData = s.txnCount > 0;

            return (
              <button
                key={m}
                onClick={() => handleMonthClick(m)}
                className={cn(
                  'rounded-xl border text-left p-3 transition-all active:scale-95',
                  isCurrent
                    ? 'border-primary/50 bg-primary/8 ring-1 ring-primary/30'
                    : hasData
                      ? 'border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5'
                      : 'border-border/30 bg-muted/10 hover:border-border/50',
                )}
              >
                {/* Month header */}
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    'text-xs font-bold',
                    isCurrent ? 'text-primary' : 'text-foreground',
                  )}>
                    {name}
                  </span>
                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <span className="text-[8px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                        NOW
                      </span>
                    )}
                    {hasData && (
                      <span className="text-[8px] bg-muted/60 text-muted-foreground rounded-full px-1 font-medium">
                        {s.txnCount}
                      </span>
                    )}
                  </div>
                </div>

                {hasData ? (
                  <div className="space-y-1">
                    {/* Income */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-2 w-2 text-success" />Income
                      </span>
                      <span className="text-[10px] font-semibold text-success tabular-nums">
                        {fmt(s.income)}
                      </span>
                    </div>
                    {/* Expense */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-2 w-2 text-destructive" />Expense
                      </span>
                      <span className="text-[10px] font-semibold text-destructive tabular-nums">
                        {fmt(s.expense)}
                      </span>
                    </div>
                    {/* Balance */}
                    <div className={cn(
                      'flex items-center justify-between pt-1.5 border-t',
                      s.balance >= 0 ? 'border-success/20' : 'border-destructive/20',
                    )}>
                      <span className="text-[9px] text-muted-foreground">Balance</span>
                      <span className={cn(
                        'text-[10px] font-bold tabular-nums',
                        s.balance >= 0 ? 'text-success' : 'text-destructive',
                      )}>
                        {s.balance >= 0 ? '+' : '-'}{fmt(s.balance)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[9px] text-muted-foreground/40 mt-1">No data</p>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Tap any month to view daily calendar
        </p>
      </DialogContent>
    </Dialog>
  );
}