/**
 * SettingsPage.tsx — Fully Dynamic CRUD Settings
 * Section 0: Family Members (persons) — controls who appears in every dropdown
 * Section 1: Accounts CRUD — per-person cash/bank accounts
 * Section 2: Opening Balances — uses only accounts from Section 1
 * Section 3: Income Sources CRUD
 * Section 4: Expense Sources CRUD
 * Zero hardcode — everything flows from DB via FinanceContext.
 */

import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import type { Account, IncomeSource, ExpenseSource } from '@/lib/types';
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
  TrendingDown, IndianRupee, Users,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(name: string, person: string) {
  return `${person.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
}

// ─── Accordion Section ────────────────────────────────────────────────────────

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
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function GroupBadge({ group }: { group: 'home' | 'debt' }) {
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

// ─── Generic Source Row ───────────────────────────────────────────────────────

type AnySource = IncomeSource | ExpenseSource;

function SourceRow<T extends AnySource>({
  source, isEditing, editFields, setEditFields,
  onEdit, onSave, onCancel, onDelete, amountKey, amountLabel,
}: {
  source: T; isEditing: boolean;
  editFields: Partial<T>; setEditFields: (f: Partial<T>) => void;
  onEdit: () => void; onSave: () => void; onCancel: () => void;
  onDelete: () => void; amountKey: string; amountLabel: string;
}) {
  const amt = (source as any)[amountKey] as number;
  const editAmt = (editFields as any)[amountKey];
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs mb-1">
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
          <GroupBadge group={source.group} />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    state,
    setAccountBalance,
    setIncomeSources,
    setExpenseSources,
    setCustomAccounts,
    setCustomPersons,
  } = useFinance();

  const persons: string[]  = state.customPersons  ?? [];
  const accounts: Account[] = state.customAccounts ?? [];

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 0 — PERSONS CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const [newPersonName, setNewPersonName]   = useState('');
  const [editingPersonIdx, setEditingPersonIdx] = useState<number | null>(null);
  const [editPersonVal, setEditPersonVal]   = useState('');
  const [deletePersonTarget, setDeletePersonTarget] = useState<string | null>(null);

  const addPerson = () => {
    const name = newPersonName.trim();
    if (!name) { toast.error('Enter a name'); return; }
    if (persons.some(p => p.toLowerCase() === name.toLowerCase())) {
      toast.error('Person already exists'); return;
    }
    setCustomPersons([...persons, name]);
    setNewPersonName('');
    toast.success(`${name} added`);
  };

  const savePersonEdit = (idx: number) => {
    const name = editPersonVal.trim();
    if (!name) { toast.error('Enter a name'); return; }
    const updated = [...persons];
    updated[idx] = name;
    setCustomPersons(updated);
    // Also update accounts that reference old name
    const oldName = persons[idx];
    const updatedAccounts = accounts.map(a =>
      a.person === oldName ? { ...a, person: name } : a
    );
    setCustomAccounts(updatedAccounts);
    setEditingPersonIdx(null);
    toast.success('Updated');
  };

  const deletePerson = (name: string) => {
    setCustomPersons(persons.filter(p => p !== name));
    // Also remove accounts belonging to this person
    setCustomAccounts(accounts.filter(a => a.person !== name));
    setDeletePersonTarget(null);
    toast.success(`${name} removed`);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — ACCOUNTS CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const [newAcctPerson, setNewAcctPerson] = useState('');
  const [newAcctName, setNewAcctName]     = useState('');
  const [newAcctType, setNewAcctType]     = useState<'cash' | 'bank'>('cash');
  const [editingAcctId, setEditingAcctId] = useState<string | null>(null);
  const [editAcctFields, setEditAcctFields] = useState<Partial<Account>>({});
  const [deleteAcctTarget, setDeleteAcctTarget] = useState<Account | null>(null);

  const addAccount = () => {
    if (!newAcctPerson) { toast.error('Select a person'); return; }
    if (!newAcctName.trim()) { toast.error('Enter account name'); return; }
    const id = slugify(newAcctName, newAcctPerson);
    if (accounts.some(a => a.name.toLowerCase() === newAcctName.trim().toLowerCase() && a.person === newAcctPerson)) {
      toast.error('Account already exists for this person'); return;
    }
    setCustomAccounts([...accounts, { id, person: newAcctPerson, name: newAcctName.trim(), type: newAcctType }]);
    setNewAcctName('');
    toast.success('Account added');
  };

  const saveAcctEdit = (id: string) => {
    setCustomAccounts(accounts.map(a => a.id === id ? { ...a, ...editAcctFields } : a));
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
  const [newIncomeName, setNewIncomeName]         = useState('');
  const [newIncomeGroup, setNewIncomeGroup]       = useState<'home' | 'debt'>('home');
  const [newIncomeExpected, setNewIncomeExpected] = useState('');
  const [editingIncomeId, setEditingIncomeId]     = useState<string | null>(null);
  const [editIncomeFields, setEditIncomeFields]   = useState<Partial<IncomeSource>>({});
  const [deleteIncomeTarget, setDeleteIncomeTarget] = useState<IncomeSource | null>(null);

  const addIncomeSource = () => {
    if (!newIncomeName.trim()) { toast.error('Enter source name'); return; }
    if (incomeSources.some(s => s.name.toLowerCase() === newIncomeName.trim().toLowerCase())) {
      toast.error('Income source already exists'); return;
    }
    setIncomeSources([...incomeSources, {
      id: uid(), name: newIncomeName.trim(),
      group: newIncomeGroup, defaultExpected: Number(newIncomeExpected) || 0,
    }]);
    setNewIncomeName(''); setNewIncomeExpected('');
    toast.success('Income source added');
  };

  const saveIncomeEdit = (id: string) => {
    setIncomeSources(incomeSources.map(s => s.id === id ? { ...s, ...editIncomeFields } : s));
    setEditingIncomeId(null);
    toast.success('Updated');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — EXPENSE SOURCES CRUD
  // ══════════════════════════════════════════════════════════════════════════

  const expenseSources: ExpenseSource[] = state.expenseSources ?? [];
  const [newExpenseName, setNewExpenseName]       = useState('');
  const [newExpenseGroup, setNewExpenseGroup]     = useState<'home' | 'debt'>('home');
  const [newExpenseBudget, setNewExpenseBudget]   = useState('');
  const [editingExpenseId, setEditingExpenseId]   = useState<string | null>(null);
  const [editExpenseFields, setEditExpenseFields] = useState<Partial<ExpenseSource>>({});
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseSource | null>(null);

  const addExpenseSource = () => {
    if (!newExpenseName.trim()) { toast.error('Enter expense name'); return; }
    if (expenseSources.some(s => s.name.toLowerCase() === newExpenseName.trim().toLowerCase())) {
      toast.error('Expense source already exists'); return;
    }
    setExpenseSources([...expenseSources, {
      id: uid(), name: newExpenseName.trim(),
      group: newExpenseGroup, defaultBudget: Number(newExpenseBudget) || 0,
    }]);
    setNewExpenseName(''); setNewExpenseBudget('');
    toast.success('Expense source added');
  };

  const saveExpenseEdit = (id: string) => {
    setExpenseSources(expenseSources.map(s => s.id === id ? { ...s, ...editExpenseFields } : s));
    setEditingExpenseId(null);
    toast.success('Updated');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pb-20 px-4 pt-4 max-w-lg mx-auto space-y-4 animate-slide-up">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* ── SECTION 0: FAMILY MEMBERS ─────────────────────────────────────── */}
      <Section
        title={`Family Members (${persons.length})`}
        defaultOpen
        icon={<Users className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1.5 mt-2">
          {persons.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No family members yet. Add them below — they will appear in all dropdowns.
            </p>
          )}

          {persons.map((person, idx) => (
            <div key={idx} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs mb-1">
              {editingPersonIdx === idx ? (
                <>
                  <Input
                    className="flex-1 h-6 text-xs"
                    value={editPersonVal}
                    onChange={e => setEditPersonVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePersonEdit(idx)}
                    autoFocus
                  />
                  <button onClick={() => savePersonEdit(idx)} className="text-green-500 shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingPersonIdx(null)} className="text-muted-foreground shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-base">👤</span>
                  <span className="flex-1 font-medium">{person}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {accounts.filter(a => a.person === person).length} accounts
                  </span>
                  <button
                    onClick={() => { setEditingPersonIdx(idx); setEditPersonVal(person); }}
                    className="text-muted-foreground hover:text-primary shrink-0"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDeletePersonTarget(person)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add Family Member</p>
            <div className="flex gap-2">
              <Input
                placeholder="Name (e.g. Appa, Ajai, Amma…)"
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPerson()}
                className="text-sm flex-1"
              />
              <Button onClick={addPerson} size="sm" className="shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SECTION 1: ACCOUNTS CRUD ───────────────────────────────────────── */}
      <Section
        title={`Accounts (${accounts.length})`}
        icon={<Wallet className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1 mt-2">
          {accounts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              Add family members first, then add their accounts here.
            </p>
          )}

          {persons.map(person => {
            const personAccounts = accounts.filter(a => a.person === person);
            if (!personAccounts.length) return null;
            return (
              <div key={person}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">
                  {person}
                </p>
                {personAccounts.map(acct => (
                  <div key={acct.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs mb-1">
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
                          onClick={() => { setEditingAcctId(acct.id); setEditAcctFields({ name: acct.name, type: acct.type }); }}
                          className="text-muted-foreground hover:text-primary shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setDeleteAcctTarget(acct)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
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

          {/* Accounts for persons not yet listed above */}
          {accounts.filter(a => !persons.includes(a.person)).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">Other</p>
              {accounts.filter(a => !persons.includes(a.person)).map(acct => (
                <div key={acct.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-muted/20 border border-border/30 text-xs mb-1">
                  <span className="flex-1 font-medium truncate">{acct.name}</span>
                  <span className="text-[10px] text-muted-foreground">{acct.person}</span>
                  <button onClick={() => setDeleteAcctTarget(acct)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-foreground">Add Account</p>
            {persons.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add family members first.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newAcctPerson} onValueChange={setNewAcctPerson}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Person" /></SelectTrigger>
                    <SelectContent>
                      {persons.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
              </>
            )}
          </div>
        </div>
      </Section>

      {/* ── SECTION 2: OPENING BALANCES ───────────────────────────────────── */}
      <Section
        title="Opening Balances"
        icon={<IndianRupee className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-2 mt-2">
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Add accounts first, then set their opening balances.
            </p>
          ) : (
            <>
              {persons.map(person => {
                const pa = accounts.filter(a => a.person === person);
                if (!pa.length) return null;
                return (
                  <div key={person}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-1">
                      {person}
                    </p>
                    {pa.map(acc => (
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

      {/* ── SECTION 3: INCOME SOURCES CRUD ────────────────────────────────── */}
      <Section
        title={`Income Sources (${incomeSources.length})`}
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1 mt-2">
          {incomeSources.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No income sources yet. Add below.
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
              placeholder="Name (e.g. Appa Salary, Vaati)"
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

      {/* ── SECTION 4: EXPENSE SOURCES CRUD ───────────────────────────────── */}
      <Section
        title={`Expense Sources (${expenseSources.length})`}
        icon={<TrendingDown className="h-4 w-4 text-primary" />}
      >
        <div className="space-y-1 mt-2">
          {expenseSources.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No expense sources yet. Add below.
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
              placeholder="Name (e.g. Rent, Milk, Petrol)"
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

      {/* ── DELETE DIALOGS ───────────────────────────────────────────────────── */}

      <AlertDialog open={!!deletePersonTarget} onOpenChange={o => { if (!o) setDeletePersonTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deletePersonTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove all accounts belonging to <strong>{deletePersonTarget}</strong>.
              Existing transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePersonTarget && deletePerson(deletePersonTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAcctTarget} onOpenChange={o => { if (!o) setDeleteAcctTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteAcctTarget?.name}</strong>? Existing transactions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAcctTarget && deleteAccount(deleteAcctTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
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
              onClick={() => { if (deleteIncomeTarget) { setIncomeSources(incomeSources.filter(x => x.id !== deleteIncomeTarget.id)); setDeleteIncomeTarget(null); toast.success('Deleted'); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
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
              onClick={() => { if (deleteExpenseTarget) { setExpenseSources(expenseSources.filter(x => x.id !== deleteExpenseTarget.id)); setDeleteExpenseTarget(null); toast.success('Deleted'); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}