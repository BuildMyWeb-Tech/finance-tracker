import { useState, useEffect, useRef, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { MONTH_NAMES } from '@/lib/types';
import { Search, X, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { state } = useFinance();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return state.transactions
      .filter(t => {
        const amtStr = String(t.amount);
        return (
          t.category.toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          t.person.toLowerCase().includes(q) ||
          amtStr.includes(q)
        );
      })
      .slice(0, 40);
  }, [query, state.transactions]);

  if (!open) return null;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const typeIcon = (type: string) => {
    if (type === 'income') return <TrendingUp className="h-3.5 w-3.5 text-success shrink-0" />;
    if (type === 'expense') return <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />;
    return <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  const goToTxn = (year: number, month: number) => {
    onClose();
    navigate('/transactions');
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg glass-card rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search transactions… (category, notes, person, amount)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <span className="text-[10px] text-muted-foreground border border-border/50 rounded px-1.5 py-0.5 hidden sm:block">Esc</span>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.length >= 2 && results.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions found</p>
          )}
          {query.length < 2 && (
            <p className="text-center text-xs text-muted-foreground py-6">Type at least 2 characters to search</p>
          )}
          {results.map(t => (
            <button
              key={t.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left border-b border-border/20 last:border-0"
              onClick={() => goToTxn(t.year, t.month)}
            >
              {typeIcon(t.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{t.category}</span>
                  {t.notes && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">— {t.notes}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span>{t.date}</span>
                  <span>·</span>
                  <span>{t.person}</span>
                  {t.notes && (
                    <span className="truncate sm:hidden">— {t.notes}</span>
                  )}
                </div>
              </div>
              <span className={cn(
                'text-sm font-semibold shrink-0',
                t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-destructive' : 'text-foreground',
              )}>
                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
              </span>
            </button>
          ))}
          {results.length === 40 && (
            <p className="text-center text-[11px] text-muted-foreground py-2">Showing first 40 results — refine your search</p>
          )}
        </div>
      </div>
    </div>
  );
}
