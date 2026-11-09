/**
 * Syncs aria-invalid with native :user-invalid and provides a WeakMap-based fallback
 * for browsers lacking :user-invalid support.
 */
export function attachValidationObservers(formElement) {
  if (!formElement) return () => {};

  const supportsUserInvalid =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('selector(:user-invalid)');

  if (supportsUserInvalid) {
    const syncAria = (el) => {
      if (!el || typeof el.matches !== 'function') return;
      if (el.matches(':user-invalid')) {
        el.setAttribute('aria-invalid', 'true');
      } else {
        el.setAttribute('aria-invalid', 'false');
      }
    };

    const onBlur = (e) => syncAria(e.target);
    const onInput = (e) => {
      if (e.target?.hasAttribute('aria-invalid')) {
        syncAria(e.target);
      }
    };
    const onInvalid = (e) => {
      if (e.target && typeof e.target.setAttribute === 'function') {
        e.target.setAttribute('aria-invalid', 'true');
      }
    };

    formElement.addEventListener('blur', onBlur, true);
    formElement.addEventListener('input', onInput);
    formElement.addEventListener('change', onInput);
    formElement.addEventListener('invalid', onInvalid, true);

    return () => {
      formElement.removeEventListener('blur', onBlur, true);
      formElement.removeEventListener('input', onInput);
      formElement.removeEventListener('change', onInput);
      formElement.removeEventListener('invalid', onInvalid, true);
    };
  }

  // Fallback for browsers without :user-invalid
  const dirtyState = new WeakMap();

  const updateFallbackState = (input) => {
    if (!input || typeof input.checkValidity !== 'function') return;
    const isValid = input.checkValidity();
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;
    if (event.type === 'reset') {
      const controls = formElement.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!input || typeof input.checkValidity !== 'function') return;

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) {
        updateFallbackState(input);
      }
    } else if (event.type === 'blur') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(input, state);
      if (state.hasInteracted) {
        updateFallbackState(input);
      }
    } else if (event.type === 'invalid') {
      dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
      updateFallbackState(input);
    }
  };

  formElement.addEventListener('blur', handleEvent, true);
  formElement.addEventListener('input', handleEvent);
  formElement.addEventListener('change', handleEvent);
  formElement.addEventListener('invalid', handleEvent, true);
  formElement.addEventListener('reset', handleEvent, true);

  return () => {
    formElement.removeEventListener('blur', handleEvent, true);
    formElement.removeEventListener('input', handleEvent);
    formElement.removeEventListener('change', handleEvent);
    formElement.removeEventListener('invalid', handleEvent, true);
    formElement.removeEventListener('reset', handleEvent, true);
  };
}

