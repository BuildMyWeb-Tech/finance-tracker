import { useState, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  PERSONS, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES, ACCOUNTS,
  TransactionType, PaymentMode, Person, HomeOrDebt,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Camera, Loader2, AlertCircle, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── AI Parsing ────────────────────────────────────────────────────────────

interface ParsedBill {
  amount?: number;
  category?: string;
  date?: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
  rawText?: string;
}

async function parseBillImage(base64Image: string, mimeType: string): Promise<ParsedBill> {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Extract transaction details from this bill.
Return JSON ONLY:
{
  "amount": number or null,
  "category": string or null,
  "date": string (YYYY-MM-DD) or null,
  "notes": string or null,
  "confidence": "high" | "medium" | "low",
  "rawText": string
}
If unsure, use null values. Do NOT fail.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }] }],
        max_tokens: 500,
      }),
    });
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); }
    catch { return { amount: null, category: null, date: today, notes: text.slice(0, 50), confidence: 'low', rawText: text }; }
  } catch {
    return { amount: null, category: null, date: today, notes: 'AI failed', confidence: 'low', rawText: '' };
  }
}

// ─── Image Resize ──────────────────────────────────────────────────────────

const resizeImage = (file: File): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target?.result as string; };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1200 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    reader.readAsDataURL(file);
  });

// ─── Image Upload Panel ────────────────────────────────────────────────────

