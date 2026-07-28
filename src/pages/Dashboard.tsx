import { useEffect, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  getTotalBalance, getOverspendCategories, getMonthTransactions,
  getAccountBalance, getHomeDebtSummary,
} from '@/lib/financial-store';
import { getCashAccounts, getBankAccounts, MONTH_NAMES, ACCOUNTS } from '@/lib/types';
import MonthSelector from '@/components/MonthSelector';
import TransactionForm from '@/components/TransactionForm';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp, TrendingDown, Wallet,
  AlertTriangle, Home, CreditCard, AlertCircle, Landmark,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectFinancialIssues } from '@/lib/detectFinancialIssues';
import { useState } from 'react';

// ── Real balance diff (from Reports page localStorage) ───────────────────────
const REAL_BAL_KEY = 'finance-real-balances';
function loadRealBalances(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(REAL_BAL_KEY) || '{}'); }
  catch { return {}; }
}

export default function Dashboard() {
  const { state, selectedYear, selectedMonth, missingMoneyLog, logMissingMoney } = useFinance();

  const totals = getTotalBalance(
    state.transactions, selectedYear, selectedMonth,
    state.initialBalances, state.accountBalances,
  );
  const overspend = getOverspendCategories(state.transactions, state.budgets, selectedYear, selectedMonth);
  const topOverspend = overspend
    .filter(o => o.overspent)
    .sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))
    .slice(0, 5);
  const homeDebt = getHomeDebtSummary(state.transactions, selectedYear, selectedMonth);

  const cashAccounts = getCashAccounts();
  const bankAccounts = getBankAccounts();

  const getAccBal = (id: string) =>
    getAccountBalance(state.transactions, id, selectedYear, selectedMonth, state.accountBalances);

  // Opening balance = sum of all account opening balances for the selected month
  const openingBalance = useMemo(() => {
    return ACCOUNTS.reduce((sum, acc) => sum + getAccBal(acc.id).opening, 0);
  }, [state.transactions, state.accountBalances, selectedYear, selectedMonth]);

  const totalCashClosing = cashAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const totalOnlineClosing = bankAccounts.reduce((s, a) => s + getAccBal(a.id).closing, 0);
  const overallClosing = totalCashClosing + totalOnlineClosing;

  // Missing money from account sum vs calculated closing
  const missingAmount = Math.round(Math.abs(totals.closing - overallClosing));

  // Missing money from Reports real-balance diff
  const realBalances = useMemo(() => loadRealBalances(), []);
  const reportsMissingMoney = useMemo(() => {
    let total = 0;
    for (const acc of ACCOUNTS) {
      const closing = getAccBal(acc.id).closing;
      const real = realBalances[acc.id];
      if (real !== undefined) {
        total += real - closing; // positive = extra, negative = missing
      }
    }
    return Math.round(total);
  }, [state.transactions, state.accountBalances, selectedYear, selectedMonth, realBalances]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    logMissingMoney(today, missingAmount);
  }, [missingAmount, logMissingMoney]);

  const missingLog = missingMoneyLog.filter(e => e.amount > 0);
  const savingsRate = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100)
    : 0;

  // Issues
  const issues = useMemo(
    () => detectFinancialIssues(state.transactions, state.accountBalances),
    [state.transactions, state.accountBalances],
  );
  const [issuesOpen, setIssuesOpen] = useState(false);

  const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  const severityColor = (s: string) =>
    s === 'error' ? 'text-destructive' : s === 'warning' ? 'text-warning' : 'text-muted-foreground';
  const severityBg = (s: string) =>
    s === 'error' ? 'bg-destructive/8' : s === 'warning' ? 'bg-warning/8' : 'bg-muted/30';

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Finance Tracker</h1>
        <MonthSelector />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        {MONTH_NAMES[selectedMonth]} {selectedYear}
      </p>

      {/* ── Stats Grid: Opening | Income | Expenses | Balance ── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Opening */}
       
