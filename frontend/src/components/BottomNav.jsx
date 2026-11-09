import { LayoutDashboard, Plus, Settings } from 'lucide-react';

export default function BottomNav({ activeView, onSelectView, onOpenAddExpense }) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-3 items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectView('dashboard')}
          aria-current={activeView === 'dashboard' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl text-xs font-semibold transition-colors ${
            activeView === 'dashboard'
              ? 'text-[var(--brand)] bg-[var(--bg-muted)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={onOpenAddExpense}
          aria-label="Add expense"
          className="flex items-center justify-center gap-1.5 min-h-[52px] rounded-2xl bg-[var(--brand)] text-[var(--brand-contrast)] font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          <span>Add</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectView('settings')}
          aria-current={activeView === 'settings' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl text-xs font-semibold transition-colors ${
            activeView === 'settings'
              ? 'text-[var(--brand)] bg-[var(--bg-muted)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Settings className="w-5 h-5" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
}

