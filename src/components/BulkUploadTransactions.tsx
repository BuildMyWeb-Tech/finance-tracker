/**
 * BulkUploadTransactions.tsx
 *
 * Full handwritten-image → AI OCR → editable table → bulk save flow.
 * Supports Claude AI, OpenAI GPT-4o, or Tesseract fallback via env vars.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import {
  PERSONS, ACCOUNTS, HOME_INCOME_CATEGORIES, DEBT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES, DEBT_EXPENSE_CATEGORIES,
  Person, PaymentMode, HomeOrDebt, TransactionType,
} from '@/lib/types';
import type { Transaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Upload, X, Sparkles, CheckCircle2, Loader2, Trash2,
  AlertCircle, ImagePlus, ChevronDown, ChevronUp, Info,
  Eye, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { extractTransactionsFromImages, getActiveProviderName, DraftTransaction } from '@/lib/ai-ocr-provider';


// ─── Types ────────────────────────────────────────────────────────────────────

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  status: 'ready' | 'processing' | 'done' | 'error';
};

type EditableRow = DraftTransaction & {
  _checked: boolean;
  _hasError: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_CATS = [
  ...HOME_INCOME_CATEGORIES,
  ...DEBT_INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...DEBT_EXPENSE_CATEGORIES,
] as string[];

function getCatsForType(type: TransactionType, homeOrDebt: HomeOrDebt): string[] {
  if (type === 'income')
    return homeOrDebt === 'home'
      ? [...HOME_INCOME_CATEGORIES]
      : [...DEBT_INCOME_CATEGORIES];
  if (type === 'expense')
    return homeOrDebt === 'debt'
      ? [...DEBT_EXPENSE_CATEGORIES]
      : [...EXPENSE_CATEGORIES];
  return [];
}

function toBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      res(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function rowHasError(row: EditableRow): boolean {
  if (!row.date || !row.date.match(/^\d{4}-\d{2}-\d{2}$/)) return true;
  if (!row.person) return true;
  if (!row.amount || row.amount <= 0) return true;
  if (row.type !== 'transfer' && !row.category) return true;
  return false;
}

function draftToTransaction(d: DraftTransaction): Omit<Transaction, 'id'> {
  // IMPORTANT: The existing system uses 0-indexed months throughout
  // (TransactionForm: d.getMonth(), FinanceContext: now.getMonth())
  // Must match — do NOT use getMonth() + 1
  const dateObj = new Date(d.date);
  return {
    date: d.date,
    year: dateObj.getFullYear(),
    month: dateObj.getMonth(),   // 0-indexed: Jan=0, Jun=5, Jul=6 — matches rest of app
    person: d.person,
    type: d.type,
    category: d.category,
    amount: d.amount,
    paymentMode: d.paymentMode,
    notes: d.notes,
    transferTo: d.transferTo,
    accountId: d.accountId,
    transferToAccountId: d.transferToAccountId,
    homeOrDebt: d.homeOrDebt,
  };
}

// ─── Row Editor (inline table row) ───────────────────────────────────────────

function RowEditor({
  row,
  index,
  onUpdate,
  onDelete,
}: {
  row: EditableRow;
  index: number;
  onUpdate: (id: string, patch: Partial<EditableRow>) => void;
  onDelete: (id: string) => void;
}) {
  const up = (patch: Partial<EditableRow>) => onUpdate(row._draftId, patch);
  const personAccounts = ACCOUNTS.filter(a => a.person === row.person);
  const toAccounts = row.transferTo ? ACCOUNTS.filter(a => a.person === row.transferTo) : [];
  const cats = getCatsForType(row.type, row.homeOrDebt);

  const cellCls = 'px-1.5 py-1';

  return (
    <tr className={cn(
      'border-b border-border/40 hover:bg-muted/20 transition-colors text-xs',
      row._hasError && 'bg-destructive/5',
    )}>
      {/* # */}
      <td className="px-2 py-1 text-muted-foreground text-center font-mono">{index + 1}</td>

      {/* ✓ checkbox */}
      <td className={cellCls}>
        <input
          type="checkbox"
          checked={row._checked}
          onChange={e => up({ _checked: e.target.checked })}
          className="accent-primary w-3.5 h-3.5 cursor-pointer"
        />
      </td>

      {/* Date */}
      <td className={cellCls}>
        <Input
          type="date"
          value={row.date}
          onChange={e => up({ date: e.target.value })}
          className={cn('h-7 text-xs w-32', !row.date && 'border-destructive')}
        />
      </td>

      {/* Person */}
      <td className={cellCls}>
        <Select value={row.person} onValueChange={v => up({ person: v as Person, accountId: undefined })}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>

      {/* Type */}
      <td className={cellCls}>
        <Select
          value={row.type}
          onValueChange={v => up({ type: v as TransactionType, category: '', transferTo: undefined, transferToAccountId: undefined })}
        >
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Home/Debt */}
      <td className={cellCls}>
        <Select value={row.homeOrDebt} onValueChange={v => up({ homeOrDebt: v as HomeOrDebt, category: '' })}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="debt">Debt</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Category */}
      <td className={cellCls}>
        {row.type === 'transfer' ? (
          <span className="text-muted-foreground italic text-xs">—</span>
        ) : (
          <Select
            value={row.category || '__none__'}
            onValueChange={v => up({ category: v === '__none__' ? '' : v })}
          >
            <SelectTrigger className={cn('h-7 text-xs w-36', !row.category && 'border-destructive')}>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Select —</SelectItem>
              {cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </td>

      {/* Amount */}
      <td className={cellCls}>
        <Input
          type="number"
          min={0}
          value={row.amount || ''}
          onChange={e => up({ amount: parseFloat(e.target.value) || 0 })}
          className={cn('h-7 text-xs w-24', (!row.amount || row.amount <= 0) && 'border-destructive')}
          placeholder="₹"
        />
      </td>

      {/* Payment Mode */}
      <td className={cellCls}>
        <Select value={row.paymentMode} onValueChange={v => up({ paymentMode: v as PaymentMode })}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Account */}
      <td className={cellCls}>
        <Select
          value={row.accountId || '__none__'}
          onValueChange={v => up({ accountId: v === '__none__' ? undefined : v })}
        >
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {personAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>

      {/* Transfer To (only for transfer) */}
      <td className={cellCls}>
        {row.type === 'transfer' ? (
          <div className="flex gap-1">
            <Select
              value={row.transferTo || '__none__'}
              onValueChange={v => up({ transferTo: v === '__none__' ? undefined : (v as Person), transferToAccountId: undefined })}
            >
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue placeholder="To Person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {PERSONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {row.transferTo && (
              <Select
                value={row.transferToAccountId || '__none__'}
                onValueChange={v => up({ transferToAccountId: v === '__none__' ? undefined : v })}
              >
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue placeholder="To Account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {toAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">—</span>
        )}
      </td>

      {/* Notes */}
      <td className={cellCls}>
        <Input
          value={row.notes}
          onChange={e => up({ notes: e.target.value })}
          className="h-7 text-xs w-40"
          placeholder="Notes…"
        />
      </td>

      {/* Delete */}
      <td className={cellCls}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(row._draftId)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </td>
    </tr>
  );
}

// ─── Image Preview Card ───────────────────────────────────────────────────────

function ImageCard({ img, onRemove }: { img: UploadedImage; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative group rounded-xl overflow-hidden border border-border/40 bg-card shadow-sm">
      <div
        className="relative cursor-pointer"
        style={{ height: expanded ? 'auto' : '100px' }}
        onClick={() => setExpanded(v => !v)}
      >
        <img
          src={img.previewUrl}
          alt={img.file.name}
          className="w-full object-cover"
          style={{ height: expanded ? 'auto' : '100px' }}
        />
        {!expanded && (
          <div className="absolute inset-0 bg-black/20 flex items-end p-1.5">
            <span className="text-[10px] text-white/90 font-medium truncate">{img.file.name}</span>
          </div>
        )}
        <div className="absolute top-1 right-1 flex gap-1">
          {img.status === 'processing' && (
            <span className="bg-primary/90 text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing
            </span>
          )}
          {img.status === 'done' && (
            <span className="bg-green-500/90 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> Done
            </span>
          )}
          {img.status === 'error' && (
            <span className="bg-destructive/90 text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> Error
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="p-1.5 text-[10px] text-muted-foreground border-t border-border/40 flex justify-between items-center">
          <span>{img.file.name}</span>
          <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      )}
      <button
        onClick={() => onRemove(img.id)}
        className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/50 text-white hidden group-hover:flex items-center justify-center hover:bg-destructive/80 transition-colors"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Stage = 'upload' | 'processing' | 'review' | 'saving' | 'done';

export default function BulkUploadTransactions() {
  const { addTransaction } = useFinance();

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [stage, setStage] = useState<Stage>('upload');
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [selectAll, setSelectAll] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providerName = getActiveProviderName();

  // ── Image ingestion ────────────────────────────────────────────────────────

  const addFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) { toast.error('Please upload image files only'); return; }

    const newImgs: UploadedImage[] = await Promise.all(
      imageFiles.map(async (file) => {
        const base64 = await toBase64(file);
        const previewUrl = URL.createObjectURL(file);
        return {
          id: 'img-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
          file,
          previewUrl,
          base64,
          mimeType: file.type,
          status: 'ready' as const,
        };
      })
    );
    setImages(prev => [...prev, ...newImgs]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  // ── AI Processing ──────────────────────────────────────────────────────────

  const processImages = async () => {
    if (!images.length) { toast.error('Upload at least one image first'); return; }
    setStage('processing');
    setImages(prev => prev.map(i => ({ ...i, status: 'processing' })));

    try {
      const payload = images.map(i => ({ base64: i.base64, mimeType: i.mimeType }));
      const drafts = await extractTransactionsFromImages(payload);

      setImages(prev => prev.map(i => ({ ...i, status: 'done' })));

      if (!drafts.length) {
        toast.warning('AI found no transactions. Check the images or fill manually.');
        setRows([{
          _draftId: 'draft-manual-' + Date.now(),
          _checked: true,
          _hasError: true,
          date: new Date().toISOString().split('T')[0],
          person: 'Ajai',
          type: 'expense',
          category: '',
          amount: 0,
          paymentMode: 'cash',
          homeOrDebt: 'home',
          notes: '',
        }]);
        setStage('review');
        return;
      }

      const editableRows: EditableRow[] = drafts.map(d => ({
        ...d,
        _checked: true,
        _hasError: rowHasError({ ...d, _checked: true, _hasError: false }),
      }));
      setRows(editableRows);
      toast.success(`${editableRows.length} transactions extracted via ${providerName}!`);
      setStage('review');
    } catch (err: any) {
      setImages(prev => prev.map(i => ({ ...i, status: 'error' })));
      toast.error('AI processing failed: ' + (err?.message || 'Unknown error'));
      setStage('upload');
    }
  };

  // ── Row editing ────────────────────────────────────────────────────────────

  const updateRow = useCallback((draftId: string, patch: Partial<EditableRow>) => {
    setRows(prev => prev.map(r => {
      if (r._draftId !== draftId) return r;
      const updated = { ...r, ...patch };
      updated._hasError = rowHasError(updated);
      return updated;
    }));
  }, []);

  const deleteRow = useCallback((draftId: string) => {
    setRows(prev => prev.filter(r => r._draftId !== draftId));
  }, []);

  const addBlankRow = () => {
    const blank: EditableRow = {
      _draftId: 'draft-blank-' + Date.now().toString(36),
      _checked: true,
      _hasError: true,
      date: new Date().toISOString().split('T')[0],
      person: 'Ajai',
      type: 'expense',
      category: '',
      amount: 0,
      paymentMode: 'cash',
      homeOrDebt: 'home',
      notes: '',
    };
    setRows(prev => [...prev, blank]);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setRows(prev => prev.map(r => ({ ...r, _checked: checked })));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const approveAndSave = async () => {
    const toSave = rows.filter(r => r._checked);
    if (!toSave.length) { toast.error('Select at least one row'); return; }

    const errRows = toSave.filter(r => r._hasError);
    if (errRows.length) {
      toast.error(`Fix ${errRows.length} row(s) with errors (highlighted in red) first`);
      return;
    }

    setStage('saving');
    setSaveProgress({ done: 0, total: toSave.length });

    let saved = 0;
    let failed = 0;

    for (const row of toSave) {
      try {
        const txn = draftToTransaction(row);
        await addTransaction(txn);
        saved++;
        setSaveProgress({ done: saved, total: toSave.length });
      } catch {
        failed++;
      }
    }

    if (failed === 0) {
      toast.success(`${saved} transaction${saved > 1 ? 's' : ''} saved successfully!`);
      setStage('done');
    } else {
      toast.warning(`${saved} saved, ${failed} failed.`);
      setStage('review');
    }
  };

  const reset = () => {
    images.forEach(i => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    setRows([]);
    setStage('upload');
    setSaveProgress({ done: 0, total: 0 });
    setSelectAll(true);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const checkedRows = rows.filter(r => r._checked);
  const errorRows = rows.filter(r => r._hasError);
  const totalAmount = checkedRows.reduce((s, r) => s + (r.amount || 0), 0);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-primary" />
              Upload Account Book
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Upload handwritten pages → AI reads → Edit → Save to DB
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Provider badge */}
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles className="h-2.5 w-2.5 text-primary" />
              {providerName}
            </Badge>
            {stage !== 'upload' && (
              <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs gap-1">
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="max-w-7xl mx-auto mt-2">
          <div className="flex items-center gap-0 text-[10px]">
            {(['upload', 'processing', 'review', 'saving', 'done'] as Stage[]).map((s, i, arr) => (
              <React.Fragment key={s}>
                <span className={cn(
                  'px-2 py-0.5 rounded-full font-medium capitalize',
                  stage === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}>
                  {i + 1}. {s}
                </span>
                {i < arr.length - 1 && <span className="text-border mx-0.5">›</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-4">

        {/* ═══ STAGE: UPLOAD ════════════════════════════════════════════════ */}
        {(stage === 'upload' || stage === 'processing') && (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                dragOver
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {dragOver ? 'Drop images here…' : 'Tap or drag account book images'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JPG, PNG, HEIC — upload multiple pages at once
                  </p>
                </div>
                <Button variant="outline" size="sm" className="pointer-events-none text-xs h-8">
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Choose Images
                </Button>
              </div>
            </div>

            {/* AI provider info */}
            {!images.length && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 flex gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground mb-0.5">AI Provider: {providerName}</p>
                  {/* <p>
                    Set <code className="bg-muted px-1 rounded text-[10px]">VITE_CLAUDE_AI_ENABLED=true</code> +{' '}
                    <code className="bg-muted px-1 rounded text-[10px]">VITE_CLAUDE_AI_TOKEN</code> in your .env for Claude AI.
                    Or <code className="bg-muted px-1 rounded text-[10px]">VITE_OPENAI_ENABLED=true</code> +{' '}
                    <code className="bg-muted px-1 rounded text-[10px]">VITE_OPENAI_API_KEY</code> for GPT-4o.
                  </p> */}
                </div>
              </div>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">
                    {images.length} image{images.length > 1 ? 's' : ''} ready
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] text-destructive" onClick={() => { images.forEach(i => URL.revokeObjectURL(i.previewUrl)); setImages([]); }}>
                    Clear all
                  </Button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {images.map(img => (
                    <ImageCard key={img.id} img={img} onRemove={removeImage} />
                  ))}
                </div>
              </div>
            )}

            {/* Process button */}
            {images.length > 0 && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={processImages}
                  disabled={stage === 'processing'}
                  size="lg"
                  className="gap-2 px-8 font-semibold"
                >
                  {stage === 'processing' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI Reading Handwriting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Extract Transactions with AI
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        {/* ═══ STAGE: REVIEW ════════════════════════════════════════════════ */}
        {stage === 'review' && (
          <>
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {checkedRows.length} selected
                </Badge>
                {errorRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errorRows.length} need fix
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1 font-mono">
                  ₹{totalAmount.toLocaleString('en-IN')} total
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addBlankRow}>
                  + Add Row
                </Button>
                <Button
                  onClick={approveAndSave}
                  disabled={!checkedRows.length || !!errorRows.find(r => r._checked)}
                  size="sm"
                  className="h-7 text-xs gap-1 font-semibold"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & Save ({checkedRows.length})
                </Button>
              </div>
            </div>

            {/* Image thumbnails (collapsed) */}
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground select-none">
                <Eye className="h-3 w-3" />
                View source images ({images.length})
                <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {images.map(img => (
                  <ImageCard key={img.id} img={img} onRemove={() => {}} />
                ))}
              </div>
            </details>

            {/* Error note */}
            {errorRows.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 flex gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Rows highlighted in red have missing/invalid data. Fix them or uncheck to skip.
              </div>
            )}

            {/* Editable table */}
            <div className="rounded-xl border border-border/40 overflow-auto shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/40">
                    <th className="px-2 py-2 text-center text-muted-foreground font-medium w-8">#</th>
                    <th className="px-1.5 py-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={e => handleSelectAll(e.target.checked)}
                        className="accent-primary w-3.5 h-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Date</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Person</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Type</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Home/Debt</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Category</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Amount</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Mode</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Account</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Transfer To</th>
                    <th className="px-1.5 py-2 text-left text-muted-foreground font-medium">Notes</th>
                    <th className="px-1.5 py-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <RowEditor
                      key={row._draftId}
                      row={row}
                      index={i}
                      onUpdate={updateRow}
                      onDelete={deleteRow}
                    />
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No rows. <button onClick={addBlankRow} className="text-primary underline">Add a row manually</button>
                </div>
              )}
            </div>

            {/* Bottom approve button (sticky) */}
            <div className="sticky bottom-20 flex justify-center">
              <Button
                onClick={approveAndSave}
                disabled={!checkedRows.length || !!errorRows.find(r => r._checked)}
                size="lg"
                className="gap-2 px-10 font-semibold shadow-lg"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & Save {checkedRows.length} Transaction{checkedRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        )}

        {/* ═══ STAGE: SAVING ════════════════════════════════════════════════ */}
        {stage === 'saving' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="font-semibold text-foreground">
              Saving transactions…
            </p>
            <div className="w-64">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{saveProgress.done} of {saveProgress.total}</span>
                <span>{Math.round((saveProgress.done / saveProgress.total) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(saveProgress.done / saveProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ STAGE: DONE ══════════════════════════════════════════════════ */}
        {stage === 'done' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="h-20 w-20 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">All saved!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {saveProgress.total} transaction{saveProgress.total !== 1 ? 's' : ''} added to your account book.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1">
                <Upload className="h-3.5 w-3.5" /> Upload More
              </Button>
              <Button size="sm" onClick={() => window.location.href = '/transactions'} className="gap-1">
                <Eye className="h-3.5 w-3.5" /> View Transactions
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}