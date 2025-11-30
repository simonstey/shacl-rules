'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { createSyntaxDiagramsCode, ISerializedGast } from 'chevrotain';
import { getSerializedGrammar, getGrammarRuleNames, GrammarRuleInfo } from '@/lib/srl/parser';
import { useSyntaxDiagrams } from '@/lib/monaco/useSyntaxDiagrams';

interface SyntaxDiagramPanelProps {
  theme?: 'light' | 'dark';
  highlightedRule?: string | null;
  onRuleHover?: (ruleName: string | null) => void;
  onRuleClick?: (ruleName: string) => void;
}

const CATEGORY_LABELS: Record<GrammarRuleInfo['category'], string> = {
  entry: 'Entry Point',
  prologue: 'Prologue',
  rules: 'Rules & Declarations',
  patterns: 'Patterns',
  terms: 'Terms & Triples',
  expressions: 'Expressions',
  literals: 'Literals',
};

const CATEGORY_ORDER: GrammarRuleInfo['category'][] = [
  'entry',
  'prologue',
  'rules',
  'patterns',
  'terms',
  'expressions',
  'literals',
];

const STORAGE_KEY = 'srl-diagram-hidden-rules';

function getStoredHiddenRules(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function storeHiddenRules(hidden: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
  } catch {
    // Ignore storage errors
  }
}

interface ISerializedRule extends ISerializedGast {
  type: 'Rule';
  name: string;
}

function isSerializedRule(gast: ISerializedGast): gast is ISerializedRule {
  return gast.type === 'Rule' && 'name' in gast;
}

