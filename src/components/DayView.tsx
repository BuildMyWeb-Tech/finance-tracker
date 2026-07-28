/**
 * DayView.tsx — Daily transaction drilldown with prev/next navigation.
 * Supports Edit, Delete, Copy per transaction.
 */

import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { buildDaySummary, fmtFull, navigateDay, toDateStr } from '@/lib/calendar-utils';
import { ACCOUNTS, MONTH_NAMES } from '@/lib/types';
import type { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, X, Pencil, Copy, Trash2,
  TrendingUp, TrendingDown, ArrowLeftRight, Wallet,
  User, CreditCard, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TransactionForm from '@/components/TransactionForm';
import { toast } from 'sonner';

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  onClose: () => void;
  onNavigate: (year: number, month: number, day: number) => void;
}

export default function DayView({ year, month, day, onClose, onNavigate }: DayViewProps) {
  const { state, deleteTransaction, addTransaction } = useFinance();
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const dateStr = toDateStr(year, month, day);

  const dayTxns = useMemo(() => {
    return state.transactions.filter(t => t.date === dateStr)
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [state.transactions, dateStr]);

  const summary = useMemo(() => buildDaySummary(dateStr, dayTxns), [dateStr, dayTxns]);

  const prevDay = navigateDay(year, month, day, -1);
  const nextDay = navigateDay(year, month, day, 1);

  const handleDelete = async (id: string) => {
    await deleteTransaction(id);
    setConfirmDelete(null);
    toast.success('Transaction deleted');
  };

  const handleCopy = async (t: Transaction) => {
    const { id: _id, ...rest } = t;
    await addTransaction({ ...rest, date: dateStr });
    toast.success('Transaction copied');
  };

  const fmt = fmtFull;
  const dateLabel = `${day} ${MONTH_NAMES[month]} ${year}`;
  const dayOfWeek = new Date(year, month, day).toLocaleDateString('en-IN', { weekday: 'long' });

  const typeIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="h-3 w-3 text-success" />;
    if (type === 'expense') return <TrendingDown className="h-3 w-3 text-destructive" />;
    return <ArrowLeftRight className="h-3 w-3 text-primary" />;
  };

  const typeColor = (type: string) =>
    type === 'income' ? 'text-success' : type === 'expense' ? 'text-destructive' : 'text-primary';

  const typeBg = (type: string) =>
    type === 'income' ? 'bg-success/10 border-success/20'
    : type === 'expense' ? 'bg-destructive/10 border-destructive/20'
    : 'bg-primary/10 border-primary/20';

  const accountName = (t: Transaction) =>
    t.accountId ? (ACCOUNTS.find(a => a.id === t.accountId)?.name ?? t.accountId) : null;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const t of dayTxns) {
      if (!map[t.category]) map[t.category] = { income: 0, expense: 0 };
      if (t.type === 'income')  map[t.category].income  += t.amount;
      if (t.type === 'expense') map[t.category].expense += t.amount;
    }
    return Object.entries(map)
      .filter(([, v]) => v.income > 0 || v.expense > 0)
      .sort((a, b) => (b[1].expense + b[1].income) - (a[1].expense + a[1].income));
  }, [dayTxns]);

  // Person breakdown
  const personBreakdown = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const t of dayTxns) {
      if (!map[t.person]) map[t.person] = { income: 0, expense: 0 };
      if (t.type === 'income')  map[t.person].income  += t.amount;
      if (t.type === 'expense') map[t.person].expense += t.amount;
    }
    return Object.entries(map).filter(([, v]) => v.income > 0 || v.expense > 0);
  }, [dayTxns]);

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onNavigate(prevDay.year, prevDay.month, prevDay.day)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">{dayOfWeek}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onNavigate(nextDay.year, nextDay.month, nextDay.day)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3 shrink-0">
        <div className="rounded-xl bg-success/10 p-2 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Income</p>
          <p className="text-xs font-bold text-success tabular-nums">{fmt(summary.income)}</p>
        </div>
        <div className="rounded-xl bg-destructive/10 p-2 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Expense</p>
          <p className="text-xs font-bold text-destructive tabular-nums">{fmt(summary.expense)}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Transfer</p>
          <p className="text-xs font-bold text-primary tabular-nums">{fmt(summary.transfer)}</p>
        </div>
        <div className={cn('rounded-xl p-2 text-center', summary.balance >= 0 ? 'bg-success/10' : 'bg-destructive/10')}>
          <p className="text-[9px] text-muted-foreground mb-0.5">Balance</p>
          <p className={cn('text-xs font-bold tabular-nums', summary.balance >= 0 ? 'text-success' : 'text-destructive')}>
            {summary.balance >= 0 ? '+' : '-'}{fmt(summary.balance)}
          </p>
        </div>
      </div>

      {/* Breakdowns */}
      {dayTxns.length > 0 && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-2 shrink-0">
          {/* Category split */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-xl bg-muted/20 p-2.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Tag className="h-2.5 w-2.5" /> By Category
              </p>
              <div className="space-y-1">
                {categoryBreakdown.slice(0, 4).map(([cat, v]) => (
                  <div key={cat} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate max-w-[70px]">{cat}</span>
                    <div className="flex gap-1">
                      {v.income  > 0 && <span className="text-success font-medium">+{fmt(v.income)}</span>}
                      {v.expense > 0 && <span className="text-destructive font-medium">-{fmt(v.expense)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Person split */}
          {personBreakdown.length > 0 && (
            <div className="rounded-xl bg-muted/20 p-2.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <User className="h-2.5 w-2.5" /> By Person
              </p>
              <div className="space-y-1">
                {personBreakdown.map(([person, v]) => (
                  <div key={person} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{person}</span>
                    <div className="flex gap-1">
                      {v.income  > 0 && <span className="text-success font-medium">+{fmt(v.income)}</span>}
                      {v.expense > 0 && <span className="text-destructive font-medium">-{fmt(v.expense)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {dayTxns.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-muted-foreground">No transactions on this day</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
              {dayTxns.length} transaction{dayTxns.length > 1 ? 's' : ''}
            </p>
            {dayTxns.map(t => {
              const acc = accountName(t);
              return (
                <div key={t.id} className={cn(
                  'rounded-xl border p-3 transition-all',
                  typeBg(t.type),
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className={cn(
                        'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        t.type === 'income' ? 'bg-success/20' : t.type === 'expense' ? 'bg-destructive/20' : 'bg-primary/20'
                      )}>
                        {typeIcon(t.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">{t.category}</span>
                          <span className="text-[9px] text-muted-foreground bg-muted/60 rounded px-1">{t.person}</span>
                          {acc && (
                            <span className="text-[9px] text-muted-foreground bg-muted/60 rounded px-1 flex items-center gap-0.5">
                              <CreditCard className="h-2 w-2" />{acc}
                            </span>
                          )}
                        </div>
                        {t.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.notes}</p>}
                        {t.type === 'transfer' && t.transferTo && (
                          <p className="text-[10px] text-primary mt-0.5">→ {t.transferTo}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold tabular-nums', typeColor(t.type))}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '⇄'}{fmt(t.amount)}
                      </p>
                      <p className="text-[9px] text-muted-foreground capitalize">{t.paymentMode}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 mt-2 pt-2 border-t border-border/20 justify-end">
                    {/* <Button variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary gap-1"
                      onClick={() => handleCopy(t)}>
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary gap-1"
                      onClick={() => setEditingTxn(t)}>
                      <Pencil className="h-2.5 w-2.5" /> Edit
                    </Button> */}
                    {confirmDelete === t.id ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm"
                          className="h-6 px-2 text-[10px] text-destructive hover:text-destructive gap-1"
                          onClick={() => handleDelete(t.id)}>
                          Confirm
                        </Button>
                        <Button variant="ghost" size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground"
                          onClick={() => setConfirmDelete(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive gap-1"
                        onClick={() => setConfirmDelete(t.id)}>
                        <Trash2 className="h-2.5 w-2.5" /> 
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {/* {editingTxn && (
        <Dialog open onOpenChange={() => setEditingTxn(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              editTransaction={editingTxn}
              onSuccess={() => setEditingTxn(null)}
            />
          </DialogContent>
        </Dialog>
      )} */}
    </div>
  );
}