import { useCallback, useRef, useState, useEffect } from 'react';
import { validateSRL, type ValidationResult } from 'srl-engine';

const DEBOUNCE_DELAY = 300;

export function useValidation() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const validate = useCallback((code: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsValidating(true);

    debounceRef.current = setTimeout(() => {
      // extensions:true lets FOR clauses validate as well-formed. The shapes
      // graph is intentionally NOT passed: SRL well-formedness is AST-only, so
      // feeding it here would be dead wiring and would re-validate on every
      // shapes-editor keystroke for no benefit.
      const validationResult = validateSRL(code, { extensions: true });
      setResult(validationResult);
      setIsValidating(false);
    }, DEBOUNCE_DELAY);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    result,
    isValidating,
    validate,
  };
}
