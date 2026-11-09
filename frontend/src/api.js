import {
  buildOfflineDashboard,
  clearPendingBudget,
  enqueuePendingExpense,
  getPendingBudgets,
  getPendingCount,
  getPendingExpenses,
  removePendingExpense,
  saveSnapshot,
  setPendingBudget,
  setPendingExpenses,
} from './utils/offlineStore.js';
import { getTodayPlainDateString } from './utils/temporal.js';

function createClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        message = typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail);
      }
    } catch {
      // ignore parse failure
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export async function syncPendingChanges() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, remaining: await getPendingCount(), offline: true };
  }

  let synced = 0;

  // 1. Sync pending budget updates
  const budgets = await getPendingBudgets();
  for (const key of Object.keys(budgets)) {
    const item = budgets[key];
    try {
      await fetchJson('/api/budget', {
        method: 'POST',
        body: JSON.stringify({
          amount: item.amount,
          month: item.month,
          year: item.year,
        }),
      });
      await clearPendingBudget(item.year, item.month);
      synced += 1;
    } catch (err) {
      if (!err.status) {
        return { synced, remaining: await getPendingCount(), offline: true };
      }
    }
  }

  // 2. Sync pending expenses
  const expenses = await getPendingExpenses();
  const stillPending = [];
  let hitNetworkError = false;

  for (const exp of expenses) {
    if (hitNetworkError) {
      stillPending.push(exp);
      continue;
    }
    try {
      await fetchJson('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amount: exp.amount,
          category: exp.category,
          date: exp.date,
          description: exp.description,
          client_id: exp.client_id,
        }),
      });
      synced += 1;
    } catch (err) {
      if (!err.status) {
        hitNetworkError = true;
      }
      stillPending.push(exp);
    }
  }

  await setPendingExpenses(stillPending);
  return {
    synced,
    remaining: await getPendingCount(),
    offline: hitNetworkError,
  };
}

export async function fetchDashboard(year, month) {
  const todayIso = getTodayPlainDateString();

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      await syncPendingChanges();
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        today: todayIso,
      });
      const data = await fetchJson(`/api/dashboard?${params.toString()}`);
      await saveSnapshot(year, month, data);

      const pendingCount = await getPendingCount();
      if (pendingCount > 0) {
        const merged = await buildOfflineDashboard(year, month);
        return { ...merged, fromOfflineCache: false, pendingCount };
      }
      return { ...data, fromOfflineCache: false, pendingCount: 0 };
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
    }
  }

  const offlineData = await buildOfflineDashboard(year, month);
  const pendingCount = await getPendingCount();
  return { ...offlineData, pendingCount };
}

export async function createExpense({ amount, category, date, description = '' }) {
  const clientId = createClientId();
  const payload = {
    amount: Number(amount),
    category,
    date,
    description: description.trim(),
    client_id: clientId,
  };

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const created = await fetchJson('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { expense: created, queuedOffline: false };
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
    }
  }

  await enqueuePendingExpense(payload);
  return {
    expense: { ...payload, id: `pending-${clientId}`, pending: true },
    queuedOffline: true,
  };
}

export async function deleteExpense(expense) {
  if (expense.pending && expense.client_id) {
    await removePendingExpense(expense.client_id);
    return { deleted: true, offline: true };
  }
  await fetchJson(`/api/expenses/${expense.id}`, { method: 'DELETE' });
  return { deleted: true, offline: false };
}

export async function saveBudget({ amount, year, month }) {
  const payload = {
    amount: Number(amount),
    year,
    month,
  };

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    try {
      const saved = await fetchJson('/api/budget', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await clearPendingBudget(year, month);
      return { budget: saved, queuedOffline: false };
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
    }
  }

  await setPendingBudget(year, month, payload.amount);
  return { budget: payload, queuedOffline: true };
}

