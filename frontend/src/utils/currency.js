export const DEFAULT_CURRENCY = 'INR';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', locale: 'en-IN', label: 'INR (₹) — Indian Rupee' },
  { code: 'USD', symbol: '$', locale: 'en-US', label: 'USD ($) — US Dollar' },
  { code: 'EUR', symbol: '€', locale: 'en-IE', label: 'EUR (€) — Euro' },
  { code: 'GBP', symbol: '£', locale: 'en-GB', label: 'GBP (£) — British Pound' },
];

const CURRENCY_STORAGE_KEY = 'mt_currency_code';

export function getCurrencyMeta(code = DEFAULT_CURRENCY) {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code) ||
    SUPPORTED_CURRENCIES[0]
  );
}

export function getStoredCurrency() {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (saved && SUPPORTED_CURRENCIES.some((c) => c.code === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return DEFAULT_CURRENCY;
}

export function setStoredCurrency(code) {
  try {
    if (SUPPORTED_CURRENCIES.some((c) => c.code === code)) {
      localStorage.setItem(CURRENCY_STORAGE_KEY, code);
    }
  } catch {
    // Ignore storage access restrictions
  }
}

export function formatCurrency(value, currencyCode = DEFAULT_CURRENCY) {
  const { code, locale } = getCurrencyMeta(currencyCode);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatCurrencyCompact(value, currencyCode = DEFAULT_CURRENCY) {
  const { code, locale } = getCurrencyMeta(currencyCode);
  const num = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

