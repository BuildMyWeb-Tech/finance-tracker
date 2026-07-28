import { jsPDF } from 'jspdf';
declare module 'jspdf-autotable' {
  function autoTable(doc: jsPDF, options: Record<string, unknown>): void;
  export default autoTable;
}