'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { formatTripleForDisplay, type InferredTriple, type RuleInfo, type ExecutionResult } from 'srl-engine';

interface InferredTriplesPanelProps {
  result: ExecutionResult | null;
  prefixes: Map<string, string>;
  theme: 'light' | 'dark';
  onRuleHover?: (ruleInfo: RuleInfo | null) => void;
  onTripleHover?: (triple: InferredTriple | null) => void;
  highlightedRuleIndex?: number | null;
}

type ViewMode = 'flat' | 'grouped';

const RULE_COLORS = [
  { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
];

const RULE_COLORS_LIGHT = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
];

function getRuleColor(index: number, theme: 'light' | 'dark') {
  const colors = theme === 'dark' ? RULE_COLORS : RULE_COLORS_LIGHT;
  return colors[index % colors.length];
}

function TripleDisplay({ 
  triple, 
  prefixes, 
  theme,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: {
  triple: InferredTriple;
  prefixes: Map<string, string>;
  theme: 'light' | 'dark';
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const formatted = useMemo(() => formatTripleForDisplay(triple.quad, prefixes), [triple, prefixes]);
  const color = getRuleColor(triple.sourceRule.index, theme);
  
  return (
    <div 
      className={`flex items-start gap-2 py-1.5 px-2 rounded transition-colors cursor-pointer ${
        isHighlighted
          ? 'bg-surface-3'
          : 'hover:bg-surface-3'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex-1 font-mono text-xs">
        <span className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>{formatted.subject}</span>
        <span className="text-ink-muted"> </span>
        <span className={theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}>{formatted.predicate}</span>
        <span className="text-ink-muted"> </span>
        <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>{formatted.object}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${color.bg} ${color.text} ${color.border} border`}
          title={triple.sourceRule.name}
        >
          R{triple.sourceRule.index + 1}
        </span>
        {triple.iteration > 1 && (
          <span
            className="text-[10px] px-1 py-0.5 rounded bg-surface-3 text-ink-2"
            title={`Generated in iteration ${triple.iteration}`}
          >
            i{triple.iteration}
          </span>
        )}
      </div>
    </div>
  );
}

function GroupedView({
  triplesByRule,
  ruleInfos,
  prefixes,
  theme,
  onRuleHover,
  onTripleHover,
  highlightedRuleIndex,
}: {
  triplesByRule: Map<number, InferredTriple[]>;
  ruleInfos: RuleInfo[];
  prefixes: Map<string, string>;
  theme: 'light' | 'dark';
  onRuleHover?: (ruleInfo: RuleInfo | null) => void;
  onTripleHover?: (triple: InferredTriple | null) => void;
  highlightedRuleIndex?: number | null;
}) {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set(ruleInfos.map(r => r.index)));
  
  const toggleRule = useCallback((ruleIndex: number) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleIndex)) {
        next.delete(ruleIndex);
      } else {
        next.add(ruleIndex);
      }
      return next;
    });
  }, []);
  
  return (
    <div className="space-y-2">
      {ruleInfos.map((ruleInfo) => {
        const triples = triplesByRule.get(ruleInfo.index) || [];
        if (triples.length === 0) return null;
        
        const color = getRuleColor(ruleInfo.index, theme);
        const isExpanded = expandedRules.has(ruleInfo.index);
        const isHighlighted = highlightedRuleIndex === ruleInfo.index;
        
        return (
          <div 
            key={ruleInfo.index}
            className={`rounded-lg border ${
              isHighlighted
                ? theme === 'dark' ? 'border-blue-500/50 bg-blue-500/5' : 'border-blue-300 bg-blue-50'
                : 'border-border bg-surface-3/40'
            }`}
            onMouseEnter={() => onRuleHover?.(ruleInfo)}
            onMouseLeave={() => onRuleHover?.(null)}
          >
            <button
              onClick={() => toggleRule(ruleInfo.index)}
              className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface-3"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color.bg} ${color.text}`}>
                  R{ruleInfo.index + 1}
                </span>
                <span className="text-sm font-medium text-ink">
                  {ruleInfo.name}
                </span>
                <span className="text-xs text-ink-muted">
                  ({triples.length} triple{triples.length !== 1 ? 's' : ''})
                </span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform text-ink-muted ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-border">
                {triples.map((triple, tripleIndex) => (
                  <TripleDisplay
                    key={tripleIndex}
                    triple={triple}
                    prefixes={prefixes}
                    theme={theme}
                    onMouseEnter={() => onTripleHover?.(triple)}
                    onMouseLeave={() => onTripleHover?.(null)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InferredTriplesPanel({
  result,
  prefixes,
  theme,
  onRuleHover,
  onTripleHover,
  highlightedRuleIndex,
}: InferredTriplesPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredTriples = useMemo(() => {
    if (!result) return [];
    if (!searchQuery.trim()) return result.inferredTriples;
    
    const query = searchQuery.toLowerCase();
    return result.inferredTriples.filter(triple => {
      const formatted = formatTripleForDisplay(triple.quad, prefixes);
      return formatted.subject.toLowerCase().includes(query) ||
             formatted.predicate.toLowerCase().includes(query) ||
             formatted.object.toLowerCase().includes(query) ||
             triple.sourceRule.name.toLowerCase().includes(query);
    });
  }, [result, searchQuery, prefixes]);
  
  const triplesByRule = useMemo(() => {
    const map = new Map<number, InferredTriple[]>();
    for (const triple of filteredTriples) {
      const existing = map.get(triple.sourceRule.index) || [];
      existing.push(triple);
      map.set(triple.sourceRule.index, existing);
    }
    return map;
  }, [filteredTriples]);
  
  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-ink-muted">
        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p className="text-sm text-center">
          Click &ldquo;Run Rules&rdquo; to execute the SRL rules<br />
          against the RDF data graph
        </p>
      </div>
    );
  }
  
  if (result.errors.length > 0) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>
            Execution Errors
          </h3>
          <ul className="space-y-1">
            {result.errors.map((error, index) => (
              <li key={index} className={`text-xs ${theme === 'dark' ? 'text-red-300' : 'text-red-600'}`}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-border bg-surface-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-ink">
              Inferred Triples
            </h3>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
            }`}>
              {result.inferredTriples.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('flat')}
              aria-label="Flat list view"
              aria-pressed={viewMode === 'flat'}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'flat'
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Flat list view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              aria-label="Grouped by rule"
              aria-pressed={viewMode === 'grouped'}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
              title="Grouped by rule"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter triples..."
            aria-label="Filter triples"
            className="w-full text-xs px-2 py-1.5 pl-7 rounded border bg-surface-3 border-border-2 text-ink placeholder-ink-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      {/* Stats bar */}
      <div className="shrink-0 px-3 py-1.5 text-[11px] border-b border-border bg-surface-2 text-ink-muted flex items-center gap-3">
        <span>{result.iterations} iteration{result.iterations !== 1 ? 's' : ''}</span>
        <span>•</span>
        <span>{result.executionTime.toFixed(1)}ms</span>
        <span>•</span>
        <span>{result.totalTriples} total triples</span>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {filteredTriples.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">
            {searchQuery ? 'No triples match your search' : 'No triples were inferred'}
          </div>
        ) : viewMode === 'flat' ? (
          <div className="space-y-0.5">
            {filteredTriples.map((triple, index) => (
              <TripleDisplay
                key={index}
                triple={triple}
                prefixes={prefixes}
                theme={theme}
                isHighlighted={highlightedRuleIndex === triple.sourceRule.index}
                onMouseEnter={() => onTripleHover?.(triple)}
                onMouseLeave={() => onTripleHover?.(null)}
              />
            ))}
          </div>
        ) : (
          <GroupedView
            triplesByRule={triplesByRule}
            ruleInfos={result.ruleInfos.filter(r => triplesByRule.has(r.index))}
            prefixes={prefixes}
            theme={theme}
            onRuleHover={onRuleHover}
            onTripleHover={onTripleHover}
            highlightedRuleIndex={highlightedRuleIndex}
          />
        )}
      </div>
    </div>
  );
}
