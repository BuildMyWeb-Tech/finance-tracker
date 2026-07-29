import { useMemo, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getPersonBalance, getMonthTransactions, validateTransfer,
  sortByDateDesc, normalizeTransaction,
} from '@/lib/financial-store'; 
import { PERSONS, Person, ACCOUNTS, MONTH_NAMES } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Users, ArrowRight, Crown, AlertCircle,
  ArrowLeftRight, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Person colours ──────────────────────────────────────────────────────────

const PERSON_COLORS: Record<Person, { bg: string; text: string; border: string }> = {
  Appa:  { bg: 'bg-blue-500/15', text: 'text-blue-400',  border: 'border-blue-500/30' },
  Amma:  { bg: 'bg-pink-500/15', text: 'text-pink-400',  border: 'border-pink-500/30' },
  Ajai:  { bg: 'bg-success/15',  text: 'text-success',   border: 'border-success/30'  },
  Mauli: { bg: 'bg-warning/15',  text: 'text-warning',   border: 'border-warning/30'  },
};

const PERSON_EMOJI: Record<Person, string> = {
  Appa: '👨', Amma: '👩', Ajai: '👦', Mauli: '👧',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lookup human-readable account name from id. */
function accountLabel(id?: string): string | null {
  if (!id) return null;
  return ACCOUNTS.find(a => a.id === id)?.name ?? id;
}

/**
 * Bug 3 + Bug 4: Build a descriptive label for a transfer row.
 * Shows account names when available, falls back gracefully.
 *   "Appa CNB → Ajai CB"   (both accounts known)
 *   "Appa CNB → Ajai"      (dest account unknown)
 *   "Appa → Ajai CB"       (source account unknown — legacy)
 */
function transferLabel(t: ReturnType<typeof getMonthTransactions>[number]): string {
  const from = accountLabel(t.accountId)             ?? t.person;
  const to   = accountLabel(t.transferToAccountId)   ?? t.transferTo ?? '?';
  return `${from} → ${to}`;
}

// ─── Collapsible section ─────────────────────────────────────────────────────

function Section({
  title, icon, children, defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">{icon}<span>{title}</span></div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Person Transaction Panel ─────────────────────────────────────────────────
// Bug 9 (pagination removed): infinite scroll via max-h + overflow-y-auto.
// Bug 3 (transfer label): shows "Appa CNB → Ajai CB" not "Transfer → Ajai".
// Bug 10: amounts already normalised at load time (no re-formatting needed).

function PersonTxnPanel({
  person,
  txns,
}: {
  person: Person;
  txns: ReturnType<typeof getMonthTransactions>;
}) {
  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  // Bug 9: stable sort (date + id tiebreaker) via sortByDateDesc
  const personTxns = useMemo(() =>
    sortByDateDesc(txns.filter(t => t.person === person)),
    [txns, person],
  );

  if (personTxns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 text-center">
        No transactions this month
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
        All Transactions ({personTxns.length})
      </p>

      {/* Bug 9: scroll — no pagination buttons, no page state */}
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {personTxns.map(t => {
          const isTransfer = t.type === 'transfer';
          const srcAccount = accountLabel(t.accountId);

          // Primary label
          const label = isTransfer ? transferLabel(t) : t.category;

          // Secondary sub-label (matches Transactions page style)
          // income/expense → "Category - AccountName"
          // transfer       → notes (if meaningful)
          const subLabel: string | null = isTransfer
            ? (t.notes && t.notes !== `${t.person} → ${t.transferTo}` && t.notes !== transferLabel(t)
                ? t.notes
                : null)
            : srcAccount
              ? `${t.category} - ${srcAccount}`
              : t.notes || null;

          return (
            <div
              key={t.id}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-muted/30 border-b border-border/20 last:border-0"
            >
              {/* Left: icon + label + sub */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={cn(
                  'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                  t.type === 'income'   ? 'bg-success/20 text-success' :
                  t.type === 'transfer' ? 'bg-blue-500/20 text-blue-500' :
                                          'bg-destructive/20 text-destructive',
                )}>
                  {t.type === 'income' ? '↑' : t.type === 'transfer' ? '↔' : '↓'}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium max-w-[140px]">{label}</p>
                  {subLabel && (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {subLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: date + amount */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span className={cn(
                  'font-semibold tabular-nums',
                  t.type === 'income'   ? 'text-success' :
                  t.type === 'transfer' ? 'text-blue-500' : 'text-destructive',
                )}>
                  {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔'}{fmt(t.amount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PersonWisePage() {
  const { state, selectedYear, selectedMonth, addTransaction } = useFinance();

  const fmt  = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const fmtK = (n: number) => {
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000)   return `₹${(Math.abs(n) / 1000).toFixed(1)}k`;
    return `₹${Math.abs(n)}`;
  };

  // ── Per-person summary ───────────────────────────────────────────────────────
  const personData = useMemo(() =>
    PERSONS.map(person => {
      const bal = getPersonBalance(
        state.transactions, person,
        selectedYear, selectedMonth,
        state.initialBalances, state.accountBalances,
      );
      return { person, ...bal };
    }),
    [state.transactions, state.initialBalances, state.accountBalances, selectedYear, selectedMonth],
  );

  const monthTxns = useMemo(
    () => getMonthTransactions(state.transactions, selectedYear, selectedMonth),
    [state.transactions, selectedYear, selectedMonth],
  );

  // Bug 1: income/expense totals exclude transfers
  const totalIncome  = personData.reduce((s, p) => s + p.income,  0);
  const totalExpense = personData.reduce((s, p) => s + p.expense, 0);

  const highestEarner  = [...personData].sort((a, b) => b.income  - a.income )[0];
  const highestSpender = [...personData].sort((a, b) => b.expense - a.expense)[0];

  // ── Transfer form state ──────────────────────────────────────────────────────
  const [tf, setTf] = useState({
    from: '' as string, to: '' as string,
    fromAccount: '', toAccount: '',
    amount: '', notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fromAccounts = tf.from ? ACCOUNTS.filter(a => a.person === tf.from as Person) : [];
  const toAccounts   = tf.to
    ? ACCOUNTS.filter(a =>
        a.person === tf.to as Person &&
        // Bug 7: filter same account out of dest list when same person
        !(tf.from === tf.to && a.id === tf.fromAccount)
      )
    : [];

  const doTransfer = async () => {
    if (!tf.from || !tf.to || !tf.amount) { toast.error('Fill all required fields'); return; }
    const amt = Math.round(Number(tf.amount));
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }

    // Bug 7: store-level validation (not just UI)
    const check = validateTransfer(tf.fromAccount || undefined, tf.toAccount || undefined);
    if (!check.ok) { toast.error(check.error!); return; }

    const fromAccName = accountLabel(tf.fromAccount) ?? tf.from;
    const toAccName   = accountLabel(tf.toAccount)   ?? tf.to;
    const autoNotes   = `${fromAccName} → ${toAccName}`;

    const d = new Date(tf.date);

    // Bug 8: normalizeTransaction will fix paymentMode to match account type
    const raw = {
      date: tf.date, year: d.getFullYear(), month: d.getMonth(),
      person: tf.from as Person, type: 'transfer' as const, category: 'Transfer',
      amount: amt, paymentMode: 'bank' as const,
      notes: tf.notes || autoNotes,
      transferTo: tf.to as Person,
      accountId: tf.fromAccount || undefined,
      transferToAccountId: tf.toAccount || undefined,
      homeOrDebt: 'home' as const,
    };
    const normalized = normalizeTransaction({ ...raw, id: 'temp' });

    await addTransaction({ ...raw, paymentMode: normalized.paymentMode });
    toast.success(`Recorded: ${fromAccName} → ${toAccName} · ${fmt(amt)}`);
    setTf({ from: '', to: '', fromAccount: '', toAccount: '', amount: '', notes: '', date: new Date().toISOString().split('T')[0] });
  };

  // Bug 9: stable sort for transfer history
  const transferHistory = useMemo(
    () => sortByDateDesc(monthTxns.filter(t => t.type === 'transfer')),
    [monthTxns],
  );

  const [expandedPerson, setExpandedPerson] = useState<Person | null>(null);

  return (
    <div className="pb-20 px-4 pt-4 max-w-2xl mx-auto space-y-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Person-wise
        </h1>
        <MonthSelector />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        {MONTH_NAMES[selectedMonth]} {selectedYear}
      </p>

      {/* Top earner / top spender chips */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Crown className="h-3.5 w-3.5 text-warning" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Earner</span>
          </div>
          <p className="text-sm font-bold">{PERSON_EMOJI[highestEarner?.person]} {highestEarner?.person}</p>
          <p className="text-xs text-success font-semibold">{fmt(highestEarner?.income || 0)}</p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Top Spender</span>
          </div>
          <p className="text-sm font-bold">{PERSON_EMOJI[highestSpender?.person]} {highestSpender?.person}</p>
          <p className="text-xs text-destructive font-semibold">{fmt(highestSpender?.expense || 0)}</p>
        </div>
      </div>

      {/* ── Individual Balances ── */}
      <Section title="Individual Balances" icon={<Users className="h-4 w-4 text-primary" />}>
        <div className="overflow-x-auto">
          <div className="min-w-[380px]">

            {/* Column header */}
            <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-2 border-b border-border/40">
              <span className="w-20">Person</span>
              <span className="flex-1 text-right">Income</span>
              <span className="flex-1 text-right">Expense</span>
              <span className="flex-1 text-right">Balance</span>
            </div>

            <div className="space-y-1 mt-1">
              {personData.map(({ person, income, expense, closing, opening }) => {
                const colors     = PERSON_COLORS[person];
                const isExpanded = expandedPerson === person;
                const spendPct   = income > 0 ? Math.min((expense / income) * 100, 100) : 0;

                return (
                  <div key={person}>
                    <button
                      className={cn(
                        'w-full rounded-xl px-2 py-2.5 transition-all text-left',
                        isExpanded
                          ? `${colors.bg} border ${colors.border}`
                          : 'hover:bg-muted/30',
                      )}
                      onClick={() => setExpandedPerson(isExpanded ? null : person)}
                    >
                      <div className="flex items-center gap-2 min-w-[360px]">
                        <div className="w-20 flex items-center gap-1.5 shrink-0">
                          <span className="text-base">{PERSON_EMOJI[person]}</span>
                          <span className={cn('text-xs font-bold', colors.text)}>{person}</span>
                        </div>
                        <span className={cn(
                          'flex-1 text-right text-xs font-semibold tabular-nums',
                          income > 0 ? 'text-success' : 'text-muted-foreground',
                        )}>
                          {income > 0 ? fmt(income) : '—'}
                        </span>
                        <span className={cn(
                          'flex-1 text-right text-xs font-semibold tabular-nums',
                          expense > 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}>
                          {expense > 0 ? fmt(expense) : '—'}
                        </span>
                        <span className={cn(
                          'flex-1 text-right text-xs font-bold tabular-nums',
                          closing >= 0 ? 'text-success' : 'text-destructive',
                        )}>
                          {closing >= 0 ? '+' : ''}{fmtK(closing)}
                        </span>
                      </div>
                      {(income > 0 || expense > 0) && (
                        <div className="mt-1.5">
                          <Progress
                            value={spendPct}
                            className={cn(
                              'h-1',
                              spendPct >= 100 ? '[&>div]:bg-destructive' :
                              spendPct >= 80  ? '[&>div]:bg-warning'     :
                              '[&>div]:bg-primary',
                            )}
                          />
                        </div>
                      )}
                    </button>

                    {/* Expanded panel: mini stats + scrollable transactions */}
                    {isExpanded && (
                      <div className={cn(
                        'rounded-b-xl border-x border-b px-3 py-3 mb-1 space-y-3',
                        colors.border, colors.bg,
                      )}>
                        {/* Mini stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Opening</p>
                            <p className="text-xs font-bold tabular-nums">{fmtK(opening)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Net</p>
                            <p className={cn(
                              'text-xs font-bold tabular-nums',
                              income - expense >= 0 ? 'text-success' : 'text-destructive',
                            )}>
                              {income - expense >= 0 ? '+' : ''}{fmtK(income - expense)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Closing</p>
                            <p className={cn(
                              'text-xs font-bold tabular-nums',
                              closing >= 0 ? 'text-success' : 'text-destructive',
                            )}>
                              {fmtK(closing)}
                            </p>
                          </div>
                        </div>

                        {/* Bug 9: scrollable list, no pagination */}
                        <PersonTxnPanel person={person} txns={monthTxns} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals row */}
            <div className="flex items-center gap-2 px-2 py-2 border-t border-border/50 mt-1 text-xs font-bold">
              <span className="w-20 shrink-0 text-muted-foreground">Total</span>
              <span className="flex-1 text-right text-success tabular-nums">{fmt(totalIncome)}</span>
              <span className="flex-1 text-right text-destructive tabular-nums">{fmt(totalExpense)}</span>
              <span className={cn(
                'flex-1 text-right tabular-nums',
                totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive',
              )}>
                {totalIncome - totalExpense >= 0 ? '+' : ''}{fmtK(totalIncome - totalExpense)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      <TransactionForm />
    </div>
  );
}