function ImageUploadPanel({ onParsed }: { onParsed: (r: ParsedBill) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
    setError(null); setParsed(null);
    try {
      const dataUrl = await resizeImage(file);
      setPreview(dataUrl);
      setParsing(true);
      const result = await parseBillImage(dataUrl.split(',')[1], 'image/jpeg');
      setParsed(result);
      onParsed(result);
    } catch { setError('Failed to parse image. Please fill in manually.'); }
    finally { setParsing(false); }
  };

  const confidenceColor = { high: 'text-success', medium: 'text-warning', low: 'text-destructive' };

  return (
    <div className="space-y-3">
      {!preview && (
        <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}>
          <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Upload Bill / Receipt</p>
          <p className="text-xs text-muted-foreground mt-1">Tap to capture or drag & drop</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}
      {preview && (
        <div className="space-y-2">
          <div className="relative">
            <img src={preview} alt="Bill" className="w-full max-h-48 object-contain rounded-xl border border-border/40 bg-muted/20" />
            <button onClick={() => { setPreview(null); setParsed(null); setError(null); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 border border-border flex items-center justify-center hover:bg-destructive/10">
              <X className="h-3 w-3" />
            </button>
          </div>
          {parsing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>AI is reading your bill…</span>
            </div>
          )}
          {parsed && !parsing && (
            <div className="bg-success/8 border border-success/20 rounded-lg px-3 py-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-success" />
                <span className="text-xs font-semibold text-success">AI Detected</span>
                {parsed.confidence && (
                  <Badge variant="outline" className={cn('text-[10px] ml-auto', confidenceColor[parsed.confidence])}>
                    {parsed.confidence} confidence
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {parsed.amount && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Amount</span><span className="font-bold">₹{parsed.amount.toLocaleString('en-IN')}</span></div>}
                {parsed.category && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Category</span><span className="font-medium">{parsed.category}</span></div>}
                {parsed.date && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Date</span><span className="font-medium">{parsed.date}</span></div>}
                {parsed.notes && <div className="flex justify-between col-span-2"><span className="text-muted-foreground">Notes</span><span className="font-medium truncate max-w-[160px]">{parsed.notes}</span></div>}
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">↓ Fields pre-filled below — review & edit before saving</p>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          {!parsing && (
            <button onClick={() => fileRef.current?.click()} className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2">
              Upload different image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}
    </div>
  );
}

// ─── Payment Mode Radio ────────────────────────────────────────────────────

function PaymentModeRadio({ value, onChange }: { value: PaymentMode; onChange: (v: PaymentMode) => void }) {
  return (
    <div className="flex items-center gap-6">
      {(['cash', 'bank'] as PaymentMode[]).map(m => (
        <label key={m} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="paymentMode"
            value={m}
            checked={value === m}
            onChange={() => onChange(m)}
            className="accent-primary w-4 h-4"
          />
          <span className="text-sm capitalize text-foreground">{m}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Main Form ─────────────────────────────────────────────────────────────

type FormTab = 'manual' | 'image';

export default function TransactionForm({ onSuccess }: { onSuccess?: () => void }) {
  const { addTransaction, state } = useFinance();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FormTab>('manual');
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    date: today,
    person: '' as string,
    type: 'expense' as TransactionType,
    category: '',
    amount: '',
    expectedAmount: '',
    paymentMode: 'cash' as PaymentMode,
    notes: '',
    transferTo: '' as string,
    accountId: '',
    transferToAccountId: '',
    homeOrDebt: 'home' as HomeOrDebt,
  });

  const customIncomeSources = state.incomeSources || [];
  const customExpenseSources = state.expenseSources || [];

  const homeExpenseCategories = [
    ...EXPENSE_CATEGORIES,
    ...customExpenseSources.filter(s => s.group === 'home').map(s => s.name),
  ];
  const debtExpenseCategories = [
    ...DEBT_EXPENSE_CATEGORIES,
    ...customExpenseSources.filter(s => s.group === 'debt').map(s => s.name),
  ];

  const categories: string[] = form.type === 'income'
    ? form.homeOrDebt === 'home'
      ? [...HOME_INCOME_CATEGORIES, ...customIncomeSources.filter(s => s.group === 'home').map(s => s.name)]
      : [...DEBT_INCOME_CATEGORIES, ...customIncomeSources.filter(s => s.group === 'debt').map(s => s.name)]
    : form.type === 'expense'
      ? form.homeOrDebt === 'debt' ? debtExpenseCategories : homeExpenseCategories
      : [];

  const personAccounts = form.person ? ACCOUNTS.filter(a => a.person === (form.person as Person)) : [];

  // Transfer: show ALL persons including self
  const transferToPersons = PERSONS;

  // Transfer to accounts:
  // - Same person → all accounts EXCEPT selected from-account
  // - Different person → all accounts of that person
  const transferToAccounts = form.transferTo
    ? form.transferTo === form.person
      ? ACCOUNTS.filter(a => a.person === (form.transferTo as Person) && a.id !== form.accountId)
      : ACCOUNTS.filter(a => a.person === (form.transferTo as Person))
    : [];

  const handleParsedBill = (result: ParsedBill) => {
    setForm(f => ({
      ...f,
      amount: result.amount ? String(result.amount) : f.amount,
      date: result.date || f.date,
      notes: result.notes || f.notes,
      category: result.category && homeExpenseCategories.includes(result.category)
        ? result.category
        : debtExpenseCategories.includes(result.category || '')
          ? result.category || f.category
          : f.category,
    }));
    if (result.amount) toast.success(`₹${result.amount.toLocaleString('en-IN')} detected!`);
  };

  const handleSubmit = () => {
    if (!form.person || !form.amount || Number(form.amount) <= 0) {
      toast.error('Please fill required fields'); return;
    }
    if (form.type !== 'transfer' && !form.category) {
      toast.error('Please select a category'); return;
    }
    if (form.type === 'transfer' && !form.transferTo) {
      toast.error('Please select transfer recipient'); return;
    }
    if (form.type === 'transfer' && form.transferToAccountId && form.transferToAccountId === form.accountId) {
      toast.error('Cannot transfer to same account'); return;
    }

    const d = new Date(form.date);
    addTransaction({
      date: form.date,
      year: d.getFullYear(),
      month: d.getMonth(),
      person: form.person as Person,
      type: form.type,
      category: form.type === 'transfer' ? 'Transfer' : form.category,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      notes: form.notes,
      transferTo: form.type === 'transfer' ? form.transferTo as Person : undefined,
      accountId: form.accountId || undefined,
      transferToAccountId: form.type === 'transfer' ? form.transferToAccountId || undefined : undefined,
      homeOrDebt: form.homeOrDebt,
      expectedAmount: form.expectedAmount ? Number(form.expectedAmount) : undefined,
    });

    toast.success('Transaction added');
    setForm({ date: today, person: '', type: 'expense', category: '', amount: '', expectedAmount: '', paymentMode: 'cash', notes: '', transferTo: '', accountId: '', transferToAccountId: '', homeOrDebt: 'home' });
    setTab('manual');
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setTab('manual'); }}>
      <DialogTrigger asChild>
        <Button className="gradient-primary text-primary-foreground rounded-full h-14 w-14 fixed bottom-20 right-4 z-50 shadow-lg hover:shadow-xl transition-shadow">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1 bg-muted/50 rounded-lg p-1">
          {(['manual', 'image'] as FormTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                tab === t ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'manual' ? <><Plus className="h-3.5 w-3.5" /> Manual Entry</> : <><Camera className="h-3.5 w-3.5" /> Scan Bill <span className="text-[9px] bg-primary/15 text-primary px-1 py-0.5 rounded-full font-semibold">AI</span></>}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === 'image' && <ImageUploadPanel onParsed={handleParsedBill} />}
          {tab === 'image' && (
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-border/40" />
              <span className="text-[10px] text-muted-foreground font-medium">Review & Edit Fields</span>
              <div className="flex-1 border-t border-border/40" />
            </div>
          )}

          {/* Type */}
          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
              <Button key={t} variant={form.type === t ? 'default' : 'outline'} size="sm"
                onClick={() => setForm(f => ({ ...f, type: t, category: '' }))} className="capitalize">{t}</Button>
            ))}
          </div>

          {/* Home / Debt */}
          <div className="grid grid-cols-2 gap-2">
            {(['home', 'debt'] as HomeOrDebt[]).map(hd => (
              <Button key={hd} variant={form.homeOrDebt === hd ? 'default' : 'outline'} size="sm"
                onClick={() => setForm(f => ({ ...f, homeOrDebt: hd, category: '' }))}>
                {hd === 'home' ? '🏠 Home' : '💳 Debt'}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={tab === 'image' && form.amount ? 'border-success/50 bg-success/5' : ''} />
            </div>
          </div>

          <div>
            <Label>Expected Amount (₹)</Label>
            <Input type="number" placeholder="Optional" value={form.expectedAmount}
              onChange={e => setForm(f => ({ ...f, expectedAmount: e.target.value }))} />
          </div>

          {/* Person */}
          <div>
            <Label>Person</Label>
            <Select value={form.person} onValueChange={v => setForm(f => ({ ...f, person: v, accountId: '', transferTo: '', transferToAccountId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>{PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* From Account */}
          {form.person && personAccounts.length > 0 && (
            <div>
              <Label>Account</Label>
              <Select value={form.accountId} onValueChange={v => setForm(f => ({ ...f, accountId: v, transferToAccountId: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {/* Transfer or Category */}
          {form.type === 'transfer' ? (
            <>
              <div>
                <Label>Transfer To Person</Label>
                <Select value={form.transferTo} onValueChange={v => setForm(f => ({ ...f, transferTo: v, transferToAccountId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                  <SelectContent>
                    {transferToPersons.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.transferTo && transferToAccounts.length > 0 && (
                <div>
                  <Label>To Account</Label>
                  <Select value={form.transferToAccountId} onValueChange={v => setForm(f => ({ ...f, transferToAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{transferToAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div>
              <Label className="flex items-center gap-1.5">
                Category
                {tab === 'image' && form.category && (
                  <span className="text-[9px] bg-success/15 text-success px-1 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                    <Sparkles className="h-2 w-2" /> AI
                  </span>
                )}
              </Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className={tab === 'image' && form.category ? 'border-success/50 bg-success/5' : ''}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {/* Payment Mode — radio buttons in a row */}
          <div>
            <Label className="block mb-2">Payment Mode</Label>
            <PaymentModeRadio value={form.paymentMode} onChange={v => setForm(f => ({ ...f, paymentMode: v }))} />
          </div>

          <div>
            <Label className="flex items-center gap-1.5">
              Notes
              {tab === 'image' && form.notes && (
                <span className="text-[9px] bg-success/15 text-success px-1 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                  <Sparkles className="h-2 w-2" /> AI
                </span>
              )}
            </Label>
            <Input placeholder="Optional" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={tab === 'image' && form.notes ? 'border-success/50 bg-success/5' : ''} />
          </div>

          <Button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground">
            Add Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}