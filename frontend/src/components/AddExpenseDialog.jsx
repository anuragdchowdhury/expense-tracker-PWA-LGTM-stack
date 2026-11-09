import { useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { CATEGORIES } from '../utils/offlineStore.js';
import { getTodayPlainDateString } from '../utils/temporal.js';
import { attachValidationObservers } from '../utils/validation.js';

export default function AddExpenseDialog({
  open,
  currency = 'INR',
  categories = CATEGORIES,
  onClose,
  onSubmitExpense,
}) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const amountInputRef = useRef(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getTodayPlainDateString());
  const [category, setCategory] = useState(categories[0] || 'Food');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Open / close via native modal API
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      setAmount('');
      setDate(getTodayPlainDateString());
      setCategory(categories[0] || 'Food');
      setDescription('');
      setSubmitError('');
      setIsSubmitting(false);
      formRef.current?.reset();
      dialog.showModal();
      amountInputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, categories]);

  // Attach native close listener & Safari light-dismiss fallback for closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    let cleanupBackdrop = () => {};
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onPointerDown = (e) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close('backdrop');
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupBackdrop();
    };
  }, [onClose]);

  useEffect(() => {
    return attachValidationObservers(formRef.current);
  }, []);

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmount(val);
    const parsed = Number(val);
    if (val && (!Number.isFinite(parsed) || parsed <= 0)) {
      e.target.setCustomValidity('Enter an amount greater than 0.');
    } else {
      e.target.setCustomValidity('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const form = formRef.current;
    if (!form) return;

    const amountEl = amountInputRef.current;
    const parsedAmount = Number(amount);
    if (amountEl) {
      if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        amountEl.setCustomValidity('Enter a valid amount greater than 0.');
      } else {
        amountEl.setCustomValidity('');
      }
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitExpense({
        amount: Math.round(parsedAmount * 100) / 100,
        category,
        date,
        description,
      });
      dialogRef.current?.close('submitted');
    } catch (err) {
      setSubmitError(err?.message || 'Unable to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="add-expense-title"
      className="expense-dialog"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 id="add-expense-title" className="text-lg font-bold tracking-tight">
          Add Expense
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close('cancel')}
          aria-label="Close add expense dialog"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4">
        {submitError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[var(--danger)] bg-[var(--danger-bg)] px-3.5 py-2.5 text-sm text-[var(--danger)]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <div>
          <label htmlFor="expense-amount" className="block text-sm font-semibold mb-1">
            Amount ({currency}) *
          </label>
          <span id="expense-amount-hint" className="block text-xs text-[var(--text-secondary)] mb-1.5">
            Enter a positive value up to 2 decimal places (e.g., 14.50).
          </span>
          <input
            ref={amountInputRef}
            id="expense-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            required
            autoFocus
            enterKeyHint="next"
            autoComplete="off"
            value={amount}
            onChange={handleAmountChange}
            aria-describedby="expense-amount-hint"
            aria-errormessage="expense-amount-error"
            placeholder="0.00"
            className="form-control font-semibold"
          />
          <div id="expense-amount-error" className="error-msg" aria-live="polite">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Please enter a valid amount greater than 0 (up to 2 decimals).</span>
          </div>
        </div>

        <div>
          <label htmlFor="expense-date" className="block text-sm font-semibold mb-1">
            Date *
          </label>
          <span id="expense-date-hint" className="block text-xs text-[var(--text-secondary)] mb-1.5">
            Calendar date when the expense occurred.
          </span>
          <input
            id="expense-date"
            name="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-describedby="expense-date-hint"
            aria-errormessage="expense-date-error"
            className="form-control"
          />
          <div id="expense-date-error" className="error-msg" aria-live="polite">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Please choose a valid date.</span>
          </div>
        </div>

        <div>
          <label htmlFor="expense-category" className="block text-sm font-semibold mb-1">
            Category *
          </label>
          <select
            id="expense-category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-errormessage="expense-category-error"
            className="form-control"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div id="expense-category-error" className="error-msg" aria-live="polite">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Please select a category.</span>
          </div>
        </div>

        <div>
          <label htmlFor="expense-note" className="block text-sm font-semibold mb-1">
            Note (optional)
          </label>
          <span id="expense-note-hint" className="block text-xs text-[var(--text-secondary)] mb-1.5">
            Short memo such as merchant or item name.
          </span>
          <input
            id="expense-note"
            name="description"
            type="text"
            maxLength={120}
            enterKeyHint="done"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby="expense-note-hint"
            placeholder="Coffee, groceries, metro pass..."
            className="form-control"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close('cancel')}
            className="min-h-[48px] px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)] font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[48px] flex-1 px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-contrast)] font-semibold text-sm shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

