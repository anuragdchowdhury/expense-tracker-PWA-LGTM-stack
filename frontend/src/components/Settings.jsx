import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, RefreshCw, Smartphone, WifiOff } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '../utils/currency.js';
import { formatMonthYear } from '../utils/temporal.js';
import { attachValidationObservers } from '../utils/validation.js';

export default function Settings({
  year,
  month,
  currency = 'INR',
  currentBudget,
  hasBudget,
  isOnline,
  pendingCount,
  isSyncing,
  onChangeCurrency,
  onSaveBudget,
  onSyncNow,
}) {
  const formRef = useRef(null);
  const inputRef = useRef(null);

  const [amount, setAmount] = useState(hasBudget && currentBudget > 0 ? String(currentBudget) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    setAmount(hasBudget && currentBudget > 0 ? String(currentBudget) : '');
  }, [year, month, currentBudget, hasBudget]);

  useEffect(() => {
    return attachValidationObservers(formRef.current);
  }, []);

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmount(val);
    setStatusMessage(null);
    const parsed = Number(val);
    if (val && (!Number.isFinite(parsed) || parsed <= 0)) {
      e.target.setCustomValidity('Enter a monthly budget greater than 0.');
    } else {
      e.target.setCustomValidity('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const form = formRef.current;
    const input = inputRef.current;
    const parsed = Number(amount);

    if (input) {
      if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
        input.setCustomValidity('Enter a valid monthly budget greater than 0.');
      } else {
        input.setCustomValidity('');
      }
    }

    if (!form?.checkValidity()) {
      form?.reportValidity();
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSaveBudget({
        amount: Math.round(parsed * 100) / 100,
        year,
        month,
      });
      setStatusMessage({
        type: 'success',
        text: result?.queuedOffline
          ? `Saved offline for ${formatMonthYear(year, month)}. Will sync automatically when online.`
          : `Monthly budget for ${formatMonthYear(year, month)} updated.`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to save budget limit.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-1">
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Manage monthly spending limit and offline synchronization
        </p>
      </header>

      {/* Monthly Budget Form */}
      <section
        aria-labelledby="budget-settings-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <h2 id="budget-settings-title" className="text-base font-bold mb-1">
          Monthly Budget Limit
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Active period: <strong className="text-[var(--text-primary)]">{formatMonthYear(year, month)}</strong>
        </p>

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <div>
            <label htmlFor="monthly-budget-input" className="block text-sm font-semibold mb-1">
              Budget Limit ({currency}) *
            </label>
            <span id="monthly-budget-hint" className="block text-xs text-[var(--text-secondary)] mb-1.5">
              Enter your target spending cap for {formatMonthYear(year, month)} (e.g., 25000.00).
            </span>
            <input
              ref={inputRef}
              id="monthly-budget-input"
              name="amount"
              type="text"
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              required
              enterKeyHint="done"
              autoComplete="off"
              value={amount}
              onChange={handleAmountChange}
              aria-describedby="monthly-budget-hint"
              aria-errormessage="monthly-budget-error"
              placeholder="1500.00"
              className="form-control font-semibold"
            />
            <div id="monthly-budget-error" className="error-msg" aria-live="polite">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Please enter a valid amount greater than 0 (up to 2 decimals).</span>
            </div>
          </div>

          {statusMessage ? (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm border ${
                statusMessage.type === 'error'
                  ? 'border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]'
                  : 'border-[var(--success)] bg-[var(--bg-muted)] text-[var(--success)]'
              }`}
            >
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[48px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-contrast)] font-semibold text-sm shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? 'Saving Budget...' : 'Save Monthly Budget'}
          </button>
        </form>
      </section>

      {/* Currency Preference */}
      <section
        aria-labelledby="currency-settings-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <h2 id="currency-settings-title" className="text-base font-bold mb-1">
          Display Currency
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Defaults to Indian Rupee (INR). Applies to labels, charts, and ledger totals.
        </p>
        <label htmlFor="currency-select" className="block text-sm font-semibold mb-1.5">
          Currency
        </label>
        <select
          id="currency-select"
          name="currency"
          value={currency}
          onChange={(e) => onChangeCurrency(e.target.value)}
          className="form-control"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </section>

      {/* Offline Sync Card */}
      <section
        aria-labelledby="sync-status-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="sync-status-title" className="text-base font-bold">
            Offline Sync
          </h2>
          {isOnline ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
              <Cloud className="w-4 h-4" aria-hidden="true" />
              <span>Online</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--warning)]">
              <WifiOff className="w-4 h-4" aria-hidden="true" />
              <span>Offline</span>
            </span>
          )}
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {pendingCount > 0
            ? `${pendingCount} offline change${pendingCount === 1 ? '' : 's'} queued in local storage awaiting sync.`
            : 'All local expenses and budget settings are up to date with the server.'}
        </p>

        <button
          type="button"
          onClick={onSyncNow}
          disabled={!isOnline || isSyncing}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] font-semibold text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isSyncing ? 'Syncing...' : 'Sync Pending Changes'}</span>
        </button>
      </section>

      {/* PWA Install Guidance */}
      <section
        aria-labelledby="pwa-info-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-[var(--brand)] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="pwa-info-title" className="text-sm font-bold">
              Install as Mobile App
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Use your browser&apos;s &ldquo;Add to Home Screen&rdquo; or &ldquo;Install App&rdquo; option to launch Money Tracker in standalone mode with offline caching.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

