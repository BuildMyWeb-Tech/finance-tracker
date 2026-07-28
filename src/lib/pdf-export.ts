/**
 * pdf-export.ts
 * Generates a multi-section finance report PDF using jsPDF + jspdf-autotable.
 *
 * Usage:
 *   import { exportReportAsPDF } from '@/lib/pdf-export';
 *   exportReportAsPDF(state, selectedYear, selectedMonth);
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FinancialState, ACCOUNTS, MONTH_NAMES,
} from './types';
import {
  getTotalBalance, getAccountBalance, getMonthTransactions,
  getCashAccounts, getBankAccounts, rc,
} from './financial-store';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Colours ────────────────────────────────────────────────────────────────

const C = {
  primary:     [99,  102, 241] as [number,number,number],   // indigo
  success:     [22,  163,  74] as [number,number,number],   // green
  danger:      [220,  38,  38] as [number,number,number],   // red
  warning:     [217, 119,   6] as [number,number,number],   // amber
  dark:        [30,  41,  59] as [number,number,number],    // slate-800
  light:       [248, 250, 252] as [number,number,number],   // slate-50
  border:      [226, 232, 240] as [number,number,number],   // slate-200
  mutedText:   [100, 116, 139] as [number,number,number],   // slate-500
};

// ── Main export ────────────────────────────────────────────────────────────

export function exportReportAsPDF(
  state: FinancialState,
  year: number,
  month: number,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();   // 210
  const PH = doc.internal.pageSize.getHeight();  // 297
  const MARGIN = 14;
  const COL = PW - MARGIN * 2;
  let y = MARGIN;

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  const totals     = getTotalBalance(
    state.transactions, year, month,
    state.initialBalances, state.accountBalances,
  );
  const monthTxns  = getMonthTransactions(state.transactions, year, month);
  const cashAccs   = getCashAccounts();
  const bankAccs   = getBankAccounts();

  // ── Helpers ──────────────────────────────────────────────────────────────

  const checkPageBreak = (needed: number) => {
    if (y + needed > PH - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawPageNumber();
    }
  };

  const drawPageNumber = () => {
    const total = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(...C.mutedText);
    doc.text(`Page ${total}`, PW - MARGIN, PH - 6, { align: 'right' });
    doc.text(`Realm Rich Reporter · ${monthLabel}`, MARGIN, PH - 6);
  };

  const sectionTitle = (title: string) => {
    checkPageBreak(14);
    y += 4;
    doc.setFillColor(...C.primary);
    doc.rect(MARGIN, y, 3, 7, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text(title, MARGIN + 6, y + 5.5);
    y += 12;
  };

  // ── 1. HEADER ─────────────────────────────────────────────────────────────

  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PW, 28, 'F');
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Finance Report', MARGIN, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(monthLabel, MARGIN, 20);
  doc.setTextColor(255, 255, 255);
  const savings = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : 0;
  doc.setFontSize(9);
  doc.text(`Savings Rate: ${savings}%`, PW - MARGIN, 13, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, PW - MARGIN, 20, { align: 'right' });

  y = 36;

  // ── 2. SUMMARY CARDS ──────────────────────────────────────────────────────

  const cardW  = (COL - 4) / 3;
  const cards  = [
    { label: 'Total Income',  val: fmt(totals.income),  color: C.success },
    { label: 'Total Expense', val: fmt(totals.expense), color: C.danger  },
    { label: 'Net Balance',   val: fmt(totals.income - totals.expense),
      color: totals.income >= totals.expense ? C.success : C.danger },
  ];

  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + 2);
    doc.setDrawColor(...C.border);
    doc.setFillColor(...C.light);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.mutedText);
    doc.text(c.label.toUpperCase(), x + 4, y + 5.5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...c.color);
    doc.text(c.val, x + 4, y + 13.5);
  });

  y += 24;

  // ── 3. ACCOUNT BALANCES ───────────────────────────────────────────────────

  sectionTitle('Account Balances');

  const allAccs = [...cashAccs, ...bankAccs];
  const accRows = allAccs.map(acc => {
    const bal  = getAccountBalance(state.transactions, acc.id, year, month, state.accountBalances);
    const diff = rc(bal.closing - bal.opening);
    return [
      acc.name,
      acc.type.charAt(0).toUpperCase() + acc.type.slice(1),
      fmt(bal.opening),
      fmt(bal.closing),
      (diff >= 0 ? '+' : '-') + fmt(diff),
    ];
  });

  const totalOpening = allAccs.reduce((s, a) =>
    s + getAccountBalance(state.transactions, a.id, year, month, state.accountBalances).opening, 0);
  const totalClosing = allAccs.reduce((s, a) =>
    s + getAccountBalance(state.transactions, a.id, year, month, state.accountBalances).closing, 0);
  const totalDiff    = rc(totalClosing - totalOpening);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Account', 'Type', 'Opening', 'Closing', 'Difference']],
    body: accRows,
    foot: [['Total', '', fmt(totalOpening), fmt(totalClosing),
      (totalDiff >= 0 ? '+' : '-') + fmt(totalDiff)]],
    headStyles:  { fillColor: C.dark, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    footStyles:  { fillColor: C.primary, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles:  { fontSize: 8, textColor: C.dark },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 18, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    didParseCell: (data) => {
      // colour the Difference column
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw ?? '');
        data.cell.styles.textColor = text.startsWith('+') ? C.success : C.danger;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 4. TRANSACTIONS TABLE ─────────────────────────────────────────────────

  sectionTitle(`Transactions (${monthTxns.length} entries)`);

  const txnRows = monthTxns
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(t => {
      const accName = t.accountId
        ? (ACCOUNTS.find(a => a.id === t.accountId)?.name ?? t.accountId)
        : '';
      return [
        fmtDate(t.date),
        t.person,
        t.type.charAt(0).toUpperCase() + t.type.slice(1),
        t.type === 'transfer' ? `→ ${t.transferTo ?? ''}` : (t.category ?? ''),
        fmt(t.amount),
        accName,
        t.notes ?? '',
      ];
    });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Date', 'Person', 'Type', 'Category', 'Amount', 'Account', 'Notes']],
    body: txnRows,
    headStyles: { fillColor: C.dark, textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7.5, textColor: C.dark },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16 },
      2: { cellWidth: 18 },
      3: { cellWidth: 32 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 28 },
      6: { cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2) return;
      const type = String(data.cell.raw ?? '').toLowerCase();
      data.cell.styles.textColor =
        type === 'income'   ? C.success :
        type === 'expense'  ? C.danger  : C.primary;
      data.cell.styles.fontStyle = 'bold';
    },
    // Handle page breaks automatically
    showHead: 'everyPage',
  });

  // ── Footer on every page ──────────────────────────────────────────────────

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...C.mutedText);
    doc.text(
      `Page ${i} of ${totalPages}`,
      PW - MARGIN,
      PH - 6,
      { align: 'right' },
    );
    doc.text(`Realm Rich Reporter · ${monthLabel}`, MARGIN, PH - 6);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  doc.save(`finance-report-${todayISO()}.pdf`);
}