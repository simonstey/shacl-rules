'use client';

import React, { useState, useMemo } from 'react';
import {
  nodeExprExampleCategories,
  nodeExprExamples,
  type NodeExprExample,
  type NodeExprExampleCategory,
} from '@/lib/examples/node-expr-examples';

export interface NodeExprExamplesSidebarProps {
  onSelectExample: (expressionCode: string, rdfData: string) => void;
  theme?: 'light' | 'dark';
}

// Convert categories record to array for iteration
const categoryEntries = Object.entries(nodeExprExampleCategories) as [
  NodeExprExampleCategory,
  { name: string; description: string }
][];

export function NodeExprExamplesSidebar({
  onSelectExample,
  theme = 'light',
}: NodeExprExamplesSidebarProps) {
  const [selectedCategory, setSelectedCategory] = useState<NodeExprExampleCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isDark = theme === 'dark';

  const filteredExamples = useMemo(() => {
    let examples = nodeExprExamples;

    // Filter by category
    if (selectedCategory) {
      examples = examples.filter(e => e.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      examples = examples.filter(
        e =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query)
      );
    }

    return examples;
  }, [selectedCategory, searchQuery]);

  const handleExampleClick = (example: NodeExprExample) => {
    onSelectExample(example.expressionCode, example.rdfData);
  };

  const getCategoryInfo = (categoryId: NodeExprExampleCategory) => {
    return nodeExprExampleCategories[categoryId];
  };

  return (
    <div
      className={`h-full flex flex-col ${
        isDark ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-900'
      }`}
    >
      {/* Header */}
      <div
        className={`p-3 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <h2 className="text-sm font-semibold mb-2">Node Expression Examples</h2>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search examples..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`w-full px-2 py-1 text-sm rounded border ${
            isDark
              ? 'bg-gray-800 border-gray-600 placeholder-gray-400'
              : 'bg-gray-50 border-gray-300 placeholder-gray-500'
          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
      </div>

      {/* Category Tabs */}
      <div
        className={`flex overflow-x-auto border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
            selectedCategory === null
              ? isDark
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-blue-600 border-b-2 border-blue-600'
              : isDark
              ? 'text-gray-400 hover:text-gray-200'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All
        </button>
        {categoryEntries.map(([categoryId, categoryInfo]) => (
          <button
            key={categoryId}
            onClick={() => setSelectedCategory(categoryId)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === categoryId
                ? isDark
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title={categoryInfo.description}
          >
            {categoryInfo.name}
          </button>
        ))}
      </div>

      {/* Examples List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredExamples.length === 0 ? (
          <div
            className={`text-center py-4 text-sm ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            No examples found
          </div>
        ) : (
          filteredExamples.map(example => {
            const categoryInfo = getCategoryInfo(example.category);
            return (
              <button
                key={example.id}
                onClick={() => handleExampleClick(example)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-800 hover:bg-gray-700'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-medium truncate ${
                        isDark ? 'text-gray-200' : 'text-gray-900'
                      }`}
                    >
                      {example.title}
                    </h3>
                    <p
                      className={`text-xs mt-1 line-clamp-2 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      {example.description}
                    </p>
                  </div>
                  {categoryInfo && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        isDark
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {categoryInfo.name}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer with count */}
      <div
        className={`p-2 border-t text-xs text-center ${
          isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'
        }`}
      >
        {filteredExamples.length} example{filteredExamples.length !== 1 ? 's' : ''}
        {selectedCategory && ` in ${getCategoryInfo(selectedCategory)?.name}`}
      </div>
    </div>
  );
}

export default NodeExprExamplesSidebar;
