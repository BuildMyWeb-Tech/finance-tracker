/**
 * SettingsPage.tsx — Updated: RecurringManager replaces old recurring section
 * Replace existing src/pages/SettingsPage.tsx with this file.
 * All existing functionality preserved; RecurringManager replaces the old basic form.
 */

import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  PERSONS, Person, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  ACCOUNTS, IncomeSource, ExpenseSource,
  HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  DEBT_EXPENSE_CATEGORIES,
} from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RecurringManager from '@/components/RecurringManager';
import { toast } from 'sonner';
import { Download, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronUp, Repeat } from 'lucide-react';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function Section({ title, children, defaultOpen = false, icon }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">{icon}<span>{title}</span></div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const {
    state,
    setInitialBalance, setAccountBalance,
    setIncomeSources, setExpenseSources, setAccountNames,
  } = useFinance();

  const [balances, setBalances] = useState(state.initialBalances);
  const [acctBalances, setAcctBalances] = useState(state.accountBalances || {});

  const accountNames = state.accountNames || {};
  const [editingAcct, setEditingAcct] = useState<string | null>(null);
  const [editAcctName, setEditAcctName] = useState('');

  const incomeSources: IncomeSource[] = state.incomeSources || [];
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeGroup, setNewIncomeGroup] = useState<'home' | 'debt'>('home');
  const [newIncomeExpected, setNewIncomeExpected] = useState('');
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editIncomeFields, setEditIncomeFields] = useState<Partial<IncomeSource>>({});
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeSource | null>(null);

  const expenseSources: ExpenseSource[] = state.expenseSources || [];
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseGroup, setNewExpenseGroup] = useState<'home' | 'debt'>('home');
  const [newExpenseBudget, setNewExpenseBudget] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseFields, setEditExpenseFields] = useState<Partial<ExpenseSource>>({});
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseSource | null>(null);

  const saveBalances = () => {
    PERSONS.forEach(p => setInitialBalance(p, balances[p] || 0));
    ACCOUNTS.forEach(a => setAccountBalance(a.id, acctBalances[a.id] || 0));
    toast.success('Opening balances saved');
  };

  const saveAcctName = (id: string) => {
    const updated = { ...accountNames, [id]: editAcctName.trim() || ACCOUNTS.find(a => a.id === id)?.name || id };
    setAccountNames(updated);
    setEditingAcct(null);
    toast.success('Account name updated');
  };

  const getAcctDisplayName = (id: string) =>
    accountNames[id] || ACCOUNTS.find(a => a.id === id)?.name || id;

  const addIncomeSource = () => {
    if (!newIncomeName.trim()) { toast.error('Enter a source name'); return; }
    const builtIn = [...HOME_INCOME_CATEGORIES as readonly string[], ...DEBT_INCOME_CATEGORIES as readonly string[]];
    if (builtIn.includes(newIncomeName.trim()) || incomeSources.some(s => s.name === newIncomeName.trim())) {
      toast.error('Source already exists'); return;
    }
    const updated: IncomeSource[] = [...incomeSources, { id: uid(), name: newIncomeName.trim(), group: newIncomeGroup, defaultExpected: Number(newIncomeExpected) || 0 }];
    setIncomeSources(updated);
    setNewIncomeName(''); setNewIncomeExpected('');
    toast.success('Income source added');
  };

  const saveIncomeEdit = (id: string) => {
    const updated = incomeSources.map(s => s.id === id ? { ...s, ...editIncomeFields } : s);
    setIncomeSources(updated);
    setEditingIncomeId(null);
    toast.success('Income source updated');
  };

  const deleteIncome = (source: IncomeSource) => {
    setIncomeSources(incomeSources.filter(s => s.id !== source.id));
    setDeleteIncomeTarget(null);
    toast.success('Income source deleted');
  };

  const addExpenseSource = () => {
    if (!newExpenseName.trim()) { toast.error('Enter a source name'); return; }
    const builtIn = [...EXPENSE_CATEGORIES as readonly string[], ...DEBT_EXPENSE_CATEGORIES as readonly string[]];
    if (builtIn.includes(newExpenseName.trim()) || expenseSources.some(s => s.name === newExpenseName.trim())) {
      toast.error('Source already exists'); return;
    }
    const updated: ExpenseSource[] = [...expenseSources, { id: uid(), name: newExpenseName.trim(), group: newExpenseGroup, defaultBudget: Number(newExpenseBudget) || 0 }];
    setExpenseSources(updated);
    setNewExpenseName(''); setNewExpenseBudget('');
    toast.success('Expense source added');
  };

  const saveExpenseEdit = (id: string) => {
    const updated = expenseSources.map(s => s.id === id ? { ...s, ...editExpenseFields } : s);
    setExpenseSources(updated);
    setEditingExpenseId(null);
    toast.success('Expense source updated');
  };

  const deleteExpense = (source: ExpenseSource) => {
    setExpenseSources(expenseSources.filter(s => s.id !== source.id));
    setDeleteExpenseTarget(null);
    toast.success('Expense source deleted');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-finance-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        localStorage.setItem('family-finance-data', JSON.stringify(data));
        toast.success('Data imported — refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } catch { toast.error('Invalid file'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* ── ACCOUNT BALANCES ─────────────────────────────────────── */}
      <Section title="Account Opening Balances" defaultOpen>
        <div className="space-y-2 mt-1">
          {ACCOUNTS.map(acc => (
            <div key={acc.id} className="flex items-center gap-3">
              <Label className="w-32 text-xs truncate">{getAcctDisplayName(acc.id)}</Label>
              <Input
                type="number"
                value={acctBalances[acc.id] || ''}
                onChange={e => setAcctBalances(b => ({ ...b, [acc.id]: Number(e.target.value) }))}
                placeholder="0"
                className="text-sm"
              />
            </div>
          ))}
          <Button onClick={saveBalances} className="w-full mt-1" size="sm">Save Balances</Button>
        </div>
      </Section>

      {/* ── ACCOUNT NAMES ────────────────────────────────────────── */}
      <Section title="Account Names (Rename)">
        <div className="space-y-1.5 mt-1">
          {ACCOUNTS.map(acc => (
            <div key={acc.id} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
              {editingAcct === acc.id ? (
                <>
                  <Input className="flex-1 h-7 text-xs" value={editAcctName} onChange={e => setEditAcctName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveAcctName(acc.id); if (e.key === 'Escape') setEditingAcct(null); }} autoFocus />
                  <button onClick={() => saveAcctName(acc.id)} className="text-success shrink-0"><Check className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEditingAcct(null)} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{getAcctDisplayName(acc.id)}</p>
                    {accountNames[acc.id] && <p className="text-[10px] text-muted-foreground">Default: {acc.name}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{acc.type}</span>
                  <button className="text-muted-foreground hover:text-primary shrink-0"
                    onClick={() => { setEditingAcct(acc.id); setEditAcctName(getAcctDisplayName(acc.id)); }}>
                    <Pencil className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── INCOME SOURCES CRUD ──────────────────────────────────── */}
      <Section title="Income Sources (CRUD)">
        <div className="space-y-1 mt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-1">🏠 Built-in Home Income</p>
          {HOME_INCOME_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 text-xs">
              <span className="flex-1">{cat}</span>
              <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Home · Built-in</span>
            </div>
          ))}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">💳 Built-in Debt Income</p>
          {DEBT_INCOME_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 text-xs">
              <span className="flex-1">{cat}</span>
              <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">Debt · Built-in</span>
            </div>
          ))}
          {incomeSources.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">✏️ Custom Sources</p>
              {incomeSources.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-primary/5 border border-primary/10">
                  {editingIncomeId === s.id ? (
                    <>
                      <Input className="flex-1 h-6 text-xs" value={editIncomeFields.name ?? s.name} onChange={e => setEditIncomeFields(f => ({ ...f, name: e.target.value }))} autoFocus />
                      <Select value={editIncomeFields.group ?? s.group} onValueChange={v => setEditIncomeFields(f => ({ ...f, group: v as 'home' | 'debt' }))}>
                        <SelectTrigger className="w-20 h-6 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="home">Home</SelectItem><SelectItem value="debt">Debt</SelectItem></SelectContent>
                      </Select>
                      <Input type="number" placeholder="₹ Expected" className="w-20 h-6 text-xs" value={editIncomeFields.defaultExpected ?? s.defaultExpected} onChange={e => setEditIncomeFields(f => ({ ...f, defaultExpected: Number(e.target.value) }))} />
                      <button onClick={() => saveIncomeEdit(s.id)} className="text-success shrink-0"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingIncomeId(null)} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-medium truncate">{s.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.group === 'home' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>{s.group}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">₹{s.defaultExpected.toLocaleString('en-IN')}</span>
                      <button className="text-muted-foreground hover:text-primary shrink-0" onClick={() => { setEditingIncomeId(s.id); setEditIncomeFields({ name: s.name, group: s.group, defaultExpected: s.defaultExpected }); }}><Pencil className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setDeleteIncomeTarget(s)}><Trash2 className="h-3 w-3" /></button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add New Income Source</p>
            <Input placeholder="Source name" value={newIncomeName} onChange={e => setNewIncomeName(e.target.value)} className="text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newIncomeGroup} onValueChange={v => setNewIncomeGroup(v as 'home' | 'debt')}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="home">🏠 Home</SelectItem><SelectItem value="debt">💳 Debt</SelectItem></SelectContent>
              </Select>
              <Input type="number" placeholder="Default expected ₹" value={newIncomeExpected} onChange={e => setNewIncomeExpected(e.target.value)} className="text-sm" />
            </div>
            <Button onClick={addIncomeSource} className="w-full" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Income Source</Button>
          </div>
        </div>
      </Section>

      {/* ── EXPENSE SOURCES CRUD ─────────────────────────────────── */}
      <Section title="Expense Sources (CRUD)">
        <div className="space-y-1 mt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-2 mb-1">🏠 Built-in Home Expenses</p>
          {EXPENSE_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 text-xs">
              <span className="flex-1">{cat}</span>
              <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full">Home · Built-in</span>
            </div>
          ))}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">💳 Built-in Debt Expenses</p>
          {DEBT_EXPENSE_CATEGORIES.map(cat => (
            <div key={cat} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 text-xs">
              <span className="flex-1">{cat}</span>
              <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-full">Debt · Built-in</span>
            </div>
          ))}
          {expenseSources.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">✏️ Custom Expense Sources</p>
              {expenseSources.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-primary/5 border border-primary/10">
                  {editingExpenseId === s.id ? (
                    <>
                      <Input className="flex-1 h-6 text-xs" value={editExpenseFields.name ?? s.name} onChange={e => setEditExpenseFields(f => ({ ...f, name: e.target.value }))} autoFocus />
                      <Select value={editExpenseFields.group ?? s.group} onValueChange={v => setEditExpenseFields(f => ({ ...f, group: v as 'home' | 'debt' }))}>
                        <SelectTrigger className="w-20 h-6 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="home">Home</SelectItem><SelectItem value="debt">Debt</SelectItem></SelectContent>
                      </Select>
                      <Input type="number" placeholder="₹ Budget" className="w-20 h-6 text-xs" value={editExpenseFields.defaultBudget ?? s.defaultBudget} onChange={e => setEditExpenseFields(f => ({ ...f, defaultBudget: Number(e.target.value) }))} />
                      <button onClick={() => saveExpenseEdit(s.id)} className="text-success shrink-0"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingExpenseId(null)} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-medium truncate">{s.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.group === 'home' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>{s.group}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">₹{s.defaultBudget.toLocaleString('en-IN')}</span>
                      <button className="text-muted-foreground hover:text-primary shrink-0" onClick={() => { setEditingExpenseId(s.id); setEditExpenseFields({ name: s.name, group: s.group, defaultBudget: s.defaultBudget }); }}><Pencil className="h-3 w-3" /></button>
                      <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => setDeleteExpenseTarget(s)}><Trash2 className="h-3 w-3" /></button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add New Expense Source</p>
            <Input placeholder="Expense name" value={newExpenseName} onChange={e => setNewExpenseName(e.target.value)} className="text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newExpenseGroup} onValueChange={v => setNewExpenseGroup(v as 'home' | 'debt')}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="home">🏠 Home</SelectItem><SelectItem value="debt">💳 Debt</SelectItem></SelectContent>
              </Select>
              <Input type="number" placeholder="Default budget ₹" value={newExpenseBudget} onChange={e => setNewExpenseBudget(e.target.value)} className="text-sm" />
            </div>
            <Button onClick={addExpenseSource} className="w-full" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add Expense Source</Button>
          </div>
        </div>
      </Section>

      {/* ── RECURRING ENTRIES — Now uses RecurringManager ─────────── */}
      {/* <Section title="Recurring Transactions" icon={<Repeat className="h-4 w-4 text-primary" />} defaultOpen={false}>
        <div className="mt-2">
          <RecurringManager />
        </div>
      </Section> */}

      {/* ── DATA MANAGEMENT ──────────────────────────────────────── */}
      {/* <Section title="Data Management">
        <div className="flex gap-2 mt-2">
          <Button onClick={exportData} variant="outline" className="flex-1" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export JSON
          </Button>
          <div className="flex-1">
            <label className="flex items-center justify-center gap-1 text-sm font-medium border border-input bg-background rounded-md h-9 px-3 cursor-pointer hover:bg-muted transition-colors">
              Import
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
        </div>
      </Section> */}

      {/* ── DELETE CONFIRMATIONS ─────────────────────────────────── */}
      <AlertDialog open={!!deleteIncomeTarget} onOpenChange={o => { if (!o) setDeleteIncomeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Source?</AlertDialogTitle>
            <AlertDialogDescription>Remove <strong>{deleteIncomeTarget?.name}</strong>? Existing transactions are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteIncomeTarget && deleteIncome(deleteIncomeTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteExpenseTarget} onOpenChange={o => { if (!o) setDeleteExpenseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense Source?</AlertDialogTitle>
            <AlertDialogDescription>Remove <strong>{deleteExpenseTarget?.name}</strong>? Existing transactions are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteExpenseTarget && deleteExpense(deleteExpenseTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}