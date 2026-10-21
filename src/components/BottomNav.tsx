import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, TrendingUp,
  PieChart, BarChart3, Settings, TableProperties,
  BarChart2, LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/',             icon: LayoutDashboard, label: 'Home'     },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Txns'     },
  { to: '/income',       icon: TrendingUp,      label: 'Income'   },
  { to: '/budget',       icon: PieChart,        label: 'Expenses' },
  { to: '/reports',      icon: BarChart3,       label: 'Reports'  },
  { to: '/ledger',       icon: TableProperties, label: 'Ledger'   },
  { to: '/summary',      icon: LayoutList,      label: 'Summary'  },
  { to: '/settings',     icon: Settings,        label: 'Settings' },
];

interface BottomNavProps {
  onSearchOpen?: () => void;
}

export default function BottomNav({ onSearchOpen }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border/50">
      <div className="flex items-center justify-around max-w-3xl mx-auto px-1 py-1 overflow-x-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl transition-all min-w-0 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center transition-all', isActive ? 'bg-primary/15' : '')}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn('text-[9px] font-medium leading-none', isActive ? 'text-primary' : '')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        {/* Analysis — desktop-only nav item */}
        <NavLink
          to="/analysis"
          className={({ isActive }) =>
            cn(
              'hidden md:flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl transition-all min-w-0 shrink-0',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn('h-6 w-6 rounded-lg flex items-center justify-center transition-all', isActive ? 'bg-primary/15' : '')}>
                <BarChart2 className="h-3.5 w-3.5" />
              </div>
              <span className={cn('text-[9px] font-medium leading-none', isActive ? 'text-primary' : '')}>
                Analysis
              </span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  );
}
