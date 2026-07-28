/**
 * TimeRangeFilter.tsx — Reusable time-range dropdown used on Expenses & Income pages.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type TimeRange = 'monthly' | '3months' | '6months' | '9months' | 'yearly';

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'monthly',  label: 'This Month'    },
  { value: '3months',  label: 'Last 3 Months' },
  { value: '6months',  label: 'Last 6 Months' },
  { value: '9months',  label: 'Last 9 Months' },
  { value: 'yearly',   label: 'This Year'     },
];

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

export default function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  return (
    <Select value={value} onValueChange={v => onChange(v as TimeRange)}>
      <SelectTrigger className="h-8 w-[130px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Collect transactions for a given time range ending at selectedYear/selectedMonth.
 * Imported in BudgetPage and IncomePage.
 */
import { Transaction } from '@/lib/types';
import { getMonthTransactions } from '@/lib/financial-store';

export function getTransactionsForRange(
  allTxns: Transaction[],
  selectedYear: number,
  selectedMonth: number,
  range: TimeRange,
): Transaction[] {
  if (range === 'monthly') {
    return getMonthTransactions(allTxns, selectedYear, selectedMonth);
  }
  const months =
    range === '3months' ? 3 :
    range === '6months' ? 6 :
    range === '9months' ? 9 : 12;

  const result: Transaction[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(selectedYear, selectedMonth - i, 1);
    result.push(...getMonthTransactions(allTxns, d.getFullYear(), d.getMonth()));
  }
  return result;
}