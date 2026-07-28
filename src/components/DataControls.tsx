/**
 * DataControls.tsx
 * Drop this anywhere you need Export/Import buttons (Transactions page, Reports page, etc.)
 *
 * Usage:
 *   import DataControls from '@/components/DataControls';
 *   <DataControls />
 *
 * Or with optional year/month for PDF scoping:
 *   <DataControls year={selectedYear} month={selectedMonth} />
 */

import React, { useRef, useState } from 'react';
import { FileDown, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useFinance } from '@/contexts/FinanceContext';
import { exportTransactionsToExcel } from '@/lib/excel-export';
import { parseExcelFile, buildTransactions, ImportResult } from '@/lib/excel-import';
import { exportReportAsPDF } from '@/lib/pdf-export';
import ImportExcelModal from './ImportExcelModal';

interface Props {
  /** If provided, the PDF will be scoped to this month. Defaults to context selection. */
  year?:  number;
  month?: number;
}

type LoadingKey = 'excel-export' | 'excel-import' | 'pdf' | null;

export default function DataControls({ year: propYear, month: propMonth }: Props) {
  const { state, selectedYear, selectedMonth, addTransaction } = useFinance();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading,       setLoading]       = useState<LoadingKey>(null);
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null);

  const year  = propYear  ?? selectedYear;
  const month = propMonth ?? selectedMonth;

  // ── Excel Export ──────────────────────────────────────────────────────────

  const handleExcelExport = async () => {
    if (state.transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    setLoading('excel-export');
    try {
      // Small timeout so the spinner renders before heavy XLSX work
      await new Promise(r => setTimeout(r, 50));
      exportTransactionsToExcel(state.transactions, state.accountBalances);
      toast.success('Excel file downloaded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  // ── Excel Import ──────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    if (!file.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are supported');
      return;
    }

    setLoading('excel-import');
    try {
      const result = await parseExcelFile(file, state.transactions);
      setImportResult(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(null);
    }
  };

  const handleImportConfirm = async (rows: import('@/lib/excel-import').ParsedRow[]) => {
    setImportResult(null);
    const txns = buildTransactions(rows);
    if (txns.length === 0) {
      toast.info('No transactions to import');
      return;
    }

    setLoading('excel-import');
    try {
      // Add in sequence (each triggers Supabase sync)
      for (const t of txns) {
        const { id, ...rest } = t;
        await addTransaction(rest);
      }
      toast.success(`✅ Imported ${txns.length} transaction${txns.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(null);
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────

  const handlePDFExport = async () => {
    setLoading('pdf');
    try {
      await new Promise(r => setTimeout(r, 50));
      exportReportAsPDF(state, year, month);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setLoading(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap gap-2">
        {/* Export Excel */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExcelExport}
          disabled={loading !== null}
          className="gap-1.5 text-xs"
        >
          {loading === 'excel-export'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileDown className="h-3.5 w-3.5 text-success" />}
          Export Excel
        </Button>

        {/* Import Excel */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading !== null}
          className="gap-1.5 text-xs"
        >
          {loading === 'excel-import'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileUp className="h-3.5 w-3.5 text-primary" />}
          Import Excel
        </Button>

        {/* Export PDF */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePDFExport}
          disabled={loading !== null}
          className="gap-1.5 text-xs"
        >
          {loading === 'pdf'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileDown className="h-3.5 w-3.5 text-destructive" />}
          Export PDF
        </Button>
      </div>

      {/* Import Preview Modal */}
      {importResult && (
        <ImportExcelModal
          result={importResult}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportResult(null)}
        />
      )}
    </>
  );
}