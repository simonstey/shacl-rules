'use client';

import { useState, useCallback, useRef } from 'react';
import { buildAST, executeRules, type RuleSet, type ExecutionResult } from 'srl-engine';

export interface UseRuleExecutionResult {
  result: ExecutionResult | null;
  ruleSet: RuleSet | null;
  isExecuting: boolean;
  error: string | null;
  execute: (srlCode: string, rdfData: string) => void;
  reset: () => void;
}

export function useRuleExecution(): UseRuleExecutionResult {
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [ruleSet, setRuleSet] = useState<RuleSet | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const executionIdRef = useRef(0);
  
  const execute = useCallback((srlCode: string, rdfData: string) => {
    const executionId = ++executionIdRef.current;
    
    setIsExecuting(true);
    setError(null);
    
    setTimeout(() => {
      if (executionId !== executionIdRef.current) {
        return;
      }
      
      try {
        const parsedRuleSet = buildAST(srlCode);
        setRuleSet(parsedRuleSet);
        
        const executionResult = executeRules(parsedRuleSet, rdfData, {
          maxIterations: 100,
        });
        
        if (executionId === executionIdRef.current) {
          setResult(executionResult);
          
          if (executionResult.errors.length > 0) {
            setError(executionResult.errors.join('; '));
          }
        }
      } catch (e) {
        if (executionId === executionIdRef.current) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          setError(errorMessage);
          setResult(null);
        }
      } finally {
        if (executionId === executionIdRef.current) {
          setIsExecuting(false);
        }
      }
    }, 0);
  }, []);
  
  const reset = useCallback(() => {
    executionIdRef.current++;
    setResult(null);
    setRuleSet(null);
    setError(null);
    setIsExecuting(false);
  }, []);
  
  return {
    result,
    ruleSet,
    isExecuting,
    error,
    execute,
    reset,
  };
}