function generateDiagramHtml(
  serializedGrammar: ISerializedGast[],
  hiddenRules: Set<string>,
  theme: 'light' | 'dark'
): string {
  const filteredGrammar = serializedGrammar.filter((rule) => {
    if (!isSerializedRule(rule)) return true;
    return !hiddenRules.has(rule.name);
  });

  if (filteredGrammar.length === 0) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: ${theme === 'dark' ? '#18181b' : '#fafafa'};
              color: ${theme === 'dark' ? '#a1a1aa' : '#71717a'};
            }
          </style>
        </head>
        <body>
          <p>No rules selected. Enable rules from the filter panel.</p>
        </body>
      </html>
    `;
  }

  const baseHtml = createSyntaxDiagramsCode(filteredGrammar);

  const darkThemeCss = `
    body {
      background: #18181b !important;
      color: #e4e4e7 !important;
    }
    .diagramContainer {
      background: #27272a !important;
      border-color: #3f3f46 !important;
    }
    .diagramHeader {
      background: #3f3f46 !important;
      color: #fafafa !important;
      border-color: #52525b !important;
    }
    .diagramHeader:hover {
      background: #52525b !important;
    }
    svg {
      background: #27272a !important;
    }
    svg text {
      fill: #e4e4e7 !important;
    }
    svg rect {
      fill: #3f3f46 !important;
      stroke: #52525b !important;
    }
    svg .terminal rect {
      fill: #164e63 !important;
      stroke: #0891b2 !important;
    }
    svg .non-terminal rect {
      fill: #312e81 !important;
      stroke: #6366f1 !important;
    }
    .highlighted .diagramHeader {
      background: #1e40af !important;
      border-color: #3b82f6 !important;
    }
    .highlighted svg rect {
      stroke-width: 2 !important;
    }
  `;

  const lightThemeCss = `
    body {
      background: #fafafa !important;
    }
    .highlighted .diagramHeader {
      background: #dbeafe !important;
      border-color: #3b82f6 !important;
    }
  `;

  const customScript = `
    <script>
      (function() {
        // Notify parent that we're ready
        window.parent.postMessage({ source: 'srl-diagram', type: 'ready' }, '*');

        // Handle hover events
        document.addEventListener('mouseover', function(e) {
          const container = e.target.closest('.diagramContainer');
          if (container) {
            const header = container.querySelector('.diagramHeader');
            const ruleName = header?.textContent?.trim();
            if (ruleName) {
              window.parent.postMessage({ 
                source: 'srl-diagram', 
                type: 'hover', 
                ruleName: ruleName 
              }, '*');
            }
          }
        });

        document.addEventListener('mouseout', function(e) {
          const container = e.target.closest('.diagramContainer');
          if (container && !container.contains(e.relatedTarget)) {
            window.parent.postMessage({ 
              source: 'srl-diagram', 
              type: 'hover', 
              ruleName: null 
            }, '*');
          }
        });

        // Handle click events
        document.addEventListener('click', function(e) {
          const container = e.target.closest('.diagramContainer');
          if (container) {
            const header = container.querySelector('.diagramHeader');
            const ruleName = header?.textContent?.trim();
            if (ruleName) {
              window.parent.postMessage({ 
                source: 'srl-diagram', 
                type: 'click', 
                ruleName: ruleName 
              }, '*');
            }
          }
        });

        // Handle messages from parent
        window.addEventListener('message', function(e) {
          if (e.data?.source !== 'srl-editor') return;

          const containers = document.querySelectorAll('.diagramContainer');

          if (e.data.type === 'highlight') {
            containers.forEach(function(container) {
              const header = container.querySelector('.diagramHeader');
              const ruleName = header?.textContent?.trim();
              if (ruleName === e.data.ruleName) {
                container.classList.add('highlighted');
              } else {
                container.classList.remove('highlighted');
              }
            });
          }

          if (e.data.type === 'scrollTo') {
            containers.forEach(function(container) {
              const header = container.querySelector('.diagramHeader');
              const ruleName = header?.textContent?.trim();
              if (ruleName === e.data.ruleName) {
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                container.classList.add('highlighted');
                setTimeout(function() {
                  container.classList.remove('highlighted');
                }, 2000);
              }
            });
          }
        });
      })();
    </script>
  `;

  const themeStyle = `<style>${theme === 'dark' ? darkThemeCss : lightThemeCss}</style>`;

  return baseHtml
    .replace('</head>', `${themeStyle}</head>`)
    .replace('</body>', `${customScript}</body>`);
}

export function SyntaxDiagramPanel({
  theme = 'dark',
  highlightedRule,
  onRuleHover,
  onRuleClick,
}: SyntaxDiagramPanelProps) {
  const [hiddenRules, setHiddenRules] = useState<Set<string>>(() => getStoredHiddenRules());
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  const { iframeRef, highlightRule, isReady } = useSyntaxDiagrams({
    onRuleHover,
    onRuleClick,
  });

  const grammarRules = useMemo(() => getGrammarRuleNames(), []);
  const serializedGrammar = useMemo(() => getSerializedGrammar(), []);

  const rulesByCategory = useMemo(() => {
    const grouped: Record<string, GrammarRuleInfo[]> = {};
    for (const rule of grammarRules) {
      if (!grouped[rule.category]) {
        grouped[rule.category] = [];
      }
      grouped[rule.category].push(rule);
    }
    return grouped;
  }, [grammarRules]);

  const diagramHtml = useMemo(() => {
    return generateDiagramHtml(serializedGrammar, hiddenRules, theme);
  }, [serializedGrammar, hiddenRules, theme]);

  useEffect(() => {
    if (isReady && highlightedRule) {
      highlightRule(highlightedRule);
    }
  }, [isReady, highlightedRule, highlightRule]);

  useEffect(() => {
    storeHiddenRules(hiddenRules);
  }, [hiddenRules]);

  const toggleRule = useCallback((ruleName: string) => {
    setHiddenRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleName)) {
        next.delete(ruleName);
      } else {
        next.add(ruleName);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const showAllInCategory = useCallback((category: string) => {
    const rulesInCategory = rulesByCategory[category] || [];
    setHiddenRules(prev => {
      const next = new Set(prev);
      for (const rule of rulesInCategory) {
        next.delete(rule.name);
      }
      return next;
    });
  }, [rulesByCategory]);

  const hideAllInCategory = useCallback((category: string) => {
    const rulesInCategory = rulesByCategory[category] || [];
    setHiddenRules(prev => {
      const next = new Set(prev);
      for (const rule of rulesInCategory) {
        next.add(rule.name);
      }
      return next;
    });
  }, [rulesByCategory]);

  const visibleCount = grammarRules.length - hiddenRules.size;

  const bgColor = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-zinc-700' : 'border-zinc-200';
  const textColor = theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700';
  const mutedColor = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const hoverBg = theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100';

  return (
    <div className={`h-full flex flex-col ${bgColor} ${textColor}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderColor} shrink-0`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h4" />
        </svg>
        <span className="text-sm font-medium">Syntax Diagrams</span>
        <span className={`text-xs ${mutedColor}`}>
          {visibleCount}/{grammarRules.length} rules
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              p-1.5 rounded transition-colors text-xs font-medium flex items-center gap-1
              ${showFilters 
                ? theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                : hoverBg
              }
            `}
            title="Toggle rule filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
        </div>
      </div>

      {/* Filter sidebar */}
      {showFilters && (
        <div className={`border-b ${borderColor} max-h-64 overflow-y-auto`}>
          <div className="p-2 space-y-1">
            {CATEGORY_ORDER.map(category => {
              const rules = rulesByCategory[category] || [];
              if (rules.length === 0) return null;

              const visibleInCategory = rules.filter(r => !hiddenRules.has(r.name)).length;
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleCategory(category)}
                      className={`flex-1 flex items-center gap-1 px-2 py-1 rounded ${hoverBg} text-left`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                      <span className={mutedColor}>({visibleInCategory}/{rules.length})</span>
                    </button>
                    <button
                      onClick={() => showAllInCategory(category)}
                      className={`px-1.5 py-0.5 rounded ${hoverBg}`}
                      title="Show all"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => hideAllInCategory(category)}
                      className={`px-1.5 py-0.5 rounded ${hoverBg}`}
                      title="Hide all"
                    >
                      ✗
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {rules.map(rule => (
                        <label
                          key={rule.name}
                          className={`flex items-center gap-2 px-2 py-0.5 rounded cursor-pointer ${hoverBg}`}
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenRules.has(rule.name)}
                            onChange={() => toggleRule(rule.name)}
                            className="rounded text-purple-500 focus:ring-purple-500"
                          />
                          <code className="font-mono">{rule.name}</code>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagram iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          srcDoc={diagramHtml}
          className="w-full h-full border-0"
          title="SRL Syntax Diagrams"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
