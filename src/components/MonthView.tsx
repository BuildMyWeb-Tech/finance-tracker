/**
 * MonthView.tsx — Monthly calendar grid showing daily income/expense/balance.
 * Highlights highest expense day (red border) and highest income day (green border).
 * Click any date cell → opens DayView.
 */

import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  buildCalendarGrid, getMonthDaySummaries, getHighlightDays,
  fmtCompact, toDateStr,
} from '@/lib/calendar-utils';
import { MONTH_NAMES } from '@/lib/types';
import { getTotalBalance } from '@/lib/financial-store';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import DayView from './DayView';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthViewProps {
  year: number;
  month: number;
  onBack: () => void;
  onChangeMonth: (year: number, month: number) => void;
}

export default function MonthView({ year, month, onBack, onChangeMonth }: MonthViewProps) {
  const { state } = useFinance();
  const [selectedDay, setSelectedDay] = useState<{ year: number; month: number; day: number } | null>(null);

  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const daySummaries = useMemo(
    () => getMonthDaySummaries(state.transactions, year, month),
    [state.transactions, year, month],
  );
  const { maxExpenseDate, maxIncomeDate } = useMemo(() => getHighlightDays(daySummaries), [daySummaries]);

  const totals = useMemo(
    () => getTotalBalance(state.transactions, year, month, state.initialBalances, state.accountBalances),
    [state.transactions, state.initialBalances, state.accountBalances, year, month],
  );

  // Running balance per day (cumulative from month start)
  const runningBalances = useMemo(() => {
    const sorted = [...daySummaries.entries()].sort(([a], [b]) => a.localeCompare(b));
    const map = new Map<string, number>();
    let running = totals.opening;
    for (const [date, s] of sorted) {
      running += s.income - s.expense;
      map.set(date, running);
    }
    return map;
  }, [daySummaries, totals.opening]);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  };

  const fmt = fmtCompact;
  const fmtFull = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  // Money leak detection — days where expense > 2× daily average
  const avgDailyExpense = useMemo(() => {
    const days = [...daySummaries.values()].filter(d => d.expense > 0);
    if (!days.length) return 0;
    return days.reduce((s, d) => s + d.expense, 0) / days.length;
  }, [daySummaries]);

  const leakDays = useMemo(() => {
    const leaks = new Set<string>();
    for (const [date, s] of daySummaries) {
      if (avgDailyExpense > 0 && s.expense > avgDailyExpense * 2) leaks.add(date);
    }
    return leaks;
  }, [daySummaries, avgDailyExpense]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pt-2 pb-3 shrink-0">
        <button onClick={onBack} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" /> Year View
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-sm font-bold min-w-[130px] text-center text-foreground">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="w-20" />
      </div>

      {/* Month summary bar */}
      <div className="grid grid-cols-3 gap-2 mb-3 shrink-0">
        <div className="rounded-xl bg-success/10 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground">Income</p>
          <p className="text-xs font-bold text-success tabular-nums">{fmtFull(totals.income)}</p>
        </div>
        <div className="rounded-xl bg-destructive/10 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground">Expense</p>
          <p className="text-xs font-bold text-destructive tabular-nums">{fmtFull(totals.expense)}</p>
        </div>
        <div className={cn(
          'rounded-xl px-2 py-1.5 text-center',
          totals.savings >= 0 ? 'bg-success/10' : 'bg-destructive/10',
        )}>
          <p className="text-[9px] text-muted-foreground">Balance</p>
          <p className={cn('text-xs font-bold tabular-nums', totals.savings >= 0 ? 'text-success' : 'text-destructive')}>
            {totals.savings >= 0 ? '+' : '-'}{fmtFull(totals.savings)}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-2 text-[9px] text-muted-foreground shrink-0 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-success inline-block" />Highest income
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-destructive inline-block" />Highest expense
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warning/40 inline-block" />Money leak
        </span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="h-16" />;

                const dateStr = toDateStr(year, month, day);
                const s = daySummaries.get(dateStr);
                const isToday = dateStr === todayStr;
                const isMaxExpense = dateStr === maxExpenseDate && s && s.expense > 0;
                const isMaxIncome  = dateStr === maxIncomeDate  && s && s.income  > 0;
                const isLeak = leakDays.has(dateStr);
                const runBal = runningBalances.get(dateStr);
                const hasTxns = (s?.txnCount ?? 0) > 0;

                return (
                  <button
                    key={di}
                    onClick={() => setSelectedDay({ year, month, day })}
                    className={cn(
                      'h-16 rounded-lg p-1 text-left transition-all flex flex-col',
                      isMaxExpense ? 'ring-2 ring-destructive' :
                      isMaxIncome  ? 'ring-2 ring-success' : '',
                      isLeak       ? 'bg-warning/10' :
                      isToday      ? 'bg-primary/10' :
                      hasTxns      ? 'bg-muted/30 hover:bg-muted/50' : 'hover:bg-muted/20',
                      'active:scale-95',
                    )}
                  >
                    {/* Day number */}
                    <span className={cn(
                      'text-[10px] font-bold leading-none mb-0.5',
                      isToday ? 'text-primary' : 'text-foreground',
                    )}>
                      {day}
                    </span>

                    {s && s.txnCount > 0 ? (
                      <div className="flex flex-col gap-0 flex-1 justify-center min-w-0">
                        {s.income > 0 && (
                          <span className="text-[8px] text-success font-medium leading-tight truncate">
                            +{fmt(s.income)}
                          </span>
                        )}
                        {s.expense > 0 && (
                          <span className="text-[8px] text-destructive font-medium leading-tight truncate">
                            -{fmt(s.expense)}
                          </span>
                        )}
                        {s.income > 0 || s.expense > 0 ? (
                          <span className={cn(
                            'text-[7px] font-bold leading-tight truncate',
                            s.balance >= 0 ? 'text-success/70' : 'text-destructive/70',
                          )}>
                            ={fmt(s.balance)}
                          </span>
                        ) : null}
                        {runBal !== undefined && (
                          <span className="text-[7px] text-muted-foreground/60 leading-tight truncate">
                            ~{fmt(runBal)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {s && s.txnCount > 0 && (
                      <span className="text-[7px] text-muted-foreground/50 leading-none self-end">
                        {s.txnCount}t
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* DayView dialog */}
      {selectedDay && (
        <Dialog open onOpenChange={() => setSelectedDay(null)}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <DayView
              year={selectedDay.year}
              month={selectedDay.month}
              day={selectedDay.day}
              onClose={() => setSelectedDay(null)}
              onNavigate={(y, m, d) => {
                setSelectedDay({ year: y, month: m, day: d });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}