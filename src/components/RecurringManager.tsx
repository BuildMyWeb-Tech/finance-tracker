import { useState, useMemo, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  PERSONS, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, ACCOUNTS,
  Person, HomeOrDebt,
} from '@/lib/types';
import { getMonthTransactions } from '@/lib/financial-store';
import {
  SmartRecurringEntry, RecurringFrequency,
  getRecurringDatesForMonth, getMissingRecurringTransactions,
  getEMIReminders, RECURRING_PRESETS,
} from '@/lib/recurring-engine';
import MonthSelector from '@/components/MonthSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  RefreshCw, Plus, Trash2, Clock, CheckCircle, AlertCircle,
  Repeat, Calendar, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import { generateId } from '@/lib/financial-store';

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  'daily-mon-sat': 'Daily (Mon–Sat)',
  'weekly-sat': 'Every Saturday',
  'monthly': 'Monthly (fixed day)',
  'custom': 'Custom',
};

function Section({ title, icon, children, defaultOpen = false, badge }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
          {badge && (
            <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-medium">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function RecurringManager() {
  const { state, selectedYear, selectedMonth, addTransaction, addRecurring, deleteRecurring } = useFinance();

  // Cast recurring entries to smart entries (with frequency field)
  const smartEntries: SmartRecurringEntry[] = (state.recurringEntries as SmartRecurringEntry[]);

  // ── Missing transactions (due but not yet recorded) ───────────────────────
  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth]
  );

  const missingTxns = useMemo(
    () => getMissingRecurringTransactions(smartEntries, monthTxns, selectedYear, selectedMonth),
    [smartEntries, monthTxns, selectedYear, selectedMonth]
  );

  // ── EMI reminders ─────────────────────────────────────────────────────────
  const emiReminders = useMemo(
    () => getEMIReminders(smartEntries, selectedYear, selectedMonth),
    [smartEntries, selectedYear, selectedMonth]
  );

  // ── New recurring form ────────────────────────────────────────────────────
  const [form, setForm] = useState({
    person: '' as string,
    type: 'expense' as 'income' | 'expense',
    homeOrDebt: 'home' as HomeOrDebt,
    category: '',
    amount: '',
    paymentMode: 'cash' as 'cash' | 'bank',
    dayOfMonth: '1',
    notes: '',
    frequency: 'monthly' as RecurringFrequency,
    isAutoApply: false,
    isEMI: false,
    emiMonthsLeft: '',
    accountId: '',
  });

  const categories = form.type === 'income'
    ? (form.homeOrDebt === 'home' ? [...HOME_INCOME_CATEGORIES] : [...DEBT_INCOME_CATEGORIES])
    : (form.homeOrDebt === 'debt' ? [...DEBT_EXPENSE_CATEGORIES] : [...EXPENSE_CATEGORIES]);

  const personAccounts = form.person ? ACCOUNTS.filter(a => a.person === form.person as Person) : [];

  const addRec = () => {
    if (!form.person || !form.category || !form.amount) {
      toast.error('Fill all required fields'); return;
    }
    const entry: any = {
      person: form.person as Person,
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      notes: form.notes,
      dayOfMonth: Number(form.dayOfMonth),
      homeOrDebt: form.homeOrDebt,
      accountId: form.accountId || undefined,
      // Smart fields (stored in notes as JSON prefix for now)
      frequency: form.frequency,
      isAutoApply: form.isAutoApply,
      isEMI: form.isEMI,
      emiMonthsLeft: form.emiMonthsLeft ? Number(form.emiMonthsLeft) : undefined,
    };
    addRecurring(entry);
    toast.success('Recurring entry added');
    setForm({ person: '', type: 'expense', homeOrDebt: 'home', category: '', amount: '', paymentMode: 'cash', dayOfMonth: '1', notes: '', frequency: 'monthly', isAutoApply: false, isEMI: false, emiMonthsLeft: '', accountId: '' });
  };

  // ── Apply a preset ─────────────────────────────────────────────────────────
  const applyPreset = (preset: typeof RECURRING_PRESETS[number]) => {
    setForm(f => ({
      ...f,
      category: preset.category,
      type: preset.type,
      homeOrDebt: preset.homeOrDebt,
      frequency: preset.frequency,
      dayOfMonth: String((preset as any).dayOfMonth || 1),
      isAutoApply: (preset as any).isAutoApply ?? false,
      isEMI: (preset as any).isEMI ?? false,
    }));
    toast.info(`Preset loaded: ${preset.label}. Fill in person & amount.`);
  };

  // ── Apply all missing transactions ───────────────────────────────────────
  const applyAllMissing = async () => {
    if (missingTxns.length === 0) return;
    for (const txn of missingTxns) {
      await addTransaction(txn);
    }
    toast.success(`Applied ${missingTxns.length} missing recurring transaction${missingTxns.length !== 1 ? 's' : ''}`);
  };

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // ── Upcoming dates preview ────────────────────────────────────────────────
  const [previewEntry, setPreviewEntry] = useState<SmartRecurringEntry | null>(null);
  const previewDates = useMemo(() => {
    if (!previewEntry) return [];
    return getRecurringDatesForMonth(previewEntry, selectedYear, selectedMonth).slice(0, 10);
  }, [previewEntry, selectedYear, selectedMonth]);

  return (
    <div className="space-y-4">
      {/* Missing transactions alert */}
      {missingTxns.length > 0 && (
        <div className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold text-foreground">
                {missingTxns.length} Pending Recurring Transaction{missingTxns.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Button
              size="sm"
              onClick={applyAllMissing}
              className="gap-1.5 text-xs h-7 gradient-primary text-primary-foreground"
            >
              <Zap className="h-3 w-3" />
              Apply All
            </Button>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {missingTxns.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                <span className="text-foreground font-medium">{t.category} · {t.person}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  <span className={cn('font-semibold', t.type === 'income' ? 'text-success' : 'text-destructive')}>
                    {fmt(t.amount)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 text-[10px] px-1.5 text-primary"
                    onClick={() => addTransaction(t).then(() => toast.success('Applied!'))}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            ))}
            {missingTxns.length > 8 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                +{missingTxns.length - 8} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* EMI Reminders */}
      {emiReminders.length > 0 && (
        <Section
          title="EMI Reminders"
          icon={<Clock className="h-4 w-4 text-warning" />}
          defaultOpen
          badge={`${emiReminders.filter(e => e.isPastDue).length} due`}
        >
          <div className="space-y-2 mt-2">
            {emiReminders.map(emi => (
              <div
                key={emi.id}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2.5',
                  emi.isPastDue ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/30'
                )}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    {emi.isPastDue
                      ? <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      : <CheckCircle className="h-3.5 w-3.5 text-success" />
                    }
                    <span className="text-sm font-medium">{emi.category}</span>
                    <span className="text-xs text-muted-foreground">{emi.person}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-5">
                    Due: {new Date(emi.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {emi.monthsLeft !== undefined && ` · ${emi.monthsLeft} months left`}
                  </p>
                </div>
                <span className={cn(
                  'text-sm font-bold',
                  emi.isPastDue ? 'text-destructive' : 'text-foreground'
                )}>
                  {fmt(emi.amount)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Existing recurring entries */}
      <Section
        title="Recurring Entries"
        icon={<Repeat className="h-4 w-4 text-primary" />}
        defaultOpen
        badge={smartEntries.length > 0 ? String(smartEntries.length) : undefined}
      >
        {smartEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recurring entries yet</p>
        ) : (
          <div className="space-y-2 mt-2">
            {smartEntries.map(entry => {
              const freq = (entry as SmartRecurringEntry).frequency || 'monthly';
              const datesThisMonth = getRecurringDatesForMonth(entry as SmartRecurringEntry, selectedYear, selectedMonth);
              const appliedCount = monthTxns.filter(t =>
                t.category === entry.category &&
                t.person === entry.person &&
                t.amount === entry.amount
              ).length;

              return (
                <div key={entry.id} className="glass-card rounded-lg px-3 py-2.5 bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{entry.category}</span>
                        <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                          {FREQ_LABELS[freq]}
                        </span>
                        {(entry as SmartRecurringEntry).isEMI && (
                          <span className="text-[10px] bg-warning/15 text-warning rounded-full px-1.5 py-0.5">EMI</span>
                        )}
                        {(entry as SmartRecurringEntry).isAutoApply && (
                          <span className="text-[10px] bg-success/15 text-success rounded-full px-1.5 py-0.5">Auto</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.person} · {entry.type} · {entry.paymentMode}
                        {freq === 'monthly' && ` · Day ${entry.dayOfMonth}`}
                      </p>
                      {datesThisMonth.length > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {datesThisMonth.length} occurrence{datesThisMonth.length !== 1 ? 's' : ''} this month
                          {appliedCount > 0 && ` · ${appliedCount} applied`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={cn(
                        'text-sm font-bold',
                        entry.type === 'income' ? 'text-success' : 'text-destructive'
                      )}>
                        {fmt(entry.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => setPreviewEntry(
                          previewEntry?.id === entry.id ? null : entry as SmartRecurringEntry
                        )}
                        title="Preview dates"
                      >
                        <Calendar className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRecurring(entry.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Date preview */}
                  {previewEntry?.id === entry.id && previewDates.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-[10px] text-muted-foreground font-semibold mb-1">
                        Dates this month ({previewDates.length}):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {previewDates.map(date => {
                          const applied = monthTxns.some(t =>
                            t.date === date && t.category === entry.category && t.person === entry.person
                          );
                          return (
                            <span
                              key={date}
                              className={cn(
                                'text-[10px] rounded px-1.5 py-0.5 font-medium',
                                applied ? 'bg-success/20 text-success' : 'bg-muted/50 text-muted-foreground'
                              )}
                            >
                              {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              {applied && ' ✓'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Quick presets */}
      <Section
        title="Quick Presets"
        icon={<Zap className="h-4 w-4 text-warning" />}
      >
        <div className="grid grid-cols-2 gap-2 mt-2">
          {RECURRING_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="text-left rounded-lg border border-border/50 bg-muted/20 px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <p className="text-xs font-medium">{preset.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {FREQ_LABELS[preset.frequency]} · {preset.type}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* Add new recurring */}
      <Section
        title="Add New Recurring Entry"
        icon={<Plus className="h-4 w-4 text-success" />}
      >
        <div className="space-y-3 mt-2">
          {/* Type & classification */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any, category: '' }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.homeOrDebt} onValueChange={v => setForm(f => ({ ...f, homeOrDebt: v as HomeOrDebt, category: '' }))}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">🏠 Home</SelectItem>
                <SelectItem value="debt">💳 Debt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Person</Label>
              <Select value={form.person} onValueChange={v => setForm(f => ({ ...f, person: v, accountId: '' }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Person" /></SelectTrigger>
                <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Frequency</Label>
            <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as RecurringFrequency }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQ_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.frequency === 'monthly' && (
            <div>
              <Label className="text-xs">Day of Month</Label>
              <Input
                type="number"
                min="1" max="31"
                value={form.dayOfMonth}
                onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))}
                className="mt-1"
              />
            </div>
          )}

          {form.person && personAccounts.length > 0 && (
            <div>
              <Label className="text-xs">Account</Label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={form.paymentMode} onValueChange={v => setForm(f => ({ ...f, paymentMode: v as any }))}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input
                placeholder="Optional"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Toggle options */}
          <div className="flex gap-2">
            <button
              onClick={() => setForm(f => ({ ...f, isAutoApply: !f.isAutoApply }))}
              className={cn(
                'flex-1 rounded-lg border text-xs py-2 font-medium transition-colors',
                form.isAutoApply
                  ? 'border-success/50 bg-success/10 text-success'
                  : 'border-border/50 text-muted-foreground hover:border-border'
              )}
            >
              {form.isAutoApply ? '✓ Auto Apply ON' : 'Auto Apply OFF'}
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, isEMI: !f.isEMI }))}
              className={cn(
                'flex-1 rounded-lg border text-xs py-2 font-medium transition-colors',
                form.isEMI
                  ? 'border-warning/50 bg-warning/10 text-warning'
                  : 'border-border/50 text-muted-foreground hover:border-border'
              )}
            >
              {form.isEMI ? '✓ EMI Reminder' : 'EMI Reminder OFF'}
            </button>
          </div>

          {form.isEMI && (
            <div>
              <Label className="text-xs">Months Left (optional)</Label>
              <Input
                type="number"
                placeholder="e.g. 24"
                value={form.emiMonthsLeft}
                onChange={e => setForm(f => ({ ...f, emiMonthsLeft: e.target.value }))}
                className="mt-1"
              />
            </div>
          )}

          <Button onClick={addRec} className="w-full gradient-primary text-primary-foreground" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Recurring Entry
          </Button>
        </div>
      </Section>
    </div>
  );
}