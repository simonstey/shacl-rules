/**
 * React hook for Node Expression validation and evaluation
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Store, Parser, DataFactory } from 'n3';
import {
  parseTurtle,
  createEvaluator,
  EvaluationTrace,
  RDFTerm,
  NodeExpression,
} from '@/lib/shnex';
import type { ParseError } from '@/lib/shnex';

export interface NodeExprValidationState {
  isValid: boolean;
  parseErrors: ParseError[];
  expressions: Map<RDFTerm, NodeExpression>;
  prefixes: Map<string, string>;
}

export interface NodeExprEvaluationState {
  isEvaluating: boolean;
  trace: EvaluationTrace | null;
  error: string | null;
}

export interface UseNodeExprValidationResult {
  validation: NodeExprValidationState;
  evaluation: NodeExprEvaluationState;
  validate: (expressionCode: string) => void;
  evaluate: (expressionCode: string, rdfData: string, focusNodeUri?: string) => Promise<void>;
  clearEvaluation: () => void;
}

export function useNodeExprValidation(): UseNodeExprValidationResult {
  const [validation, setValidation] = useState<NodeExprValidationState>({
    isValid: true,
    parseErrors: [],
    expressions: new Map(),
    prefixes: new Map(),
  });

  const [evaluation, setEvaluation] = useState<NodeExprEvaluationState>({
    isEvaluating: false,
    trace: null,
    error: null,
  });

  const validateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validate = useCallback((expressionCode: string) => {
    // Debounce validation
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
    }

    validateTimeoutRef.current = setTimeout(() => {
      try {
        const result = parseTurtle(expressionCode);
        
        setValidation({
          isValid: result.errors.length === 0,
          parseErrors: result.errors,
          expressions: result.expressions,
          prefixes: result.prefixes,
        });
      } catch (error) {
        setValidation({
          isValid: false,
          parseErrors: [{
            message: error instanceof Error ? error.message : 'Unknown parse error',
          }],
          expressions: new Map(),
          prefixes: new Map(),
        });
      }
    }, 300);
  }, []);

  const evaluate = useCallback(async (
    expressionCode: string,
    rdfData: string,
    focusNodeUri?: string
  ) => {
    setEvaluation({
      isEvaluating: true,
      trace: null,
      error: null,
    });

    try {
      // Parse the expression Turtle
      const exprResult = parseTurtle(expressionCode);
      
      if (exprResult.errors.length > 0) {
        throw new Error(`Expression parse errors: ${exprResult.errors.map(e => e.message).join(', ')}`);
      }

      // Parse the RDF data
      const dataStore = new Store();
      try {
        const parser = new Parser();
        const quads = parser.parse(rdfData);
        dataStore.addQuads(quads);
      } catch (e) {
        throw new Error(`RDF data parse error: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Get the first expression or find by focus node
      let expression: NodeExpression | undefined;
      let focusNode: RDFTerm | undefined;

      if (exprResult.expressions.size === 0) {
        throw new Error('No node expressions found in the input');
      }

      // Get first expression
      const firstEntry = exprResult.expressions.entries().next();
      if (firstEntry.done || !firstEntry.value) {
        throw new Error('No node expressions found in the input');
      }
      expression = firstEntry.value[1];

      // Determine focus node
      if (focusNodeUri) {
        focusNode = DataFactory.namedNode(focusNodeUri);
      } else {
        // Use the first subject in the data as focus node
        const firstQuad = dataStore.getQuads(null, null, null, null)[0];
        if (firstQuad) {
          focusNode = firstQuad.subject as RDFTerm;
        } else {
          throw new Error('No RDF data to evaluate against');
        }
      }

      if (!expression) {
        throw new Error('Failed to retrieve node expression');
      }

      // Create evaluator and run
      const evaluator = createEvaluator(dataStore, { trace: true });
      const result = evaluator.evaluate(expression, focusNode);

      if (result.error) {
        throw new Error(result.error);
      }

      setEvaluation({
        isEvaluating: false,
        trace: result.trace || null,
        error: null,
      });
    } catch (error) {
      setEvaluation({
        isEvaluating: false,
        trace: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const clearEvaluation = useCallback(() => {
    setEvaluation({
      isEvaluating: false,
      trace: null,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
    };
  }, []);

  return {
    validation,
    evaluation,
    validate,
    evaluate,
    clearEvaluation,
  };
}

export default useNodeExprValidation;
