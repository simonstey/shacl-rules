'use client';

import { ValidationResult } from '@/lib/validation';

interface ValidationPanelProps {
  result: ValidationResult | null;
  isValidating: boolean;
  theme?: 'light' | 'dark';
}

export function ValidationPanel({ result, isValidating, theme = 'dark' }: ValidationPanelProps) {
  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-zinc-900' : 'bg-white';
  const borderColor = isDark ? 'border-zinc-700/50' : 'border-zinc-200';
  const textColor = isDark ? 'text-zinc-300' : 'text-zinc-700';
  const mutedColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const hoverBg = isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50';

  if (isValidating) {
    return (
      <div className={`h-full flex items-center justify-center ${mutedColor}`}>
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs">Validating...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`h-full flex items-center justify-center ${mutedColor} text-xs p-4 text-center`}>
        <span>Start typing to see validation results</span>
      </div>
    );
  }

  const errors = result.messages.filter((m) => m.type === 'error');
  const warnings = result.messages.filter((m) => m.type === 'warning');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`px-3 py-2 border-b ${borderColor} flex items-center justify-between ${bgColor}`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-medium text-xs ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>Validation</h3>
          <div className="flex items-center gap-2 text-[10px]">
            {errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {errors.length}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-yellow-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {warnings.length}
              </span>
            )}
            {errors.length === 0 && warnings.length === 0 && (
              <span className="flex items-center gap-1 text-green-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                OK
              </span>
            )}
          </div>
        </div>
        <span className={`text-[10px] ${mutedColor}`}>{result.parseTime.toFixed(0)}ms</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {result.messages.length === 0 ? (
          <div className={`p-3 text-center ${mutedColor} text-xs`}>No issues found</div>
        ) : (
          <div className={`divide-y ${borderColor}`}>
            {result.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`px-3 py-2 ${hoverBg} cursor-pointer transition-colors`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`flex-shrink-0 mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      msg.type === 'error'
                        ? 'bg-red-500/20 text-red-500'
                        : msg.type === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-blue-500/20 text-blue-500'
                    }`}
                  >
                    {msg.type === 'error' ? '!' : msg.type === 'warning' ? '?' : 'i'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${textColor} line-clamp-2`}>{msg.message}</p>
                    <p className={`text-[10px] ${mutedColor} mt-0.5`}>
                      L{msg.startLine}:{msg.startColumn}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
