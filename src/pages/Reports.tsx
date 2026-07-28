import { useState, useMemo, useCallback } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getTotalBalance, getHomeDebtSummary, getMonthTransactions,
  getAccountBalance, rc,
} from '@/lib/financial-store';
import {
  ACCOUNTS, getCashAccounts, getBankAccounts, MONTH_NAMES,
  HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES, DEBT_EXPENSE_CATEGORIES,
} from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import DataControls from '@/components/DataControls';
import OverspendAnalytics from '@/components/OverspendAnalytics';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  Home, CreditCard, BarChart2, Pencil, Check, X, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type ReportTab = 'summary' | 'analytics';

// Grid column layout — shared by header + every row so alignment is pixel-perfect
// [account-name] [opening] [closing] [real-bal] [diff]
const COL_GRID = 'grid grid-cols-[1fr_68px_68px_78px_60px] gap-x-2 items-center';

export default function Reports() {
  const { state, selectedYear, selectedMonth, setRealBalance, isSyncing } = useFinance();
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  // ── Real balance edit state ────────────────────────────────────────────────
  const [editingRealBal, setEditingRealBal] = useState<string | null>(null);
  const [editRealValue, setEditRealValue] = useState('');

  const realBalances = state.realBalances ?? {};

  const handleStartEditReal = (accId: string) => {
    const current = realBalances[accId];
    const accBal = getAccountBalance(state.transactions, accId, selectedYear, selectedMonth, state.accountBalances);
    setEditingRealBal(accId);
    setEditRealValue(String(current !== undefined ? current : accBal.closing));
  };

  const handleSaveReal = useCallback(async (accId: string) => {
    const val = Number(editRealValue);
    if (isNaN(val)) { toast.error('Enter a valid number'); return; }
    setEditingRealBal(null);
    await setRealBalance(accId, val);
    toast.success('Real balance saved to cloud ☁️');
  }, [editRealValue, setRealBalance]);

  const handleCancelEdit = () => setEditingRealBal(null);

  // ── Core data ──────────────────────────────────────────────────────────────
  const totals    = getTotalBalance(state.transactions, selectedYear, selectedMonth, state.initialBalances, state.accountBalances);
  const homeDebt  = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);
  const monthTxns = getMonthTransactions(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();

  const getAccBal = (id: string) =>
    getAccountBalance(state.transactions, id, selectedYear, selectedMonth, state.accountBalances);

  const totalCashOpening   = cashAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalCashClosing   = cashAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const totalOnlineOpening = bankAccounts.reduce((s, a) => s + getAccBal(a.id).opening, 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const overallOpening     = totalCashOpening + totalOnlineOpening;
  const overallClosing     = totalCashClosing + totalOnlineClosing;

  // ── Total real balances — only shown when ALL accounts in group have real set ──
  const allCashHaveReal  = cashAccounts.every(a => realBalances[a.id] !== undefined);
  const allBankHaveReal  = bankAccounts.every(a => realBalances[a.id] !== undefined);

  const totalCashReal  = allCashHaveReal
    ? cashAccounts.reduce((s, a) => rc(s + (realBalances[a.id] ?? 0)), 0)
    : undefined;
  const totalBankReal  = allBankHaveReal
    ? bankAccounts.reduce((s, a) => rc(s + (realBalances[a.id] ?? 0)), 0)
    : undefined;
  const overallReal    = totalCashReal !== undefined && totalBankReal !== undefined
    ? rc(totalCashReal + totalBankReal)
    : undefined;

  // ── Missing money (sum of all real-balance differences) ───────────────────
  const missingMoneyFromReal = useMemo(() => {
    let total = 0;
    for (const acc of ACCOUNTS) {
      const real = realBalances[acc.id];
      if (real !== undefined) {
        const closing = getAccBal(acc.id).closing;
        total = rc(total + (real - closing));
      }
    }
    return total;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realBalances, state.transactions, state.accountBalances, selectedYear, selectedMonth]);

  const prevMonth  = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear   = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevTotals = getTotalBalance(state.transactions, prevYear, prevMonth, state.initialBalances, state.accountBalances);
  const diff       = overallClosing - prevTotals.closing;

  const fmt       = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;
  const fmtSigned = (n: number) => `${n >= 0 ? '+' : '-'}₹${Math.abs(n).toLocaleString('en-IN')}`;

  const savingsRate = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;

  // ── Account Balance Row ────────────────────────────────────────────────────
  function AccRow({
    accId,
    label,
    opening,
    closing,
    bold = false,
    realOverride,
    diffOverride,
  }: {
    accId?: string;
    label: string;
    opening: number;
    closing: number;
    bold?: boolean;
    realOverride?: number;
    diffOverride?: number;
  }) {
    const realVal  = accId !== undefined ? realBalances[accId] : realOverride;
    const difference =
      accId !== undefined && realVal !== undefined
        ? rc(realVal - closing)
        : diffOverride !== undefined
          ? diffOverride
          : null;
    const isEditing = accId !== undefined && editingRealBal === accId;

    return (
      <div className={cn(
        COL_GRID,
        'text-xs py-2',
        bold
          ? 'font-bold border-t border-border/50 mt-1 pt-2.5 bg-muted/30 rounded-lg px-2 -mx-2'
          : 'px-1',
      )}>
        {/* Account name */}
        <span className={cn(
          'truncate leading-tight',
          bold ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {label}
        </span>

        {/* Opening */}
        <span className={cn(
          'tabular-nums text-right',
          bold ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {fmt(opening)}
        </span>

        {/* Closing */}
        <span className={cn(
          'tabular-nums text-right font-medium',
          !bold && closing < 0 ? 'text-destructive' : 'text-foreground',
        )}>
          {fmt(closing)}
        </span>

        {/* Real Balance — editable per-account, aggregate for totals */}
        <div className="flex items-center justify-end min-w-0">
          {accId !== undefined ? (
            isEditing ? (
              <div className="flex items-center gap-0.5">
                <Input
                  type="number"
                  className="w-14 h-6 text-xs px-1 tabular-nums text-right"
                  value={editRealValue}
                  onChange={e => setEditRealValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveReal(accId);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleSaveReal(accId)}
                  className="text-success shrink-0 p-0.5"
                  title="Save"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-muted-foreground shrink-0 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-0.5 group tabular-nums hover:text-primary transition-colors text-right"
                onClick={() => handleStartEditReal(accId)}
                title="Tap to set real balance"
              >
                <span className={cn(
                  'text-right',
                  realVal === undefined ? 'text-muted-foreground/40 italic text-[10px]' : 'text-foreground',
                )}>
                  {realVal !== undefined ? fmt(realVal) : 'Set'}
                </span>
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 shrink-0 ml-0.5" />
              </button>
            )
          ) : realOverride !== undefined ? (
            <span className="tabular-nums text-right font-medium">{fmt(realOverride)}</span>
          ) : (
            <span className="text-muted-foreground/30 text-[10px]">—</span>
          )}
        </div>

        {/* Diff = Real − Closing */}
        <div className="text-right tabular-nums">
          {difference !== null ? (
            <span className={cn(
              'font-semibold text-[11px]',
              difference > 0  ? 'text-success' :
              difference < 0  ? 'text-destructive' :
              'text-muted-foreground',
            )}>
              {difference > 0
                ? `+${fmt(difference)}`
                : difference < 0
                  ? `-${fmt(Math.abs(difference))}`
                  : '₹0'}
            </span>
          ) : (
            <span className="text-muted-foreground/30 text-[10px]">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Monthly Summary</h1>
        <MonthSelector />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{MONTH_NAMES[selectedMonth]} {selectedYear}</p>
        <DataControls year={selectedYear} month={selectedMonth} />
      </div>

      {/* Sync indicator */}
      {isSyncing && (
        <div className="text-[10px] text-primary/70 flex items-center gap-1.5 px-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Saving to cloud…
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
        {(['summary', 'analytics'] as ReportTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 text-xs font-semibold rounded-lg py-2 transition-all flex items-center justify-center gap-1',
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'summary'
              ? '📊 Monthly Summary'
              : <><BarChart2 className="h-3 w-3" /> Overspend Analytics</>}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' ? <OverspendAnalytics /> : (
        <>
          {/* ── Balance Flow ───────────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-5 border border-primary/20">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Balance Flow</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-base font-bold tabular-nums">{fmt(overallOpening)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pl-4 border-l-2 border-success/40">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <p className="text-sm text-muted-foreground">+ Total Income</p>
                </div>
                <p className="text-sm font-bold text-success tabular-nums">+{fmt(totals.income)}</p>
              </div>
              <div className="flex items-center justify-between pl-4 border-l-2 border-destructive/40">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-muted-foreground">- Total Expense</p>
                </div>
                <p className="text-sm font-bold text-destructive tabular-nums">-{fmt(totals.expense)}</p>
              </div>
              <div className="border-t border-border/50 pt-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    overallClosing >= overallOpening ? 'bg-success/15' : 'bg-destructive/15',
                  )}>
                    <Wallet className={cn('h-4 w-4', overallClosing >= overallOpening ? 'text-success' : 'text-destructive')} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ending Balance</p>
                    <p className={cn(
                      'text-xl font-bold tabular-nums',
                      overallClosing >= overallOpening ? 'text-success' : 'text-destructive',
                    )}>
                      {fmt(overallClosing)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">vs last month</p>
                  <p className={cn('text-sm font-semibold flex items-center gap-1 justify-end', diff >= 0 ? 'text-success' : 'text-destructive')}>
                    {diff >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {fmtSigned(diff)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stat cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Income</p>
              <p className="text-lg font-bold text-success tabular-nums">{fmt(totals.income)}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Home</span><span className="tabular-nums">{fmt(homeDebt.homeIncome)}</span>
                </div>
                <Progress value={totals.income > 0 ? (homeDebt.homeIncome / totals.income) * 100 : 0}
                  className="h-1 [&>div]:bg-success" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Debt</span><span className="tabular-nums">{fmt(homeDebt.debtIncome)}</span>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Expense</p>
              <p className="text-lg font-bold text-destructive tabular-nums">{fmt(totals.expense)}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Home</span><span className="tabular-nums">{fmt(homeDebt.homeExpense)}</span>
                </div>
                <Progress value={totals.expense > 0 ? (homeDebt.homeExpense / totals.expense) * 100 : 0}
                  className="h-1 [&>div]:bg-destructive" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Debt</span><span className="tabular-nums">{fmt(homeDebt.debtExpense)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Savings rate ───────────────────────────────────────────────── */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Savings Rate</p>
              <span className={cn(
                'text-lg font-bold',
                savingsRate >= 20 ? 'text-success' : savingsRate >= 0 ? 'text-warning' : 'text-destructive',
              )}>
                {savingsRate}%
              </span>
            </div>
            <Progress
              value={Math.max(0, Math.min(savingsRate, 100))}
              className={cn('h-3',
                savingsRate >= 20 ? '[&>div]:bg-success' :
                savingsRate >= 0  ? '[&>div]:bg-warning' : '[&>div]:bg-destructive')}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span className="tabular-nums">
                Net: {totals.income - totals.expense >= 0 ? '+' : ''}{fmt(totals.income - totals.expense)}
              </span>
              <span>{savingsRate >= 20 ? '✅ Great!' : savingsRate >= 0 ? '⚠️ Low' : '🔴 Overspent'}</span>
            </div>
          </div>

          {/* ── Home vs Debt ───────────────────────────────────────────────── */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-4">Home vs Debt Split</h2>
            <div className="rounded-xl bg-success/8 p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Home className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold text-success">Home</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income</span>
                  <span className="font-medium text-success tabular-nums">+{fmt(homeDebt.homeIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expense</span>
                  <span className="font-medium text-destructive tabular-nums">-{fmt(homeDebt.homeExpense)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
                  <span>Balance</span>
                  <span className={cn('tabular-nums', homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive')}>
                    {homeDebt.homeBalance >= 0 ? '+' : '-'}{fmt(homeDebt.homeBalance)}
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-warning/8 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-warning">Debt</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income</span>
                  <span className="font-medium text-success tabular-nums">+{fmt(homeDebt.debtIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expense</span>
                  <span className="font-medium text-destructive tabular-nums">-{fmt(homeDebt.debtExpense)}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1 font-bold text-sm">
                  <span>Balance</span>
                  <span className={cn('tabular-nums', homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive')}>
                    {homeDebt.debtBalance >= 0 ? '+' : '-'}{fmt(homeDebt.debtBalance)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
              <div className="flex justify-between text-sm font-bold">
                <span>Total Income</span>
                <span className="text-success tabular-nums">+{fmt(homeDebt.totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Total Expense</span>
                <span className="text-destructive tabular-nums">-{fmt(homeDebt.totalExpense)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-primary pt-1 border-t border-border/50">
                <span>Net Balance</span>
                <span className="tabular-nums">
                  {homeDebt.totalBalance >= 0 ? '+' : '-'}{fmt(homeDebt.totalBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Account Balances table ─────────────────────────────────────── */}
          <div className="glass-card rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-0.5">Account Balances</h2>
            <p className="text-[10px] text-muted-foreground mb-4 leading-relaxed">
              Tap <span className="font-medium text-foreground/60">Real Bal</span> to enter the actual physical
              amount — saves to cloud ☁️. <span className="font-medium">Diff = Real − System closing.</span>{' '}
              Totals appear once all accounts in the group have a real balance set.
            </p>

            {/* Column headers */}
            <div className={cn(
              COL_GRID,
              'text-[10px] font-semibold text-muted-foreground uppercase tracking-wider',
              'border-b border-border/40 pb-2 mb-1 px-1',
            )}>
              <span>Account</span>
              <span className="text-right">Opening</span>
              <span className="text-right">Closing</span>
              <span className="text-right">Real Bal</span>
              <span className="text-right">Diff</span>
            </div>

            {/* ── CASH ── */}
            <div className="mt-3 mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
                Cash
              </p>
              <div className="space-y-0">
                {cashAccounts.map(acc => {
                  const bal = getAccBal(acc.id);
                  return (
                    <AccRow
                      key={acc.id}
                      accId={acc.id}
                      label={acc.name}
                      opening={bal.opening}
                      closing={bal.closing}
                    />
                  );
                })}
                <AccRow
                  label="Total Cash"
                  opening={totalCashOpening}
                  closing={totalCashClosing}
                  bold
                  realOverride={totalCashReal}
                  diffOverride={
                    totalCashReal !== undefined
                      ? rc(totalCashReal - totalCashClosing)
                      : undefined
                  }
                />
              </div>
            </div>

            {/* ── BANK / ONLINE ── */}
            <div className="mt-4 mb-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1">
                Bank / Online
              </p>
              <div className="space-y-0">
                {bankAccounts.map(acc => {
                  const bal = getAccBal(acc.id);
                  return (
                    <AccRow
                      key={acc.id}
                      accId={acc.id}
                      label={acc.name}
                      opening={bal.opening}
                      closing={bal.closing}
                    />
                  );
                })}
                <AccRow
                  label="Total Bank"
                  opening={totalOnlineOpening}
                  closing={totalOnlineClosing}
                  bold
                  realOverride={totalBankReal}
                  diffOverride={
                    totalBankReal !== undefined
                      ? rc(totalBankReal - totalOnlineClosing)
                      : undefined
                  }
                />
              </div>
            </div>

            {/* ── OVERALL ── */}
            <div className="mt-2">
              <AccRow
                label="Overall Total"
                opening={overallOpening}
                closing={overallClosing}
                bold
                realOverride={overallReal}
                diffOverride={
                  overallReal !== undefined
                    ? rc(overallReal - overallClosing)
                    : undefined
                }
              />
            </div>

            {/* ── Missing / Extra Money summary ── */}
            {missingMoneyFromReal !== 0 && (
              <div className={cn(
                'mt-4 rounded-xl p-3 text-xs flex items-center justify-between gap-3',
                missingMoneyFromReal < 0
                  ? 'bg-destructive/10 border border-destructive/20'
                  : 'bg-warning/10 border border-warning/20',
              )}>
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className={cn(
                    'h-4 w-4 shrink-0',
                    missingMoneyFromReal < 0 ? 'text-destructive' : 'text-warning',
                  )} />
                  <div className="min-w-0">
                    <p className={cn(
                      'font-semibold',
                      missingMoneyFromReal < 0 ? 'text-destructive' : 'text-warning',
                    )}>
                      {missingMoneyFromReal < 0 ? '⚠️ Missing Money' : '✨ Extra Money Found'}
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      Sum of all Real Balance differences
                    </p>
                  </div>
                </div>
                <span className={cn(
                  'text-base font-bold tabular-nums shrink-0',
                  missingMoneyFromReal < 0 ? 'text-destructive' : 'text-warning',
                )}>
                  {missingMoneyFromReal > 0 ? '+' : ''}{fmt(Math.abs(missingMoneyFromReal))}
                  {missingMoneyFromReal < 0 ? ' short' : ' extra'}
                </span>
              </div>
            )}

            {missingMoneyFromReal === 0 && Object.keys(realBalances).length > 0 && (
              <div className="mt-4 rounded-xl p-3 text-xs flex items-center gap-2 bg-success/10 border border-success/20">
                <span className="text-success font-semibold">✓ Accounts balanced</span>
                <span className="text-muted-foreground">Real balances match system exactly</span>
              </div>
            )}
          </div>
        </>
      )}

      <TransactionForm />
    </div>
  );
}