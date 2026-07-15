'use client';

import { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface ResizablePanelsProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  bottomPanel?: ReactNode;
  leftTitle?: string;
  rightTitle?: string;
  bottomTitle?: string;
  defaultLeftSize?: number;
  defaultBottomSize?: number;
  showBottom?: boolean;
  /** When true, the two editors stack vertically instead of sitting side by side. */
  stacked?: boolean;
}

function ResizeHandle({
  direction = 'horizontal',
}: {
  direction?: 'horizontal' | 'vertical';
}) {
  const isHorizontal = direction === 'horizontal';

  return (
    <PanelResizeHandle
      className={`group relative flex items-center justify-center ${isHorizontal ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'} bg-surface-3 hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors duration-150`}
    >
      {/* Resize indicator dots */}
      <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isHorizontal ? 'flex-col' : 'flex-row'}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-ink-muted" />
        ))}
      </div>

      {/* Hover line indicator */}
      <div className={`absolute opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-blue-500 ${isHorizontal ? 'w-0.5 h-8' : 'h-0.5 w-8'}`} />
    </PanelResizeHandle>
  );
}

interface PanelHeaderProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

function PanelHeader({ title, icon, actions }: PanelHeaderProps) {
  return (
    <div className="h-9 px-3 flex items-center justify-between gap-2 shrink-0 border-b select-none bg-surface-2 border-border text-ink-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
        {icon}
        <span>{title}</span>
      </div>
      {actions && (
        <div className="flex items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  bottomPanel,
  leftTitle = 'Data Graph',
  rightTitle = 'Rules',
  bottomTitle = 'Syntax Analysis',
  defaultLeftSize = 40,
  defaultBottomSize = 30,
  showBottom = true,
  stacked = false,
}: ResizablePanelsProps) {
  // When stacked, the two editors run top→bottom, so the data panel gets a
  // bottom border and the resize handle between them flips to vertical.
  const editorGroupDir = stacked ? 'vertical' : 'horizontal';
  const editorHandleDir = stacked ? 'vertical' : 'horizontal';
  const dataPanelBorder = stacked ? 'border-b' : 'border-r';

  return (
    <PanelGroup direction="vertical" className="h-full">
      {/* Top section with the two editors */}
      <Panel defaultSize={showBottom ? (100 - defaultBottomSize) : 100} minSize={30}>
        <PanelGroup key={editorGroupDir} direction={editorGroupDir} className="h-full">
          {/* Data Graph */}
          <Panel defaultSize={defaultLeftSize} minSize={20} maxSize={80}>
            <div className={`h-full flex flex-col bg-surface-2 border-border ${dataPanelBorder}`}>
              <PanelHeader
                title={leftTitle}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="3" />
                    <circle cx="5" cy="19" r="3" />
                    <circle cx="19" cy="19" r="3" />
                    <line x1="12" y1="8" x2="5" y2="16" />
                    <line x1="12" y1="8" x2="19" y2="16" />
                  </svg>
                }
              />
              <div className="flex-1 overflow-hidden">
                {leftPanel}
              </div>
            </div>
          </Panel>

          <ResizeHandle direction={editorHandleDir} />

          {/* Rules */}
          <Panel defaultSize={100 - defaultLeftSize} minSize={20} maxSize={80}>
            <div className="h-full flex flex-col bg-surface-2">
              <PanelHeader
                title={rightTitle}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                }
              />
              <div className="flex-1 overflow-hidden">
                {rightPanel}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </Panel>

      {/* Bottom Panel - Syntax Analysis */}
      {showBottom && bottomPanel && (
        <>
          <ResizeHandle direction="vertical" />
          <Panel defaultSize={defaultBottomSize} minSize={15} maxSize={60}>
            <div className="h-full flex flex-col bg-surface-2 border-border border-t">
              <PanelHeader
                title={bottomTitle}
                icon={
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                }
              />
              <div className="flex-1 overflow-hidden">
                {bottomPanel}
              </div>
            </div>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}

export { PanelHeader, ResizeHandle };
