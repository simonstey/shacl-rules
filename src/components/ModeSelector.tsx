'use client';

export type PlaygroundMode = 'srl' | 'node-expressions';

interface ModeSelectorProps {
  mode: PlaygroundMode;
  onModeChange: (mode: PlaygroundMode) => void;
  theme: 'light' | 'dark';
}

export function ModeSelector({ mode, onModeChange, theme }: ModeSelectorProps) {
  return (
    <div
      className={`flex items-center rounded-lg p-0.5 ${
        theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'
      }`}
    >
      <button
        onClick={() => onModeChange('srl')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          mode === 'srl'
            ? theme === 'dark'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-blue-600 text-white shadow-sm'
            : theme === 'dark'
            ? 'text-zinc-400 hover:text-zinc-200'
            : 'text-zinc-600 hover:text-zinc-900'
        }`}
        title="Shape Rules Language (SRL) mode for authoring SHACL 1.2 rules"
      >
        <span className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          SRL
        </span>
      </button>
      <button
        onClick={() => onModeChange('node-expressions')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          mode === 'node-expressions'
            ? theme === 'dark'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-purple-600 text-white shadow-sm'
            : theme === 'dark'
            ? 'text-zinc-400 hover:text-zinc-200'
            : 'text-zinc-600 hover:text-zinc-900'
        }`}
        title="Node Expressions mode for SHACL 1.2 node expression evaluation"
      >
        <span className="flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
          Node Expr
        </span>
      </button>
    </div>
  );
}
