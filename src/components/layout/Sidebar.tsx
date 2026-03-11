import { NavLink } from 'react-router-dom';
import { Timer, Settings, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/timer', label: 'Timer', icon: Timer },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/history', label: 'Stats & History', icon: History },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Pomodoro Timer</h1>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
