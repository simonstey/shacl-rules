'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Example,
  ExampleCategory,
  examples,
  exampleCategories,
  searchExamples,
} from '@/lib/examples';

interface ExamplesSidebarProps {
  onSelectExample: (example: Example) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  theme?: 'light' | 'dark';
}

export function ExamplesSidebar({
  onSelectExample,
  isCollapsed = false,
  onToggleCollapse,
  theme = 'dark',
}: ExamplesSidebarProps) {
  const isDark = theme === 'dark';
  // Neutral chrome reads from CSS-variable tokens (bg-surface-2, text-ink-*,
  // border-border) so both themes share one source of truth — no per-value
  // ternary. Only the selection accent tint stays theme-conditional.
  const panelBg = 'bg-surface-2';
  const panelBorder = 'border-border';
  const headingText = 'text-ink';
  const bodyText = 'text-ink-2';
  const mutedText = 'text-ink-muted';
  const hoverBg = 'hover:bg-surface-3';
  const iconBtn = 'hover:bg-surface-3 text-ink-2';
  // Selected uses an accent tint (distinct from the neutral hover bg) instead
  // of the previous banned colored left border.
  const selectedBg = isDark ? 'bg-blue-500/15' : 'bg-blue-50';
  const inputStyle = 'bg-surface-3 border-border-2 text-ink placeholder-ink-muted';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<ExampleCategory>>(
    new Set(['basic-inference'])
  );
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  const filteredExamples = useMemo(() => {
    if (searchQuery.trim()) {
      return searchExamples(searchQuery);
    }
    return examples;
  }, [searchQuery]);

  const examplesByCategory = useMemo(() => {
    const grouped: Partial<Record<ExampleCategory, Example[]>> = {};
    for (const example of filteredExamples) {
      if (!grouped[example.category]) {
        grouped[example.category] = [];
      }
      grouped[example.category]!.push(example);
    }
    return grouped;
  }, [filteredExamples]);

  const toggleCategory = useCallback((category: ExampleCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleSelectExample = useCallback(
    (example: Example) => {
      setSelectedExampleId(example.id);
      onSelectExample(example);
    },
    [onSelectExample]
  );

  if (isCollapsed) {
    return (
      <div className={`w-12 h-full ${panelBg} border-r ${panelBorder} flex flex-col items-center py-4`}>
        <button
          onClick={onToggleCollapse}
          aria-label="Expand examples sidebar"
          className={`p-2 rounded-lg transition-colors ${iconBtn}`}
          title="Expand sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside className={`w-72 h-full ${panelBg} border-r ${panelBorder} flex flex-col`} aria-label="Examples">
      {/* Header */}
      <div className={`p-4 border-b ${panelBorder} flex items-center justify-between`}>
        <h2 className={`font-semibold ${headingText}`}>Examples</h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse examples sidebar"
            className={`p-1.5 rounded transition-colors ${iconBtn}`}
            title="Collapse sidebar"
          >
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
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Search */}
      <div className={`p-3 border-b ${panelBorder}`}>
        <input
          type="text"
          aria-label="Search examples"
          placeholder="Search examples..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputStyle}`}
        />
      </div>

      {/* Examples list */}
      <div className="flex-1 overflow-y-auto">
        {(Object.keys(exampleCategories) as ExampleCategory[]).map((category) => {
          const categoryExamples = examplesByCategory[category];
          if (!categoryExamples || categoryExamples.length === 0) return null;

          const isExpanded = expandedCategories.has(category);
          const categoryInfo = exampleCategories[category];

          return (
            <div key={category} className={`border-b ${panelBorder}`}>
              <button
                onClick={() => toggleCategory(category)}
                aria-expanded={isExpanded}
                className={`w-full px-4 py-3 flex items-center justify-between transition-colors text-left ${hoverBg}`}
              >
                <div>
                  <div className="font-medium text-sm text-ink">{categoryInfo.name}</div>
                  <div className={`text-xs ${mutedText}`}>{categoryExamples.length} examples</div>
                </div>
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
                  className={`${mutedText} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="pb-2">
                  {categoryExamples.map((example) => {
                    const isSelected = selectedExampleId === example.id;
                    return (
                      <button
                        key={example.id}
                        onClick={() => handleSelectExample(example)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full px-6 py-2 text-left transition-colors ${
                          isSelected ? `${selectedBg} font-medium` : hoverBg
                        }`}
                      >
                        <div className={`text-sm ${bodyText}`}>{example.title}</div>
                        <div className={`text-xs ${mutedText} line-clamp-1`}>{example.description}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
