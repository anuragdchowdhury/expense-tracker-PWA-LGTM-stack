import { useCallback, useEffect, useState } from 'react';
import {
  createExpense,
  deleteExpense,
  fetchDashboard,
  saveBudget,
  syncPendingChanges,
} from './api.js';
import AddExpenseDialog from './components/AddExpenseDialog.jsx';
import BottomNav from './components/BottomNav.jsx';
import Dashboard from './components/Dashboard.jsx';
import Settings from './components/Settings.jsx';
import { CATEGORIES } from './utils/offlineStore.js';
import { DEFAULT_CURRENCY, getStoredCurrency, setStoredCurrency } from './utils/currency.js';
import { getCurrentYearMonth, shiftYearMonth } from './utils/temporal.js';

export default function App() {
  const initialPeriod = getCurrentYearMonth();
  const [period, setPeriod] = useState(initialPeriod);
  const [currency, setCurrency] = useState(() => getStoredCurrency() || DEFAULT_CURRENCY);
  const [activeView, setActiveView] = useState('dashboard');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [toast, setToast] = useState('');

  const loadDashboard = useCallback(async (year, month) => {
    setIsLoading(true);
    try {
      const data = await fetchDashboard(year, month);
      setDashboard(data);
    } catch (err) {
      setToast(err?.message || 'Could not load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(period.year, period.month);
  }, [period.year, period.month, loadDashboard]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        const res = await syncPendingChanges();
        if (res.synced > 0) {
          setToast(`Synced ${res.synced} offline change${res.synced === 1 ? '' : 's'}.`);
        }
      } finally {
        setIsSyncing(false);
        await loadDashboard(period.year, period.month);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [period.year, period.month, loadDashboard]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await syncPendingChanges();
      setToast(
        res.synced > 0
          ? `Synced ${res.synced} offline change${res.synced === 1 ? '' : 's'}.`
          : 'Everything is up to date.'
      );
      await loadDashboard(period.year, period.month);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddExpense = async (payload) => {
    const res = await createExpense(payload);
    const [expYear, expMonth] = payload.date.split('-').map(Number);
    if (expYear !== period.year || expMonth !== period.month) {
      setPeriod({ year: expYear, month: expMonth });
    } else {
      await loadDashboard(period.year, period.month);
    }
    setToast(
      res.queuedOffline
        ? 'Expense saved offline. It will sync automatically when online.'
        : 'Expense saved.'
    );
  };

  const handleDeleteExpense = async (expense) => {
    try {
      await deleteExpense(expense);
      await loadDashboard(period.year, period.month);
      setToast('Expense removed.');
    } catch (err) {
      setToast(err?.message || 'Unable to delete expense while offline.');
    }
  };

  const handleSaveBudget = async (payload) => {
    const res = await saveBudget(payload);
    await loadDashboard(period.year, period.month);
    return res;
  };

  const handleChangeCurrency = (nextCurrency) => {
    setCurrency(nextCurrency);
    setStoredCurrency(nextCurrency);
    setToast(`Currency switched to ${nextCurrency}.`);
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-page)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-md min-h-dvh flex flex-col px-4 pt-4 pb-28">
        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs font-semibold shadow-sm"
          >
            {toast}
          </div>
        ) : null}

        <main className="flex-1">
          {activeView === 'dashboard' ? (
            <Dashboard
              dashboard={dashboard}
              year={period.year}
              month={period.month}
              currency={currency}
              isOnline={isOnline}
              isLoading={isLoading}
              isSyncing={isSyncing}
              onPrevMonth={() => setPeriod((p) => shiftYearMonth(p.year, p.month, -1))}
              onNextMonth={() => setPeriod((p) => shiftYearMonth(p.year, p.month, 1))}
              onSyncNow={handleSyncNow}
              onGoToSettings={() => setActiveView('settings')}
              onOpenAddExpense={() => setIsAddOpen(true)}
              onDeleteExpense={handleDeleteExpense}
            />
          ) : (
            <Settings
              year={period.year}
              month={period.month}
              currency={currency}
              currentBudget={dashboard?.budget || 0}
              hasBudget={Boolean(dashboard?.has_budget)}
              isOnline={isOnline}
              pendingCount={Number(dashboard?.pendingCount || 0)}
              isSyncing={isSyncing}
              onChangeCurrency={handleChangeCurrency}
              onSaveBudget={handleSaveBudget}
              onSyncNow={handleSyncNow}
            />
          )}
        </main>
      </div>

      <BottomNav
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenAddExpense={() => setIsAddOpen(true)}
      />

      <AddExpenseDialog
        open={isAddOpen}
        currency={currency}
        categories={dashboard?.categories || CATEGORIES}
        onClose={() => setIsAddOpen(false)}
        onSubmitExpense={handleAddExpense}
      />
    </div>
  );
}

