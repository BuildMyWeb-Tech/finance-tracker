/**
 * ImportExcelModal.tsx
 * Full-featured import preview modal.
 *
 * Props:
 *   result       — from parseExcelFile()
 *   onConfirm    — called with valid ParsedRows to import
 *   onCancel     — closes the modal
 */

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { ImportResult, ParsedRow } from '@/lib/excel-import';
import { cn } from '@/lib/utils';

interface Props {
  result: ImportResult;
  onConfirm: (rows: ParsedRow[]) => void;
  onCancel: () => void;
}

const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

function ValidRow({ row }: { row: ParsedRow }) {
  const t = row.transaction!;
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-success/5 border border-success/20 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
        <span className="text-muted-foreground shrink-0">Row {row.rowIndex}</span>
        <span className="font-medium truncate">
          {t.type === 'transfer' ? `Transfer → ${t.transferTo}` : t.category}
        </span>
        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{t.type}</Badge>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-muted-foreground">{t.person}</span>
        <span className={cn('font-bold',
          t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-blue-500')}>
          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{fmt(t.amount)}
        </span>
      </div>
    </div>
  );
}

function InvalidRow({ row }: { row: ParsedRow }) {
  return (
    <div className="py-2 px-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
        <span className="text-muted-foreground">Row {row.rowIndex}</span>
        {Object.entries(row.raw).slice(0, 3).map(([k, v]) => (
          <span key={k} className="text-muted-foreground truncate">
            {k}: <span className="text-foreground">{String(v ?? '—')}</span>
          </span>
        ))}
      </div>
      <div className="pl-6 space-y-0.5">
        {row.errors.map((e, i) => (
          <p key={i} className="text-destructive">• {e}</p>
        ))}
      </div>
    </div>
  );
}

function DuplicateRow({ row }: { row: ParsedRow }) {
  const t = row.transaction!;
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-warning/5 border border-warning/20 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
        <span className="text-muted-foreground shrink-0">Row {row.rowIndex}</span>
        <span className="font-medium truncate">
          {t.type === 'transfer' ? `Transfer → ${t.transferTo}` : t.category}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
        <span>{t.person}</span>
        <span>{fmt(t.amount)}</span>
        <span className="text-warning font-semibold">SKIP</span>
      </div>
    </div>
  );
}

export default function ImportExcelModal({ result, onConfirm, onCancel }: Props) {
  const { valid, invalid, duplicates, total } = result;
  const hasValid = valid.length > 0;

  return (
    <Dialog open onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Import Preview
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {total} rows parsed from Excel file
          </p>

          {/* Summary pills */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs bg-success/15 text-success rounded-full px-2.5 py-0.5 font-medium">
              <CheckCircle className="h-3 w-3" /> {valid.length} valid
            </span>
            {duplicates.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-warning/15 text-warning rounded-full px-2.5 py-0.5 font-medium">
                <AlertTriangle className="h-3 w-3" /> {duplicates.length} duplicate
              </span>
            )}
            {invalid.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-destructive/15 text-destructive rounded-full px-2.5 py-0.5 font-medium">
                <XCircle className="h-3 w-3" /> {invalid.length} invalid
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="valid" className="h-full flex flex-col">
            <TabsList className="mx-5 mt-3 shrink-0">
              <TabsTrigger value="valid" className="text-xs flex-1">
                ✅ Valid ({valid.length})
              </TabsTrigger>
              {duplicates.length > 0 && (
                <TabsTrigger value="duplicates" className="text-xs flex-1">
                  ⚠️ Duplicates ({duplicates.length})
                </TabsTrigger>
              )}
              {invalid.length > 0 && (
                <TabsTrigger value="invalid" className="text-xs flex-1">
                  ❌ Invalid ({invalid.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="valid" className="flex-1 overflow-hidden mt-2">
              <ScrollArea className="h-64 px-5">
                <div className="space-y-1.5 pb-4">
                  {valid.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      No valid rows to import.
                    </p>
                  ) : valid.map(row => (
                    <ValidRow key={row.rowIndex} row={row} />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {duplicates.length > 0 && (
              <TabsContent value="duplicates" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-64 px-5">
                  <div className="space-y-1.5 pb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      These rows already exist and will be skipped automatically.
                    </p>
                    {duplicates.map(row => (
                      <DuplicateRow key={row.rowIndex} row={row} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {invalid.length > 0 && (
              <TabsContent value="invalid" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-64 px-5">
                  <div className="space-y-1.5 pb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      These rows have errors and will NOT be imported.
                    </p>
                    {invalid.map(row => (
                      <InvalidRow key={row.rowIndex} row={row} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-4 border-t border-border/50 shrink-0 flex gap-2">
          <Button variant="outline" onClick={onCancel} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(valid)}
            disabled={!hasValid}
            size="sm"
            className="gradient-primary text-primary-foreground flex-1"
          >
            Import {valid.length} Valid Row{valid.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}