<div className="stat-card rounded-xl text-primary-foreground bg-info">
              <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 opacity-80" />
            <span className="text-xs opacity-90">Opening</span>
          </div>
          <p className="text-lg font-bold">{fmt(openingBalance)}</p>
        </div>

        {/* Income */}
        <div className="stat-card rounded-xl text-primary-foreground bg-success">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 opacity-80" />
            <span className="text-xs opacity-90">Income</span>
          </div>
          <p className="text-lg font-bold">{fmt(totals.income)}</p>
        </div>

        {/* Expenses */}
        <div className="stat-card rounded-xl text-primary-foreground gradient-danger">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 opacity-80" />
            <span className="text-xs opacity-90">Expenses</span>
          </div>
          <p className="text-lg font-bold">{fmt(totals.expense)}</p>
        </div>

        {/* Balance */}
        <div className="stat-card rounded-xl text-primary-foreground gradient-primary">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 opacity-80" />
            <span className="text-xs opacity-90">Balance</span>
          </div>
          <p className="text-lg font-bold">
            {totals.closing >= 0 ? '' : '-'}{fmt(totals.closing)}
          </p>
        </div>
      </div>

      {/* Savings Rate */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Savings Rate</p>
          <span className={cn(
            'text-base font-bold',
            savingsRate >= 20 ? 'text-success' : savingsRate >= 0 ? 'text-warning' : 'text-destructive',
          )}>
            {savingsRate}%
          </span>
        </div>
        <Progress
          value={Math.max(0, Math.min(savingsRate, 100))}
          className={cn(
            'h-2',
            savingsRate >= 20 ? '[&>div]:bg-success' :
            savingsRate >= 0  ? '[&>div]:bg-warning' : '[&>div]:bg-destructive',
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>Income {fmt(totals.income)}</span>
          <span>Expense {fmt(totals.expense)}</span>
          <span className={cn('font-semibold', totals.savings >= 0 ? 'text-success' : 'text-destructive')}>
            Net {totals.savings >= 0 ? '+' : '-'}{fmt(totals.savings)}
          </span>
        </div>
      </div>

      {/* Home vs Debt breakdown */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Monthly Breakdown</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success/8 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Home className="h-3.5 w-3.5 text-success" />
              <span className="text-xs font-semibold text-success">Home</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Income</span>
                <span className="text-success font-medium">+{fmt(homeDebt.homeIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expense</span>
                <span className="text-destructive font-medium">-{fmt(homeDebt.homeExpense)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-1 font-bold">
                <span>Balance</span>
                <span className={homeDebt.homeBalance >= 0 ? 'text-success' : 'text-destructive'}>
                  {homeDebt.homeBalance >= 0 ? '+' : '-'}{fmt(homeDebt.homeBalance)}
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-warning/8 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-semibold text-warning">Debt</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Income</span>
                <span className="text-success font-medium">+{fmt(homeDebt.debtIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expense</span>
                <span className="text-destructive font-medium">-{fmt(homeDebt.debtExpense)}</span>
              </div>
              <div className="flex justify-between border-t border-border/30 pt-1 font-bold">
                <span>Balance</span>
                <span className={homeDebt.debtBalance >= 0 ? 'text-success' : 'text-destructive'}>
                  {homeDebt.debtBalance >= 0 ? '+' : '-'}{fmt(homeDebt.debtBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <p className="text-muted-foreground mb-0.5">Total Income</p>
            <p className="font-bold text-success">{fmt(homeDebt.totalIncome)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Total Expense</p>
            <p className="font-bold text-destructive">{fmt(homeDebt.totalExpense)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Net</p>
            <p className={cn('font-bold', homeDebt.totalBalance >= 0 ? 'text-success' : 'text-destructive')}>
              {homeDebt.totalBalance >= 0 ? '+' : '-'}{fmt(homeDebt.totalBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Missing Money (account reconciliation) ── */}
      <div className={cn('glass-card rounded-xl p-4', missingAmount > 0 ? 'border border-destructive/30' : '')}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {missingAmount > 0 && <AlertCircle className="h-4 w-4 text-destructive" />}
            Missing Money
          </h2>
          <span className={cn('text-lg font-bold', missingAmount > 0 ? 'text-destructive' : 'text-success')}>
            {missingAmount > 0 ? `-${fmt(missingAmount)}` : '✓ ₹0'}
          </span>
        </div>
        {missingAmount > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Calculated: {fmt(totals.closing)} · Accounts: {fmt(overallClosing)}
          </p>
        )}

        {/* Reports real-balance missing money */}
        {reportsMissingMoney !== 0 && (
          <div className={cn(
            'mt-2 rounded-lg px-3 py-2 text-xs flex justify-between items-center',
            reportsMissingMoney < 0 ? 'bg-destructive/10' : 'bg-warning/10',
          )}>
            <span className="text-muted-foreground">Real Balance Difference</span>
            <span className={cn('font-bold', reportsMissingMoney < 0 ? 'text-destructive' : 'text-warning')}>
              {reportsMissingMoney > 0 ? '+' : ''}{fmt(reportsMissingMoney)}
              {reportsMissingMoney < 0 ? ' missing' : ' extra'}
            </span>
          </div>
        )}

        {missingLog.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">History</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {missingLog.map((entry, i) => {
                const prev = i > 0 ? missingLog[i - 1].amount : null;
                const diff = prev !== null ? entry.amount - prev : null;
                return (
                  <div key={entry.date} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-2">
                      {diff !== null && diff !== 0 && (
                        <span className={cn('text-[10px]', diff > 0 ? 'text-destructive' : 'text-success')}>
                          {diff > 0 ? `▲${fmt(diff)}` : `▼${fmt(Math.abs(diff))}`}
                        </span>
                      )}
                      <span className="font-semibold text-destructive">{fmt(entry.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Issues Panel ── */}
      {/* {issues.length > 0 && (
        <div className={cn(
          'glass-card rounded-xl p-4',
          issues.some(i => i.severity === 'error') ? 'border border-destructive/30' : 'border border-warning/30',
        )}>
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setIssuesOpen(o => !o)}
          >
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className={cn('h-4 w-4',
                issues.some(i => i.severity === 'error') ? 'text-destructive' : 'text-warning')} />
              Financial Issues
              <span className={cn(
                'text-[10px] font-bold rounded-full px-2 py-0.5',
                issues.some(i => i.severity === 'error') ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning',
              )}>
                {issues.length}
              </span>
            </h2>
            {issuesOpen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {issuesOpen && (
            <div className="mt-3 space-y-2">
              {issues.map(issue => (
                <div
                  key={issue.id}
                  className={cn('rounded-lg p-3 text-xs space-y-1', severityBg(issue.severity))}
                >
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', severityColor(issue.severity))} />
                    <p className={cn('font-semibold', severityColor(issue.severity))}>{issue.title}</p>
                  </div>
                  <p className="text-muted-foreground pl-5">{issue.description}</p>
                  <p className="text-primary pl-5">
                    <span className="font-semibold">Suggestion: </span>{issue.suggestion}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )} */}

      {/* Budget Alerts */}
      {topOverspend.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Overspend Budget Alerts
          </h2>
          <div className="space-y-2">
            {topOverspend.map(o => (
              <div key={o.category}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-destructive font-medium">{o.category}</span>
                  <span className="text-destructive font-semibold text-xs">
                    {fmt(o.actual - o.budget)} over
                  </span>
                </div>
                <Progress value={100} className="h-1 [&>div]:bg-destructive" />
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/50">
              <span>Total Overspend</span>
              <span className="text-destructive">
                {fmt(topOverspend.reduce((s, o) => s + (o.actual - o.budget), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      <TransactionForm />
    </div>
  );
}