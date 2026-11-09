import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatCurrencyCompact } from '../utils/currency.js';
import { formatCalendarDate, formatMonthYear } from '../utils/temporal.js';

const CATEGORY_COLORS = {
  Food: '#0f766e',
  Transport: '#2563eb',
  Utilities: '#d97706',
  Entertainment: '#9333ea',
  Health: '#dc2626',
  Shopping: '#db2777',
  Others: '#64748b',
};

export default function Dashboard({
  dashboard,
  year,
  month,
  currency = 'INR',
  isOnline,
  isLoading,
  isSyncing,
  onPrevMonth,
  onNextMonth,
  onSyncNow,
  onGoToSettings,
  onOpenAddExpense,
  onDeleteExpense,
}) {
  const [trendRange, setTrendRange] = useState('week');

  const budget = Number(dashboard?.budget || 0);
  const hasBudget = Boolean(dashboard?.has_budget);
  const totalExpenses = Number(dashboard?.total_expenses || 0);
  const remaining = hasBudget ? Math.round((budget - totalExpenses) * 100) / 100 : null;
  const rawPct = hasBudget && budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;
  const clampedProgress = hasBudget && budget > 0 ? Math.min(totalExpenses, budget) : 0;

  let budgetStatus = 'ok';
  if (hasBudget && budget > 0) {
    if (totalExpenses > budget) budgetStatus = 'over';
    else if (rawPct >= 80) budgetStatus = 'warning';
  }

  const categoryData = dashboard?.expenses_by_category || [];
  const weeklyTrend = dashboard?.weekly_trend || [];
  const dailyTrend = dashboard?.daily_trend || [];
  const expenses = dashboard?.expenses || [];
  const pendingCount = Number(dashboard?.pendingCount || 0);

  const trendData = trendRange === 'week' ? weeklyTrend : dailyTrend;
  const trendXKey = trendRange === 'week' ? 'label' : 'day';

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Month Switcher & Connectivity */}
      <header className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-[var(--brand)] text-[var(--brand-contrast)] flex items-center justify-center shadow-sm">
            <Wallet className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Money Tracker</h1>
            <p className="text-xs text-[var(--text-secondary)]">Offline-ready personal ledger</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOnline ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--warning)]">
              <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Offline</span>
            </span>
          ) : pendingCount > 0 ? (
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand)] text-[var(--brand-contrast)] px-3 py-1.5 text-xs font-semibold min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Sync ({pendingCount})</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--success)]">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Synced</span>
            </span>
          )}
        </div>
      </header>

      {/* Month Navigator */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-xs">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl hover:bg-[var(--bg-muted)]"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="text-sm font-bold tracking-tight">{formatMonthYear(year, month)}</span>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl hover:bg-[var(--bg-muted)]"
        >
          <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Budget vs Current Expenses Card */}
      <section
        aria-labelledby="budget-card-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h2 id="budget-card-title" className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Monthly Spending
            </h2>
            <p className="text-2xl font-extrabold tracking-tight mt-0.5">
              {formatCurrency(totalExpenses, currency)}
              {hasBudget ? (
                <span className="text-sm font-medium text-[var(--text-secondary)] ml-1.5">
                  / {formatCurrency(budget, currency)}
                </span>
              ) : null}
            </p>
          </div>

          {hasBudget ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                budgetStatus === 'over'
                  ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
                  : budgetStatus === 'warning'
                    ? 'bg-[var(--bg-muted)] text-[var(--warning)]'
                    : 'bg-[var(--bg-muted)] text-[var(--success)]'
              }`}
            >
              {budgetStatus === 'over' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Over budget</span>
                </>
              ) : budgetStatus === 'warning' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{rawPct}% used</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{rawPct}% used</span>
                </>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={onGoToSettings}
              className="text-xs font-semibold text-[var(--brand)] underline underline-offset-2 min-h-[36px] px-2"
            >
              Set budget
            </button>
          )}
        </div>

        {hasBudget ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="budget-progress-bar" className="sr-only">
              Monthly budget usage
            </label>
            <progress
              id="budget-progress-bar"
              className="budget-progress"
              max={budget > 0 ? budget : 1}
              value={clampedProgress}
              data-status={budgetStatus}
            >
              {rawPct}%
            </progress>
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>
                {remaining >= 0
                  ? `${formatCurrency(remaining, currency)} remaining`
                  : `${formatCurrency(Math.abs(remaining), currency)} over limit`}
              </span>
              <span>{rawPct}% of budget</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            No budget limit set for {formatMonthYear(year, month)}. Set a limit in Settings to track progress.
          </p>
        )}
      </section>

      {/* Pie Chart: Expenses by Category */}
      <section
        aria-labelledby="category-chart-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="category-chart-title" className="text-sm font-bold">
            Expenses by Category
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">
            {categoryData.length} {categoryData.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {categoryData.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--text-secondary)]">
              {isLoading ? 'Loading expenses...' : 'No expenses recorded for this month yet.'}
            </p>
            {!isLoading ? (
              <button
                type="button"
                onClick={onOpenAddExpense}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--bg-muted)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--brand)]"
              >
                + Add your first expense
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="w-full h-52" role="img" aria-label="Pie chart of expenses grouped by category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={CATEGORY_COLORS[entry.category] || '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => formatCurrency(val, currency)}
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: '0.75rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="grid grid-cols-1 gap-2">
              {categoryData.map((item) => {
                const share = totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0;
                return (
                  <li
                    key={item.category}
                    className="flex items-center justify-between text-sm rounded-xl bg-[var(--bg-muted)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#64748b' }}
                        aria-hidden="true"
                      />
                      <span className="font-medium">{item.category}</span>
                      <span className="text-xs text-[var(--text-secondary)]">({share}%)</span>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(item.total, currency)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Line Chart: Weekly / Monthly Expense Trend */}
      <section
        aria-labelledby="trend-chart-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[var(--brand)]" aria-hidden="true" />
            <h2 id="trend-chart-title" className="text-sm font-bold">
              Expense Trend
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Trend timeframe"
            className="inline-flex rounded-xl bg-[var(--bg-muted)] p-1 border border-[var(--border-subtle)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={trendRange === 'week'}
              onClick={() => setTrendRange('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] transition-colors ${
                trendRange === 'week'
                  ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={trendRange === 'month'}
              onClick={() => setTrendRange('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] transition-colors ${
                trendRange === 'month'
                  ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        <div className="w-full h-52" role="img" aria-label={`Line chart of ${trendRange}ly expense trend`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis
                dataKey={trendXKey}
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                interval={trendRange === 'month' ? 4 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyCompact(v, currency)}
              />
              <Tooltip
                formatter={(val) => [formatCurrency(val, currency), 'Spent']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.full_label || payload?.[0]?.payload?.label || label}
                contentStyle={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  borderRadius: '0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--brand)"
                strokeWidth={2.5}
                dot={trendRange === 'week' ? { r: 3.5, fill: 'var(--brand)' } : false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent Expenses List */}
      <section
        aria-labelledby="recent-expenses-title"
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="recent-expenses-title" className="text-sm font-bold">
            Recent Expenses
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">
            {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {expenses.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-3 text-center">
            Expenses added for {formatMonthYear(year, month)} will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {expenses.map((exp) => (
              <li key={exp.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2.5 h-9 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#64748b' }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">
                        {exp.description || exp.category}
                      </p>
                      {exp.pending ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)] shrink-0">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <span>Pending sync</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {exp.category} • {formatCalendarDate(exp.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums">
                    {formatCurrency(exp.amount, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteExpense(exp)}
                    aria-label={`Delete ${exp.description || exp.category} expense of ${formatCurrency(exp.amount, currency)}`}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-muted)]"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

