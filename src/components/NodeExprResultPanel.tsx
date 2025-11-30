'use client';

import { useState, useMemo } from 'react';
import type {
  EvaluationTrace,
  EvaluationStep,
  NodeExpression,
  RDFTerm,
} from '@/lib/shnex';

interface NodeExprResultPanelProps {
  trace: EvaluationTrace | null;
  error: string | null;
  isEvaluating: boolean;
  prefixes?: Map<string, string>;
  theme: 'light' | 'dark';
}

export function NodeExprResultPanel({
  trace,
  error,
  isEvaluating,
  prefixes,
  theme,
}: NodeExprResultPanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'flow'>('tree');

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (trace?.steps) {
      setExpandedSteps(new Set(trace.steps.map((_, i) => i)));
    }
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  if (isEvaluating) {
    return (
      <div className={`h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900 text-zinc-400' : 'bg-white text-zinc-500'
      }`}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Evaluating...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full p-4 ${
        theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
      }`}>
        <div className={`p-3 rounded-lg ${
          theme === 'dark' ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            <svg
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div>
              <div className={`text-sm font-medium ${
                theme === 'dark' ? 'text-red-400' : 'text-red-700'
              }`}>
                Evaluation Error
              </div>
              <div className={`text-xs mt-1 ${
                theme === 'dark' ? 'text-red-300/80' : 'text-red-600'
              }`}>
                {error}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className={`h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-zinc-900 text-zinc-500' : 'bg-white text-zinc-400'
      }`}>
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-2 opacity-50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="m4.93 4.93 2.83 2.83" />
            <path d="m16.24 16.24 2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="m4.93 19.07 2.83-2.83" />
            <path d="m16.24 7.76 2.83-2.83" />
          </svg>
          <p className="text-sm">No evaluation results yet</p>
          <p className="text-xs mt-1 opacity-70">
            Click "Evaluate" to run a node expression
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden ${
      theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
    }`}>
      {/* Header */}
      <div className={`shrink-0 px-3 py-2 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-zinc-700/50 bg-zinc-800/50' : 'border-zinc-200 bg-zinc-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${
            theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'
          }`}>
            Evaluation Result
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
          }`}>
            {trace.result.length} node{trace.result.length !== 1 ? 's' : ''}
          </span>
          <span className={`text-[10px] ${
            theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
          }`}>
            {trace.executionTime.toFixed(1)}ms
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={expandAll}
            className={`p-1 rounded text-xs ${
              theme === 'dark'
                ? 'hover:bg-zinc-700 text-zinc-400'
                : 'hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Expand all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            onClick={collapseAll}
            className={`p-1 rounded text-xs ${
              theme === 'dark'
                ? 'hover:bg-zinc-700 text-zinc-400'
                : 'hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Collapse all"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Result Nodes */}
      <div className={`shrink-0 px-3 py-2 border-b ${
        theme === 'dark' ? 'border-zinc-700/50' : 'border-zinc-200'
      }`}>
        <div className={`text-[10px] uppercase tracking-wide mb-1.5 ${
          theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
        }`}>
          Output Nodes
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trace.result.length === 0 ? (
            <span className={`text-xs italic ${
              theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              Empty result
            </span>
          ) : (
            trace.result.slice(0, 20).map((node, i) => (
              <NodeBadge key={i} node={node} theme={theme} />
            ))
          )}
          {trace.result.length > 20 && (
            <span className={`text-xs ${
              theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              +{trace.result.length - 20} more
            </span>
          )}
        </div>
      </div>

      {/* Evaluation Steps */}
      <div className="flex-1 overflow-auto p-2">
        <div className={`text-[10px] uppercase tracking-wide mb-2 px-1 ${
          theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
        }`}>
          Evaluation Steps
        </div>
        <div className="space-y-1">
          {trace.steps.map((step, index) => (
            <EvaluationStepItem
              key={index}
              step={step}
              index={index}
              isExpanded={expandedSteps.has(index)}
              onToggle={() => toggleStep(index)}
              theme={theme}
              depth={0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface EvaluationStepItemProps {
  step: EvaluationStep;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark';
  depth: number;
}

function EvaluationStepItem({
  step,
  index,
  isExpanded,
  onToggle,
  theme,
  depth,
}: EvaluationStepItemProps) {
  const hasSubSteps = step.subSteps && step.subSteps.length > 0;
  const exprType = step.expression.type;
  const typeColor = getExpressionTypeColor(exprType, theme);

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div
        className={`rounded px-2 py-1.5 cursor-pointer transition-colors ${
          theme === 'dark'
            ? 'hover:bg-zinc-800/70 bg-zinc-800/30'
            : 'hover:bg-zinc-100 bg-zinc-50'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {/* Expand/Collapse indicator */}
          <div className={`w-4 h-4 flex items-center justify-center ${
            hasSubSteps ? 'opacity-100' : 'opacity-0'
          }`}>
            <svg
              className={`w-3 h-3 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              } ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Expression type badge */}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: typeColor.bg,
              color: typeColor.text,
            }}
          >
            {exprType}
          </span>

          {/* Arrow */}
          <svg
            className={`w-3 h-3 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-300'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>

          {/* Output count */}
          <span className={`text-xs ${
            step.outputNodes.length > 0
              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
              : theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
          }`}>
            {step.outputNodes.length} node{step.outputNodes.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-2 pl-6 space-y-2">
            {/* Input nodes */}
            <div>
              <div className={`text-[10px] uppercase tracking-wide mb-1 ${
                theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                Input
              </div>
              <div className="flex flex-wrap gap-1">
                {step.inputNodes.map((node, i) => (
                  <NodeBadge key={i} node={node} theme={theme} size="sm" />
                ))}
              </div>
            </div>

            {/* Output nodes */}
            <div>
              <div className={`text-[10px] uppercase tracking-wide mb-1 ${
                theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
              }`}>
                Output
              </div>
              <div className="flex flex-wrap gap-1">
                {step.outputNodes.length === 0 ? (
                  <span className={`text-xs italic ${
                    theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'
                  }`}>
                    empty
                  </span>
                ) : (
                  step.outputNodes.slice(0, 10).map((node, i) => (
                    <NodeBadge key={i} node={node} theme={theme} size="sm" />
                  ))
                )}
                {step.outputNodes.length > 10 && (
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                  }`}>
                    +{step.outputNodes.length - 10} more
                  </span>
                )}
              </div>
            </div>

            {/* Details if present */}
            {step.details && (
              <div className={`text-xs ${
                theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {step.details}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sub-steps */}
      {isExpanded && hasSubSteps && (
        <div className="mt-1">
          {step.subSteps!.map((subStep, subIndex) => (
            <EvaluationStepItem
              key={subIndex}
              step={subStep}
              index={subIndex}
              isExpanded={false}
              onToggle={() => {}}
              theme={theme}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NodeBadgeProps {
  node: RDFTerm;
  theme: 'light' | 'dark';
  size?: 'sm' | 'md';
}

function NodeBadge({ node, theme, size = 'md' }: NodeBadgeProps) {
  const displayValue = useMemo(() => {
    if (node.termType === 'NamedNode') {
      const value = node.value;
      // Try to extract local name
      const hashIndex = value.lastIndexOf('#');
      const slashIndex = value.lastIndexOf('/');
      const separatorIndex = Math.max(hashIndex, slashIndex);
      if (separatorIndex > 0) {
        return value.slice(separatorIndex + 1);
      }
      return value;
    }
    if (node.termType === 'BlankNode') {
      return `_:${node.value}`;
    }
    if (node.termType === 'Literal') {
      const lit = node as unknown as { value: string; language?: string; datatype?: { value: string } };
      if (lit.language) {
        return `"${lit.value}"@${lit.language}`;
      }
      return `"${lit.value}"`;
    }
    // Handle other term types
    return (node as { value: string }).value;
  }, [node]);

  const typeStyle = useMemo(() => {
    switch (node.termType) {
      case 'NamedNode':
        return theme === 'dark'
          ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
          : 'bg-teal-100 text-teal-700 border-teal-200';
      case 'BlankNode':
        return theme === 'dark'
          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          : 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Literal':
        return theme === 'dark'
          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          : 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return theme === 'dark'
          ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
          : 'bg-zinc-100 text-zinc-600 border-zinc-200';
    }
  }, [node.termType, theme]);

  const sizeClass = size === 'sm' ? 'text-[10px] px-1 py-0.5' : 'text-xs px-1.5 py-0.5';

  return (
    <span
      className={`${sizeClass} rounded border font-mono truncate max-w-[150px] ${typeStyle}`}
      title={node.value}
    >
      {displayValue}
    </span>
  );
}

function getExpressionTypeColor(type: string, theme: 'light' | 'dark') {
  const colors: Record<string, { bg: string; text: string }> = {
    // Path expressions - blue
    pathValues: theme === 'dark'
      ? { bg: '#1e40af30', text: '#60a5fa' }
      : { bg: '#dbeafe', text: '#1d4ed8' },
    
    // List operators - purple
    distinct: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    intersection: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    concat: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    remove: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    join: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    filterShape: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    limit: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    offset: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    orderBy: theme === 'dark'
      ? { bg: '#6b21a830', text: '#c084fc' }
      : { bg: '#f3e8ff', text: '#7c3aed' },
    
    // Sequence operators - pink
    flatMap: theme === 'dark'
      ? { bg: '#9d174d30', text: '#f472b6' }
      : { bg: '#fce7f3', text: '#be185d' },
    findFirst: theme === 'dark'
      ? { bg: '#9d174d30', text: '#f472b6' }
      : { bg: '#fce7f3', text: '#be185d' },
    matchAll: theme === 'dark'
      ? { bg: '#9d174d30', text: '#f472b6' }
      : { bg: '#fce7f3', text: '#be185d' },
    
    // Aggregations - orange
    count: theme === 'dark'
      ? { bg: '#c2410c30', text: '#fb923c' }
      : { bg: '#ffedd5', text: '#c2410c' },
    min: theme === 'dark'
      ? { bg: '#c2410c30', text: '#fb923c' }
      : { bg: '#ffedd5', text: '#c2410c' },
    max: theme === 'dark'
      ? { bg: '#c2410c30', text: '#fb923c' }
      : { bg: '#ffedd5', text: '#c2410c' },
    sum: theme === 'dark'
      ? { bg: '#c2410c30', text: '#fb923c' }
      : { bg: '#ffedd5', text: '#c2410c' },
    
    // Conditionals - amber
    if: theme === 'dark'
      ? { bg: '#a1650030', text: '#fbbf24' }
      : { bg: '#fef3c7', text: '#b45309' },
    exists: theme === 'dark'
      ? { bg: '#a1650030', text: '#fbbf24' }
      : { bg: '#fef3c7', text: '#b45309' },
    
    // Constants - teal
    iri: theme === 'dark'
      ? { bg: '#0d948830', text: '#2dd4bf' }
      : { bg: '#ccfbf1', text: '#0f766e' },
    literal: theme === 'dark'
      ? { bg: '#0d948830', text: '#2dd4bf' }
      : { bg: '#ccfbf1', text: '#0f766e' },
    
    // Variables - sky
    var: theme === 'dark'
      ? { bg: '#0284c730', text: '#38bdf8' }
      : { bg: '#e0f2fe', text: '#0369a1' },
  };

  return colors[type] || (theme === 'dark'
    ? { bg: '#3f3f4630', text: '#a1a1aa' }
    : { bg: '#f4f4f5', text: '#71717a' });
}

export default NodeExprResultPanel;
