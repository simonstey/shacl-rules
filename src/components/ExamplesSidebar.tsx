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
}

export function ExamplesSidebar({
  onSelectExample,
  isCollapsed = false,
  onToggleCollapse,
}: ExamplesSidebarProps) {
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
      <div className="w-12 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
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
    <div className="w-72 h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-100">Examples</h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
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
      <div className="p-3 border-b border-zinc-800">
        <input
          type="text"
          placeholder="Search examples..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div key={category} className="border-b border-zinc-800">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800 transition-colors text-left"
              >
                <div>
                  <div className="font-medium text-zinc-200 text-sm">{categoryInfo.name}</div>
                  <div className="text-xs text-zinc-500">{categoryExamples.length} examples</div>
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
                  className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="pb-2">
                  {categoryExamples.map((example) => (
                    <button
                      key={example.id}
                      onClick={() => handleSelectExample(example)}
                      className={`w-full px-6 py-2 text-left hover:bg-zinc-800 transition-colors ${
                        selectedExampleId === example.id ? 'bg-zinc-800 border-l-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="text-sm text-zinc-300">{example.title}</div>
                      <div className="text-xs text-zinc-500 line-clamp-1">{example.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
