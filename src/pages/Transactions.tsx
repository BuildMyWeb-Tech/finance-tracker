import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { getMonthTransactions } from '@/lib/financial-store';
import {
  PERSONS, Transaction, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, ACCOUNTS, PaymentMode, HomeOrDebt, Person,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import DataControls from '@/components/DataControls';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Search, Pencil, Copy, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Changed from 15 to 50 per page ────────────────────────────────────────────
const PAGE_SIZE = 50;

// ─── All categories for filter dropdown ───────────────────────────────────────
const ALL_CATEGORIES = [
  ...HOME_INCOME_CATEGORIES,
  ...DEBT_INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...DEBT_EXPENSE_CATEGORIES,
] as string[];

// ─── Edit/Copy Dialog ──────────────────────────────────────────────────────────

function TxnDialog({ open, onClose, initial, mode, onSave }: {
  open: boolean;
  onClose: () => void;
  initial: Transaction;
  mode: 'edit' | 'copy';
  onSave: (t: Partial<Transaction>) => void;
}) {
  const { state } = useFinance();
  const [form, setForm] = useState<Partial<Transaction>>({ ...initial });

  const customIncome  = state.incomeSources  || [];
  const customExpense = state.expenseSources || [];

  const cats: string[] = form.type === 'income'
    ? form.homeOrDebt === 'home'
      ? [...HOME_INCOME_CATEGORIES, ...customIncome.filter(s => s.group === 'home').map(s => s.name)]
      : [...DEBT_INCOME_CATEGORIES, ...customIncome.filter(s => s.group === 'debt').map(s => s.name)]
    : form.type === 'expense'
      ? form.homeOrDebt === 'debt'
        ? [...DEBT_EXPENSE_CATEGORIES, ...customExpense.filter(s => s.group === 'debt').map(s => s.name)]
        : [...EXPENSE_CATEGORIES,      ...customExpense.filter(s => s.group === 'home').map(s => s.name)]
      : [];

  const personAccounts = form.person ? ACCOUNTS.filter(a => a.person === form.person as Person) : [];
  const toAccounts = form.transferTo
    ? form.transferTo === form.person
      ? ACCOUNTS.filter(a => a.person === form.transferTo as Person && a.id !== form.accountId)
      : ACCOUNTS.filter(a => a.person === form.transferTo as Person)
    : [];

  const handleSave = () => {
    const rawAmount = Number(form.amount);
    if (!rawAmount || rawAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (form.type !== 'transfer' && !form.category) { toast.error('Select a category'); return; }
    if (form.type === 'transfer' && form.transferToAccountId === form.accountId) {
      toast.error('Cannot transfer to same account'); return;
    }
    onSave({ ...form, amount: Math.abs(rawAmount) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? '✏️ Edit Transaction' : '📋 Copy Transaction'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {/* Type */}
          <div>
            <Label className="text-xs">Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['expense', 'income', 'transfer'] as Transaction['type'][]).map(t => (
                <Button key={t} size="sm" variant={form.type === t ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, type: t, category: '' }))}
                  className="capitalize">{t}</Button>
              ))}
            </div>
          </div>
          {/* Classification */}
          <div>
            <Label className="text-xs">Classification</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['home', 'debt'] as HomeOrDebt[]).map(hd => (
                <Button key={hd} size="sm" variant={form.homeOrDebt === hd ? 'default' : 'outline'}
                  onClick={() => setForm(f => ({ ...f, homeOrDebt: hd, category: '' }))}>
                  {hd === 'home' ? '🏠 Home' : '💳 Debt'}
                </Button>
              ))}
            </div>
          </div>
          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: Math.abs(Number(e.target.value)) }))}
                className="mt-1" />
            </div>
          </div>
          {/* Person */}
          <div>
            <Label className="text-xs">Person</Label>
            <Select value={form.person}
              onValueChange={v => setForm(f => ({ ...f, person: v as Person, accountId: '', transferTo: undefined, transferToAccountId: undefined }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Account */}
          {form.person && personAccounts.length > 0 && (
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={form.accountId || ''} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {/* Transfer or Category */}
          {form.type === 'transfer' ? (
            <>
              <div>
                <Label className="text-xs">Transfer To Person</Label>
                <Select value={form.transferTo || ''} onValueChange={v => setForm(f => ({ ...f, transferTo: v as Person, transferToAccountId: '' }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Recipient" /></SelectTrigger>
                  <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.transferTo && toAccounts.length > 0 && (
                <div>
                  <Label className="text-xs">To Account</Label>
                  <Select value={form.transferToAccountId || ''} onValueChange={v => setForm(f => ({ ...f, transferToAccountId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Account" /></SelectTrigger>
                    <SelectContent>{toAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {/* Payment Mode */}
          <div>
            <Label className="text-xs">Payment Mode</Label>
            <div className="flex gap-4 mt-2">
              {(['cash', 'bank'] as PaymentMode[]).map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="edit-paymentMode" value={m}
                    checked={form.paymentMode === m}
                    onChange={() => setForm(f => ({ ...f, paymentMode: m }))}
                    className="accent-primary" />
                  <span className="capitalize">{m}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional" className="mt-1" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleSave}>
              {mode === 'edit' ? 'Save Changes' : 'Confirm Copy'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Transaction Card ──────────────────────────────────────────────────────────

function TxnCard({ t, fmt, onEdit, onCopy, onDelete }: {
  t: Transaction; fmt: (n: number) => string;
  onEdit: () => void; onCopy: () => void; onDelete: () => void;
}) {
  const accountName = t.accountId ? ACCOUNTS.find(a => a.id === t.accountId)?.name : null;

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2.5 flex-1 min-w-0">
          <div className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
            t.type === 'income'   ? 'bg-success/15 text-success' :
            t.type === 'expense'  ? 'bg-destructive/15 text-destructive' :
                                    'bg-blue-500/15 text-blue-500',
          )}>
            {t.type === 'transfer' ? '↔' : t.type === 'income' ? '↑' : '↓'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {t.type === 'transfer' ? `Transfer → ${t.transferTo}` : t.category}
              {t.homeOrDebt === 'debt' && (
                <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-500 rounded px-1 py-0.5 font-bold">DEBT</span>
              )}
            </p>
            {t.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.notes}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-sm font-bold',
            t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-blue-500')}>
            {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{fmt(t.amount)}
          </span>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-success" onClick={onCopy}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 font-medium">{t.person}</span>
        <span className="text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 capitalize">{t.paymentMode}</span>
        {accountName && (
          <span className="text-[11px] bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5">{accountName}</span>
        )}
      </div>
    </div>
  );
}

function formatDateHeader(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Transactions() {
  const {
    state, selectedYear, selectedMonth,
    deleteTransaction, updateTransaction, addTransaction,
  } = useFinance();

  const [search, setSearch]               = useState('');
  const [filterPerson, setFilterPerson]   = useState('all');
  const [filterType, setFilterType]       = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterDate, setFilterDate]       = useState('');
  const [page, setPage]                   = useState(1);
  const [editTarget, setEditTarget]       = useState<Transaction | null>(null);
  const [copyTarget, setCopyTarget]       = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<Transaction | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const hasActiveFilters = search || filterPerson !== 'all' || filterType !== 'all' || filterDate || filterCategory !== 'all' || filterAccount !== 'all';

  const clearAllFilters = () => {
    setSearch(''); setFilterPerson('all'); setFilterType('all');
    setFilterCategory('all'); setFilterAccount('all'); setFilterDate(''); setPage(1);
  };

  // Build unique category list for dropdown (from this month's txns + static lists)
  const categoryOptions = useMemo(() => {
    const fromTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth)
      .map(t => t.category).filter(Boolean);
    const merged = Array.from(new Set([...ALL_CATEGORIES, ...fromTxns])).sort();
    return merged;
  }, [state.transactions, selectedYear, selectedMonth]);

  // Account options — filtered by selected person if one is chosen
  const accountOptions = useMemo(() => {
    return filterPerson !== 'all'
      ? ACCOUNTS.filter(a => a.person === filterPerson)
      : ACCOUNTS;
  }, [filterPerson]);

  const allTxns = useMemo(() => {
    let list = getMonthTransactions(state.transactions, selectedYear, selectedMonth);
    if (filterPerson   !== 'all') list = list.filter(t => t.person   === filterPerson);
    if (filterType     !== 'all') list = list.filter(t => t.type     === filterType);
    if (filterCategory !== 'all') list = list.filter(t => t.category === filterCategory);
    if (filterAccount  !== 'all') list = list.filter(t => t.accountId === filterAccount || t.transferToAccountId === filterAccount);
    if (filterDate)                list = list.filter(t => t.date     === filterDate);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        t.person.toLowerCase().includes(q) ||
        String(t.amount).includes(q),
      );
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.transactions, selectedYear, selectedMonth, filterPerson, filterType, filterCategory, filterAccount, filterDate, search]);

  const totalIncome  = allTxns.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
  const totalExpense = allTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  const totalPages = Math.max(1, Math.ceil(allTxns.length / PAGE_SIZE));
  const pagedTxns  = allTxns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage  = () => setPage(1);

  // Group paged transactions by date, with daily summary
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of pagedTxns) {
      const existing = map.get(t.date) || [];
      existing.push(t);
      map.set(t.date, existing);
    }
    return Array.from(map.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
    );
  }, [pagedTxns]);

  const handleSaveEdit = (fields: Partial<Transaction>) => {
    if (!editTarget) return;
    const d = new Date(fields.date || editTarget.date);
    const amount = Math.abs(Number(fields.amount ?? editTarget.amount));
    updateTransaction({ ...editTarget, ...fields, amount, year: d.getFullYear(), month: d.getMonth() });
    toast.success('Transaction updated');
  };

  const handleSaveCopy = (fields: Partial<Transaction>) => {
    if (!copyTarget) return;
    const { id, ...rest } = copyTarget;
    const d = new Date(fields.date || today);
    const amount = Math.abs(Number(fields.amount ?? rest.amount));
    addTransaction({ ...rest, ...fields, amount, year: d.getFullYear(), month: d.getMonth() });
    toast.success('Transaction copied');
  };

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Transactions</h1>
        <MonthSelector />
      </div>
      {/* <DataControls /> */}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Income</p>
          <p className="text-xs font-bold text-success truncate">{fmt(totalIncome)}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Expense</p>
          <p className="text-xs font-bold text-destructive truncate">{fmt(totalExpense)}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Net</p>
          <p className={cn('text-xs font-bold truncate', balance >= 0 ? 'text-success' : 'text-destructive')}>
            {balance >= 0 ? '+' : '-'}{fmt(balance)}
          </p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">Count</p>
          <p className="text-xs font-bold text-foreground">{allTxns.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, category, person, amount…" value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }} className="pl-9" />
        </div>

        {/* Row 1: Person + Type */}
        <div className="flex gap-2">
          <Select value={filterPerson} onValueChange={v => { setFilterPerson(v); setFilterAccount('all'); resetPage(); }}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Person" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Persons</SelectItem>
              {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={v => { setFilterType(v); resetPage(); }}>
            <SelectTrigger className="flex-1"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); resetPage(); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>

        {/* Row 2: Account filter */}
        <Select value={filterAccount} onValueChange={v => { setFilterAccount(v); resetPage(); }}>
          <SelectTrigger className="w-full"><SelectValue placeholder="All Accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accountOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Row 3: Date + Clear */}
        <div className="flex gap-2 items-center">
          <Input type="date" value={filterDate}
            onChange={e => { setFilterDate(e.target.value); resetPage(); }}
            className="flex-1 text-sm" />
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={clearAllFilters}
              className="shrink-0 text-xs flex items-center gap-1 text-muted-foreground border-border/60">
              <X className="h-3 w-3" /> Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Grouped Transaction List with daily summaries */}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">No transactions found</p>
          </div>
        ) : grouped.map(([date, txns]) => {
          // ── Daily summary ─────────────────────────────────────────────────
          const dayIncome   = txns.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
          const dayExpense  = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
          const dayTransfer = txns.filter(t => t.type === 'transfer').reduce((s, t) => s + t.amount, 0);

          return (
            <div key={date}>
              {/* Date header + daily summary */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatDateHeader(date)}
                </span>
                <div className="flex-1 h-px bg-border/50" />
                {/* Daily summary chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {dayIncome > 0 && (
                    <span className="text-[10px] font-semibold text-success bg-success/10 rounded px-1.5 py-0.5">
                      +{fmt(dayIncome)}
                    </span>
                  )}
                  {dayExpense > 0 && (
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
                      -{fmt(dayExpense)}
                    </span>
                  )}
                  {dayTransfer > 0 && (
                    <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5">
                      ↔{fmt(dayTransfer)}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {txns.map(t => (
                  <TxnCard key={t.id} t={t} fmt={fmt}
                    onEdit={() => setEditTarget(t)}
                    onCopy={() => setCopyTarget({ ...t, date: today })}
                    onDelete={() => setDeleteTarget(t)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <Button variant="outline" size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {allTxns.length} records
          </span>
          <Button variant="outline" size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {editTarget && (
        <TxnDialog open={!!editTarget} onClose={() => setEditTarget(null)}
          initial={editTarget} mode="edit" onSave={handleSaveEdit} />
      )}
      {copyTarget && (
        <TxnDialog open={!!copyTarget} onClose={() => setCopyTarget(null)}
          initial={copyTarget} mode="copy" onSave={handleSaveCopy} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This cannot be undone.</p>
                {deleteTarget && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{deleteTarget.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className={cn('font-semibold',
                        deleteTarget.type === 'income' ? 'text-success' : 'text-destructive')}>
                        {deleteTarget.type === 'income' ? '+' : '-'}{fmt(deleteTarget.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Person</span>
                      <span className="font-medium">{deleteTarget.person}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">
                        {new Date(deleteTarget.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteTransaction(deleteTarget.id);
                  toast.success('Deleted');
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransactionForm />
    </div>
  );
}