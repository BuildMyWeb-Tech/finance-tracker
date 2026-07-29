/**
 * SettingsPage.tsx — Fully Dynamic CRUD Settings
 * All 4 sections are 100% database-driven — no hardcoded built-ins shown.
 * Accounts, Balances, Income Sources, Expense Sources all fully CRUD.
 */

import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { PERSONS, Person, Account } from '@/lib/types';
import type { IncomeSource, ExpenseSource } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, Check, X,
  ChevronDown, ChevronUp, Wallet, TrendingUp,
  TrendingDown, IndianRupee,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(name: string, person: string) {
  return `${person.toLowerCase()}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
}

// ─── Section Accordion ───────────────────────────────────────────────────────

function Section({
  title, children, defaultOpen = false, icon,
}: {
  title: string; children: React.ReactNode;
  defaultOpen?: boolean; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
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

// ─── Badge ───────────────────────────────────────────────────────────────────

function Badge({ group }: { group: 'home' | 'debt' }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${
      group === 'home'
        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
        : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    }`}>
      {group === 'home' ? '🏠' : '💳'} {group}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    state,
    setAccountBalance,
    setIncomeSources,
    setExpenseSources,
    setCustomAccounts,
  } = useFinance();

  // ── Derive dynamic accounts (fall back to empty — no hardcode) ────────────
  const accounts: Account[] = state.customAccounts ?? [];

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — ACCOUNTS CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const [newAcctPerson, setNewAcctPerson] = useState<Person>('Ajai');
  const [newAcctName, setNewAcctName]     = useState('');
  const [newAcctType, setNewAcctType]     = useState<'cash' | 'bank'>('cash');

  const [editingAcctId, setEditingAcctId]   = useState<string | null>(null);
  const [editAcctFields, setEditAcctFields] = useState<Partial<Account>>({});
  const [deleteAcctTarget, setDeleteAcctTarget] = useState<Account | null>(null);

  const addAccount = () => {
    if (!newAcctName.trim()) { toast.error('Enter account name'); return; }
    const id = slugify(newAcctName, newAcctPerson);
    if (accounts.some(a => a.id === id || a.name.toLowerCase() === newAcctName.trim().toLowerCase())) {
      toast.error('Account already exists'); return;
    }
    const updated: Account[] = [
      ...accounts,
      { id, person: newAcctPerson, name: newAcctName.trim(), type: newAcctType },
    ];
    setCustomAccounts(updated);
    setNewAcctName('');
    toast.success('Account added');
  };

  const saveAcctEdit = (id: string) => {
    const updated = accounts.map(a =>
      a.id === id ? { ...a, ...editAcctFields } : a
    );
    setCustomAccounts(updated);
    setEditingAcctId(null);
    toast.success('Account updated');
  };

  const deleteAccount = (acct: Account) => {
    setCustomAccounts(accounts.filter(a => a.id !== acct.id));
    setDeleteAcctTarget(null);
    toast.success('Account deleted');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — OPENING BALANCES
  // ══════════════════════════════════════════════════════════════════════════

  const [acctBalances, setAcctBalances] = useState<Record<string, number>>(
    state.accountBalances || {}
  );

  const saveBalances = async () => {
    for (const acc of accounts) {
      await setAccountBalance(acc.id, acctBalances[acc.id] || 0);
    }
    toast.success('Opening balances saved');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — INCOME SOURCES CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const incomeSources: IncomeSource[] = state.incomeSources ?? [];

  const [newIncomeName, setNewIncomeName]       = useState('');
  const [newIncomeGroup, setNewIncomeGroup]     = useState<'home' | 'debt'>('home');
  const [newIncomeExpected, setNewIncomeExpected] = useState('');

  const [editingIncomeId, setEditingIncomeId]   = useState<string | null>(null);
  const [editIncomeFields, setEditIncomeFields] = useState<Partial<IncomeSource>>({});
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeSource | null>(null);

  const addIncomeSource = () => {
    if (!newIncomeName.trim()) { toast.error('Enter source name'); return; }
    if (incomeSources.some(s => s.name.toLowerCase() === newIncomeName.trim().toLowerCase())) {
      toast.error('Income source already exists'); return;
    }
    const updated: IncomeSource[] = [
      ...incomeSources,
      {
        id: uid(),
        name: newIncomeName.trim(),
        group: newIncomeGroup,
        defaultExpected: Number(newIncomeExpected) || 0,
      },
    ];
    setIncomeSources(updated);
    setNewIncomeName(''); setNewIncomeExpected('');
    toast.success('Income source added');
  };

  const saveIncomeEdit = (id: string) => {
    setIncomeSources(incomeSources.map(s => s.id === id ? { ...s, ...editIncomeFields } : s));
    setEditingIncomeId(null);
    toast.success('Updated');
  };

  const deleteIncome = (s: IncomeSource) => {
    setIncomeSources(incomeSources.filter(x => x.id !== s.id));
    setDeleteIncomeTarget(null);
    toast.success('Deleted');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — EXPENSE SOURCES CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const expenseSources: ExpenseSource[] = state.expenseSources ?? [];

  const [newExpenseName, setNewExpenseName]     = useState('');
  const [newExpenseGroup, setNewExpenseGroup]   = useState<'home' | 'debt'>('home');
  const [newExpenseBudget, setNewExpenseBudget] = useState('');

  const [editingExpenseId, setEditingExpenseId]   = useState<string | null>(null);
  const [editExpenseFields, setEditExpenseFields] = useState<Partial<ExpenseSource>>({});
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseSource | null>(null);

  const addExpenseSource = () => {
    if (!newExpenseName.trim()) { toast.error('Enter expense name'); return; }
    if (expenseSources.some(s => s.name.toLowerCase() === newExpenseName.trim().toLowerCase())) {
      toast.error('Expense source already exists'); return;
    }
    const updated: ExpenseSource[] = [
      ...expenseSources,
      {
        id: uid(),
        name: newExpenseName.trim(),
        group: newExpenseGroup,
        defaultBudget: Number(newExpenseBudget) || 0,
      },
    ];
    setExpenseSources(updated);
    setNewExpenseName(''); setNewExpenseBudget('');
    toast.success('Expense source added');
  };

  const saveExpenseEdit = (id: string) => {
    setExpenseSources(expenseSources.map(s => s.id === id ? { ...s, ...editExpenseFields } : s));
    setEditingExpenseId(null);
    toast.success('Updated');
  };

  const deleteExpense = (s: ExpenseSource) => {
    setExpenseSources(expenseSources.filter(x => x.id !== s.id));
    setDeleteExpenseTarget(null);
    toast.success('Deleted');
  };

  // ─── Row component for income/expense ─────────────────────────────────────

  function SourceRow<T extends IncomeSource | ExpenseSource>({
    source, isEditing, editFields, setEditFields,
    onEdit, onSave, onCancel, onDelete,
    amountKey, amountLabel,
  }: {
    source: T; isEditing: boolean;
    editFields: Partial<T>; setEditFields: (f: Partial<T>) => void;
    onEdit: () => void; onSave: () => void; onCancel: () => void;
    onDelete: () => void; amountKey: string; amountLabel: string;
  }) {
    const amt = (source as any)[amountKey] as number;
    const editAmt = (editFields as any)[amountKey];
    return (
      <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs">
        {isEditing ? (
          <>
            <Input
              className="flex-1 h-6 text-xs min-w-0"
              value={(editFields.name ?? source.name) as string}
              onChange={e => setEditFields({ ...editFields, name: e.target.value } as Partial<T>)}
              autoFocus
            />
            <Select
              value={(editFields.group ?? source.group) as string}
              onValueChange={v => setEditFields({ ...editFields, group: v as 'home' | 'debt' } as Partial<T>)}
            >
              <SelectTrigger className="w-20 h-6 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">🏠 Home</SelectItem>
                <SelectItem value="debt">💳 Debt</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder={amountLabel}
              className="w-20 h-6 text-xs"
              value={editAmt ?? amt}
              onChange={e => setEditFields({ ...editFields, [amountKey]: Number(e.target.value) } as Partial<T>)}
            />
            <button onClick={onSave} className="text-green-500 shrink-0"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={onCancel} className="text-muted-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          <>
            <span className="flex-1 font-medium truncate">{source.name}</span>
            <Badge group={source.group} />
            {amt > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                ₹{amt.toLocaleString('en-IN')}
              </span>
            )}
            <button onClick={onEdit} className="text-muted-foreground hover:text-primary shrink-0">
              <Pencil className="h-3 w-3" />
            </button>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* ── SECTION 1: ACCOUNTS CRUD ───────────────────────────────────── */}
      <Section
        title={`Accounts (${accounts.length})`}
        defaultOpen
        icon={<Wallet className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1.5 mt-2">
          {accounts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No accounts yet. Add your first account below.
            </p>
          )}

          {/* Group by person */}
          {PERSONS.map(person => {
            const personAccounts = accounts.filter(a => a.person === person);
            if (!personAccounts.length) return null;
            return (
              <div key={person}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">
                  {person}
                </p>
                {personAccounts.map(acct => (
                  <div
                    key={acct.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs mb-1"
                  >
                    {editingAcctId === acct.id ? (
                      <>
                        <Input
                          className="flex-1 h-6 text-xs"
                          value={(editAcctFields.name ?? acct.name) as string}
                          onChange={e => setEditAcctFields(f => ({ ...f, name: e.target.value }))}
                          autoFocus
                        />
                        <Select
                          value={(editAcctFields.type ?? acct.type) as string}
                          onValueChange={v => setEditAcctFields(f => ({ ...f, type: v as 'cash' | 'bank' }))}
                        >
                          <SelectTrigger className="w-20 h-6 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">💵 Cash</SelectItem>
                            <SelectItem value="bank">🏦 Bank</SelectItem>
                          </SelectContent>
                        </Select>
                        <button onClick={() => saveAcctEdit(acct.id)} className="text-green-500 shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingAcctId(null)} className="text-muted-foreground shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium truncate">{acct.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {acct.type === 'cash' ? '💵 cash' : '🏦 bank'}
                        </span>
                        <button
                          className="text-muted-foreground hover:text-primary shrink-0"
                          onClick={() => { setEditingAcctId(acct.id); setEditAcctFields({ name: acct.name, type: acct.type }); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setDeleteAcctTarget(acct)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add new account */}
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add Account</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newAcctPerson} onValueChange={v => setNewAcctPerson(v as Person)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Person" /></SelectTrigger>
                <SelectContent>
                  {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newAcctType} onValueChange={v => setNewAcctType(v as 'cash' | 'bank')}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 Cash</SelectItem>
                  <SelectItem value="bank">🏦 Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Account name (e.g. Ajai SBI, Appa Cash)"
              value={newAcctName}
              onChange={e => setNewAcctName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAccount()}
              className="text-sm"
            />
            <Button onClick={addAccount} className="w-full" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Account
            </Button>
          </div>
        </div>
      </Section>

      {/* ── SECTION 2: OPENING BALANCES ────────────────────────────────── */}
      <Section
        title="Account Opening Balances"
        icon={<IndianRupee className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-2 mt-2">
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Add accounts first, then set their opening balances.
            </p>
          ) : (
            <>
              {PERSONS.map(person => {
                const personAccounts = accounts.filter(a => a.person === person);
                if (!personAccounts.length) return null;
                return (
                  <div key={person}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-1">
                      {person}
                    </p>
                    {personAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center gap-3 mb-1.5">
                        <Label className="w-32 text-xs truncate shrink-0">{acc.name}</Label>
                        <Input
                          type="number"
                          value={acctBalances[acc.id] || ''}
                          onChange={e => setAcctBalances(b => ({ ...b, [acc.id]: Number(e.target.value) }))}
                          placeholder="0"
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
              <Button onClick={saveBalances} className="w-full mt-1" size="sm">
                Save Balances
              </Button>
            </>
          )}
        </div>
      </Section>

      {/* ── SECTION 3: INCOME SOURCES CRUD ─────────────────────────────── */}
      <Section
        title={`Income Sources (${incomeSources.length})`}
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1.5 mt-2">
          {incomeSources.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No income sources yet. Add your first one below.
            </p>
          )}
          {incomeSources.map(s => (
            <SourceRow
              key={s.id}
              source={s}
              isEditing={editingIncomeId === s.id}
              editFields={editIncomeFields as Partial<IncomeSource>}
              setEditFields={f => setEditIncomeFields(f as Partial<IncomeSource>)}
              onEdit={() => { setEditingIncomeId(s.id); setEditIncomeFields({ name: s.name, group: s.group, defaultExpected: s.defaultExpected }); }}
              onSave={() => saveIncomeEdit(s.id)}
              onCancel={() => setEditingIncomeId(null)}
              onDelete={() => setDeleteIncomeTarget(s)}
              amountKey="defaultExpected"
              amountLabel="₹ Expected"
            />
          ))}

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add Income Source</p>
            <Input
              placeholder="Source name (e.g. Appa Salary, Vaati)"
              value={newIncomeName}
              onChange={e => setNewIncomeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIncomeSource()}
              className="text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newIncomeGroup} onValueChange={v => setNewIncomeGroup(v as 'home' | 'debt')}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">🏠 Home</SelectItem>
                  <SelectItem value="debt">💳 Debt</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Default expected ₹"
                value={newIncomeExpected}
                onChange={e => setNewIncomeExpected(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button onClick={addIncomeSource} className="w-full" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Income Source
            </Button>
          </div>
        </div>
      </Section>

      {/* ── SECTION 4: EXPENSE SOURCES CRUD ────────────────────────────── */}
      <Section
        title={`Expense Sources (${expenseSources.length})`}
        icon={<TrendingDown className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1.5 mt-2">
          {expenseSources.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No expense sources yet. Add your first one below.
            </p>
          )}
          {expenseSources.map(s => (
            <SourceRow
              key={s.id}
              source={s}
              isEditing={editingExpenseId === s.id}
              editFields={editExpenseFields as Partial<ExpenseSource>}
              setEditFields={f => setEditExpenseFields(f as Partial<ExpenseSource>)}
              onEdit={() => { setEditingExpenseId(s.id); setEditExpenseFields({ name: s.name, group: s.group, defaultBudget: s.defaultBudget }); }}
              onSave={() => saveExpenseEdit(s.id)}
              onCancel={() => setEditingExpenseId(null)}
              onDelete={() => setDeleteExpenseTarget(s)}
              amountKey="defaultBudget"
              amountLabel="₹ Budget"
            />
          ))}

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add Expense Source</p>
            <Input
              placeholder="Expense name (e.g. Rent, Milk, Petrol)"
              value={newExpenseName}
              onChange={e => setNewExpenseName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExpenseSource()}
              className="text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={newExpenseGroup} onValueChange={v => setNewExpenseGroup(v as 'home' | 'debt')}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">🏠 Home</SelectItem>
                  <SelectItem value="debt">💳 Debt</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Default budget ₹"
                value={newExpenseBudget}
                onChange={e => setNewExpenseBudget(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button onClick={addExpenseSource} className="w-full" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense Source
            </Button>
          </div>
        </div>
      </Section>

      {/* ── DELETE CONFIRMATIONS ─────────────────────────────────────────── */}

      <AlertDialog open={!!deleteAcctTarget} onOpenChange={o => { if (!o) setDeleteAcctTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteAcctTarget?.name}</strong>? This won't delete transactions that used it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAcctTarget && deleteAccount(deleteAcctTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteIncomeTarget} onOpenChange={o => { if (!o) setDeleteIncomeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Source?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteIncomeTarget?.name}</strong>? Existing transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIncomeTarget && deleteIncome(deleteIncomeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteExpenseTarget} onOpenChange={o => { if (!o) setDeleteExpenseTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense Source?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteExpenseTarget?.name}</strong>? Existing transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseTarget && deleteExpense(deleteExpenseTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}