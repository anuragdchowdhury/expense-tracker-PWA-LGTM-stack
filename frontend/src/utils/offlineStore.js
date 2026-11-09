import { getMonthDays, getTodayPlainDateString, getWeekDaysForPeriod } from './temporal.js';

export const CATEGORIES = [
  'Food',
  'Transport',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Others',
];

const DB_NAME = 'money-tracker-pwa';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const FALLBACK_PREFIX = 'mt_pwa_';

let dbPromise = null;

function openDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

async function kvGet(key, defaultValue = null) {
  const db = await openDB();
  if (!db) {
    try {
      const raw = localStorage.getItem(FALLBACK_PREFIX + key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_KV, 'readonly');
    const store = tx.objectStore(STORE_KV);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result !== undefined ? req.result : defaultValue);
    req.onerror = () => resolve(defaultValue);
  });
}

async function kvSet(key, value) {
  const db = await openDB();
  if (!db) {
    try {
      localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value));
    } catch {
      // Ignore storage quota errors
    }
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    const store = tx.objectStore(STORE_KV);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function periodKey(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export async function getSnapshot(year, month) {
  return kvGet(`snapshot_${periodKey(year, month)}`, null);
}

export async function saveSnapshot(year, month, data) {
  await kvSet(`snapshot_${periodKey(year, month)}`, data);
}

export async function getPendingExpenses() {
  return kvGet('pending_expenses', []);
}

export async function setPendingExpenses(list) {
  await kvSet('pending_expenses', list);
}

export async function enqueuePendingExpense(expense) {
  const list = await getPendingExpenses();
  list.push(expense);
  await setPendingExpenses(list);
}

export async function removePendingExpense(clientId) {
  const list = await getPendingExpenses();
  const next = list.filter((item) => item.client_id !== clientId);
  await setPendingExpenses(next);
  return next;
}

export async function getPendingBudgets() {
  return kvGet('pending_budgets', {});
}

export async function setPendingBudget(year, month, amount) {
  const budgets = await getPendingBudgets();
  budgets[periodKey(year, month)] = { year, month, amount };
  await kvSet('pending_budgets', budgets);
}

export async function clearPendingBudget(year, month) {
  const budgets = await getPendingBudgets();
  delete budgets[periodKey(year, month)];
  await kvSet('pending_budgets', budgets);
}

export async function getPendingCount() {
  const [expenses, budgets] = await Promise.all([getPendingExpenses(), getPendingBudgets()]);
  return expenses.length + Object.keys(budgets).length;
}

export async function buildOfflineDashboard(year, month) {
  const todayIso = getTodayPlainDateString();
  const key = periodKey(year, month);
  const monthPrefix = `${key}-`;

  const [snapshot, pendingExpenses, pendingBudgets] = await Promise.all([
    getSnapshot(year, month),
    getPendingExpenses(),
    getPendingBudgets(),
  ]);

  const baseExpenses = snapshot?.expenses ? [...snapshot.expenses] : [];
  const existingClientIds = new Set(baseExpenses.map((e) => e.client_id).filter(Boolean));

  const monthPending = pendingExpenses
    .filter((e) => e.date.startsWith(monthPrefix) && !existingClientIds.has(e.client_id))
    .map((e) => ({
      ...e,
      id: `pending-${e.client_id}`,
      pending: true,
    }));

  const mergedExpenses = [...monthPending, ...baseExpenses].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return String(b.id).localeCompare(String(a.id));
  });

  const pendingBudget = pendingBudgets[key];
  const hasBudget = pendingBudget ? true : Boolean(snapshot?.has_budget);
  const budgetAmount = pendingBudget
    ? Math.round(pendingBudget.amount * 100) / 100
    : Number(snapshot?.budget || 0);

  const totalExpenses =
    Math.round(mergedExpenses.reduce((acc, item) => acc + Number(item.amount || 0), 0) * 100) / 100;
  const remainingBudget = hasBudget ? Math.round((budgetAmount - totalExpenses) * 100) / 100 : null;

  // Aggregate categories
  const catMap = new Map();
  for (const exp of mergedExpenses) {
    const prev = catMap.get(exp.category) || { total: 0, count: 0 };
    catMap.set(exp.category, {
      total: Math.round((prev.total + Number(exp.amount || 0)) * 100) / 100,
      count: prev.count + 1,
    });
  }
  const expensesByCategory = Array.from(catMap.entries())
    .map(([category, info]) => ({ category, total: info.total, count: info.count }))
    .sort((a, b) => b.total - a.total);

  // Daily trend
  const dailyMap = new Map();
  for (const exp of mergedExpenses) {
    dailyMap.set(exp.date, Math.round(((dailyMap.get(exp.date) || 0) + Number(exp.amount)) * 100) / 100);
  }
  const days = getMonthDays(year, month);
  let cumulative = 0;
  const dailyTrend = days.map((d) => {
    const total = dailyMap.get(d.date) || 0;
    cumulative = Math.round((cumulative + total) * 100) / 100;
    return {
      date: d.date,
      day: d.day,
      label: d.label,
      total,
      cumulative,
    };
  });

  // Weekly trend (include base snapshot weekly values + pending expenses in that week window)
  const baseWeekMap = new Map((snapshot?.weekly_trend || []).map((w) => [w.date, Number(w.total || 0)]));
  const weekDays = getWeekDaysForPeriod(year, month, todayIso);
  const pendingWeekAdditions = new Map();
  for (const exp of pendingExpenses) {
    if (!existingClientIds.has(exp.client_id)) {
      pendingWeekAdditions.set(
        exp.date,
        Math.round(((pendingWeekAdditions.get(exp.date) || 0) + Number(exp.amount)) * 100) / 100
      );
    }
  }

  const weeklyTrend = weekDays.map((w) => ({
    date: w.date,
    label: w.label,
    full_label: w.full_label,
    total:
      Math.round(
        ((baseWeekMap.has(w.date) ? baseWeekMap.get(w.date) : dailyMap.get(w.date) || 0) +
          (pendingWeekAdditions.get(w.date) || 0)) *
          100
      ) / 100,
  }));

  return {
    month,
    year,
    currency: snapshot?.currency || 'INR',
    has_budget: hasBudget,
    budget: budgetAmount,
    total_expenses: totalExpenses,
    remaining_budget: remainingBudget,
    categories: snapshot?.categories || CATEGORIES,
    expenses_by_category: expensesByCategory,
    daily_trend: dailyTrend,
    weekly_trend: weeklyTrend,
    expenses: mergedExpenses,
    fromOfflineCache: true,
  };
}

