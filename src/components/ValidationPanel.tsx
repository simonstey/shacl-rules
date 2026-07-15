'use client';

import { ValidationResult } from '@/lib/validation';

interface ValidationPanelProps {
  result: ValidationResult | null;
  isValidating: boolean;
}

export function ValidationPanel({ result, isValidating }: ValidationPanelProps) {
  const bgColor = 'bg-surface-2';
  const borderColor = 'border-border';
  const textColor = 'text-ink-2';
  // Muted text still needs AA contrast (4.5:1): zinc-400 on zinc-900 ≈ 6.9:1,
  // zinc-600 on white ≈ 7.5:1. zinc-500/zinc-400 previously failed.
  const mutedColor = 'text-ink-muted';
  const hoverBg = 'hover:bg-surface-3';

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
          <h3 className="font-medium text-xs text-ink">Validation</h3>
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
