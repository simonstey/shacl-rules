'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { Example } from '@/lib/examples';
import { useValidation } from '@/lib/validation';
import { useRuleExecution } from '@/lib/rules/useRuleExecution';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { ExamplesSidebar, ValidationPanel, FileUpload, InferredTriplesPanel } from '@/components';
import { ResizablePanels, ResizeHandle } from './ResizablePanels';
import { SyntaxBreakdown } from './SyntaxBreakdown';
import { SyntaxDiagramPanel } from './SyntaxDiagramPanel';
import { type RuleInfo, type InferredTriple } from 'srl-engine';

type RightPanelTab = 'validation' | 'inferred';

const SRLEditor = dynamic(() => import('@/components/SRLEditor').then((mod) => mod.SRLEditor), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="text-ink-muted">Loading editor...</div>
    </div>
  ),
});

const RDFEditor = dynamic(() => import('@/components/RDFEditor').then((mod) => mod.RDFEditor), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-surface">
      <div className="text-ink-muted">Loading editor...</div>
    </div>
  ),
});

const DEFAULT_SRL = `PREFIX : <http://example.org/>

# Sample SHACL 1.2 Rules

# Derive childOf from parentOf relationships
RULE { ?x :childOf ?y } WHERE { ?y :parentOf ?x }

# Transitive ancestor relationship
RULE { ?x :ancestorOf ?z } WHERE {
    ?x :parentOf ?y .
    ?y :ancestorOf ?z
}

# Direct ancestor
RULE { ?x :ancestorOf ?y } WHERE { ?x :parentOf ?y }

# Shorthand declarations
TRANSITIVE(:ancestorOf)
(:siblingOf) SYMMETRIC

DATA {
    :john :parentOf :mary .
    :mary :parentOf :tom .
}
`;

const DEFAULT_RDF = `@prefix : <http://example.org/> .

:john :parentOf :mary .
:mary :parentOf :tom .
:tom :siblingOf :jane .
`;

const DEFAULT_SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# SHACL shapes for FOR ?v IN <shape> rules (opt-in extension).
# Select a "Shape Targeting" example to see this in action.
ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .
`;

export function Playground() {
  const [srlCode, setSrlCode] = useState(DEFAULT_SRL);
  const [rdfData, setRdfData] = useState(DEFAULT_RDF);
  const [shapesGraph, setShapesGraph] = useState(DEFAULT_SHAPES);
  const [activeDataTab, setActiveDataTab] = useState<'data' | 'shapes'>('data');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Start dark to match the server-rendered markup (avoids hydration mismatch);
  // the real preference is resolved on mount in the effect below.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showSyntaxPanel, setShowSyntaxPanel] = useState(true);
  const [showDiagramPanel, setShowDiagramPanel] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>('validation');
  const [highlightedRuleIndex, setHighlightedRuleIndex] = useState<number | null>(null);
  const [highlightedGrammarRule, setHighlightedGrammarRule] = useState<string | null>(null);

  // Below this width the side-by-side editor/results layout stops being usable,
  // so panels stack vertically and the sidebar collapses.
  const isNarrow = useMediaQuery('(max-width: 900px)');

  const srlEditorRef = useRef<{ editor: editor.IStandaloneCodeEditor | null; monaco: Monaco | null }>({
    editor: null, 
    monaco: null 
  });
  
  const ruleDecorationsRef = useRef<string[]>([]);
  const tokenDecorationsRef = useRef<string[]>([]);

  const { result, isValidating, validate } = useValidation();
  const { 
    result: executionResult, 
    ruleSet, 
    isExecuting, 
    error: executionError, 
    execute, 
    reset: resetExecution 
  } = useRuleExecution();

  const prefixes = useMemo(() => {
    return ruleSet?.prefixes ?? new Map<string, string>();
  }, [ruleSet]);

  useEffect(() => {
    validate(srlCode, shapesGraph);
  }, [srlCode, shapesGraph, validate]);

  // Initialize theme from the client environment once on mount. We render the
  // server default (dark) first and correct here, so the initial client render
  // matches the SSR markup (no hydration mismatch); a lazy useState initializer
  // reading localStorage would desync the two.
  useEffect(() => {
    const saved = localStorage.getItem('srl-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  // Auto-collapse the sidebar when the viewport becomes narrow (and restore it
  // when it widens again). Reactive to viewport changes, not just first load.
  useEffect(() => {
    setSidebarCollapsed(isNarrow);
  }, [isNarrow]);

  // Drive the theme via a class on <html> so global CSS (scrollbars, tokens)
  // and the in-app toggle share a single source of truth, and persist the choice.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    localStorage.setItem('srl-theme', theme);
  }, [theme]);

  const handleSelectExample = useCallback((example: Example) => {
    setSrlCode(example.srlCode);
    if (example.rdfData) {
      setRdfData(example.rdfData);
    }
    setShapesGraph(example.shapesGraph ?? DEFAULT_SHAPES);
    resetExecution();
  }, [resetExecution]);

  const handleFileUpload = useCallback((content: string, filename: string) => {
    if (filename.endsWith('.srl') || filename.endsWith('.shacl')) {
      setSrlCode(content);
    } else {
      setRdfData(content);
    }
    resetExecution();
  }, [resetExecution]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleRunRules = useCallback(() => {
    setActiveRightTab('inferred');
    execute(srlCode, rdfData, shapesGraph);
  }, [srlCode, rdfData, shapesGraph, execute]);

  const handleRuleHover = useCallback((ruleInfo: RuleInfo | null) => {
    setHighlightedRuleIndex(ruleInfo?.index ?? null);
    
    const { editor, monaco } = srlEditorRef.current;
    if (!editor || !monaco) return;
    
    editor.deltaDecorations(ruleDecorationsRef.current, []);
    ruleDecorationsRef.current = [];
    
    if (ruleInfo?.location) {
      const decorations = editor.deltaDecorations([], [
        {
          range: new monaco.Range(
            ruleInfo.location.startLine,
            ruleInfo.location.startColumn,
            ruleInfo.location.endLine,
            ruleInfo.location.endColumn + 50
          ),
          options: {
            className: 'rule-highlight-hover',
            isWholeLine: true,
            overviewRuler: {
              color: '#3b82f6',
              position: monaco.editor.OverviewRulerLane.Full,
            },
          },
        },
      ]);
      ruleDecorationsRef.current = decorations;
    }
  }, []);

  const handleTripleHover = useCallback((triple: InferredTriple | null) => {
    if (triple) {
      handleRuleHover(triple.sourceRule);
    } else {
      handleRuleHover(null);
    }
  }, [handleRuleHover]);

  const handleTokenHover = useCallback((range: { startLine: number; startColumn: number; endLine: number; endColumn: number } | null) => {
    const { editor, monaco } = srlEditorRef.current;
    if (!editor || !monaco) return;

    // Clear the previous hover decoration before adding a new one, otherwise
    // every hovered token would leave a stale highlight behind.
    tokenDecorationsRef.current = editor.deltaDecorations(
      tokenDecorationsRef.current,
      range
        ? [
            {
              range: new monaco.Range(range.startLine, range.startColumn, range.endLine, range.endColumn),
              options: {
                className: 'syntax-highlight-hover',
                isWholeLine: false,
              },
            },
          ]
        : []
    );
  }, []);

  const handleTokenClick = useCallback((range: { startLine: number; startColumn: number; endLine: number; endColumn: number }) => {
    const { editor, monaco } = srlEditorRef.current;
    if (!editor || !monaco) return;

    editor.revealLineInCenter(range.startLine);
    editor.setSelection(new monaco.Range(range.startLine, range.startColumn, range.endLine, range.endColumn));
    editor.focus();
  }, []);

  const handleSRLEditorReady = useCallback((editorInstance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    srlEditorRef.current = { editor: editorInstance, monaco: monacoInstance };
  }, []);

  const handleGrammarRuleChange = useCallback((ruleName: string | null) => {
    setHighlightedGrammarRule(ruleName);
  }, []);

  const handleDiagramRuleHover = useCallback((ruleName: string | null) => {
    setHighlightedGrammarRule(ruleName);
  }, []);

  const handleDiagramRuleClick = useCallback((ruleName: string) => {
    setHighlightedGrammarRule(ruleName);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b shrink-0 bg-surface-2 border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-ink">
            SHACL Rules Playground
          </h1>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
            }`}
          >
            v1.2
          </span>
        </div>

        <div className="flex items-center gap-2">
          <FileUpload onFileContent={handleFileUpload} />

          {/* Run Rules button */}
          <button
            onClick={handleRunRules}
            disabled={isExecuting || !result?.isValid}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isExecuting
                ? 'bg-surface-3 text-ink-muted cursor-wait'
                : !result?.isValid
                ? 'bg-surface-3 text-ink-muted cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
            title={!result?.isValid ? 'Fix validation errors first' : 'Execute rules against RDF data'}
          >
            {isExecuting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            {isExecuting ? 'Running...' : 'Run Rules'}
          </button>

          {/* Toggle syntax diagrams panel */}
          <button
            onClick={() => setShowDiagramPanel(!showDiagramPanel)}
            aria-label={showDiagramPanel ? 'Hide syntax diagrams' : 'Show syntax diagrams'}
            aria-pressed={showDiagramPanel}
            className={`p-2 rounded-lg transition-colors ${
              showDiagramPanel
                ? theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                : 'hover:bg-surface-3 text-ink-muted'
            }`}
            title={showDiagramPanel ? 'Hide syntax diagrams' : 'Show syntax diagrams'}
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
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 17h7" />
              <path d="M17.5 14v7" />
            </svg>
          </button>

          {/* Toggle syntax panel */}
          <button
            onClick={() => setShowSyntaxPanel(!showSyntaxPanel)}
            aria-label={showSyntaxPanel ? 'Hide syntax analysis' : 'Show syntax analysis'}
            aria-pressed={showSyntaxPanel}
            className={`p-2 rounded-lg transition-colors ${
              showSyntaxPanel
                ? theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                : 'hover:bg-surface-3 text-ink-muted'
            }`}
            title={showSyntaxPanel ? 'Hide syntax analysis' : 'Show syntax analysis'}
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
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>

          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg transition-colors hover:bg-surface-3 text-ink-muted"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
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
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
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
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <a
            href="https://www.w3.org/TR/shacl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded transition-colors text-ink-muted hover:text-ink hover:bg-surface-3"
          >
            SHACL Spec
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ExamplesSidebar
          onSelectExample={handleSelectExample}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          theme={theme}
        />

        {/* Editor area. On narrow viewports the whole group stacks vertically
            (editors above the results panel) so nothing collapses into unusable
            slivers. The key forces a clean remount when the axis flips, since
            react-resizable-panels bakes direction into its layout math. */}
        <main className="flex-1 overflow-hidden">
          <PanelGroup
            key={isNarrow ? 'stacked' : 'side-by-side'}
            direction={isNarrow ? 'vertical' : 'horizontal'}
            className="h-full"
          >
            {/* Main editors section */}
            <Panel defaultSize={isNarrow ? 60 : 75} minSize={isNarrow ? 30 : 40}>
              <ResizablePanels
                stacked={isNarrow}
                leftTitle="Data / Shapes (Turtle)"
                rightTitle="Rules (SRL)"
                bottomTitle={showDiagramPanel ? "Syntax Diagrams" : "Syntax Analysis"}
                defaultLeftSize={40}
                defaultBottomSize={28}
                showBottom={showSyntaxPanel || showDiagramPanel}
                leftPanel={
                  <div className="h-full flex flex-col">
                    <div role="tablist" aria-label="Graph editors" className="shrink-0 flex border-b border-border bg-surface-2">
                      <button
                        role="tab"
                        id="tab-data"
                        aria-selected={activeDataTab === 'data'}
                        aria-controls="panel-graph-editor"
                        onClick={() => setActiveDataTab('data')}
                        className={activeDataTab === 'data' ? 'px-3 py-1.5 text-xs font-medium text-ink border-b-2 border-blue-500' : 'px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink'}
                      >
                        Data
                      </button>
                      <button
                        role="tab"
                        id="tab-shapes"
                        aria-selected={activeDataTab === 'shapes'}
                        aria-controls="panel-graph-editor"
                        onClick={() => setActiveDataTab('shapes')}
                        className={activeDataTab === 'shapes' ? 'px-3 py-1.5 text-xs font-medium text-ink border-b-2 border-blue-500' : 'px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink'}
                      >
                        Shapes
                      </button>
                    </div>
                    <div
                      className="flex-1 overflow-hidden"
                      role="tabpanel"
                      id="panel-graph-editor"
                      aria-labelledby={activeDataTab === 'data' ? 'tab-data' : 'tab-shapes'}
                    >
                      {activeDataTab === 'data' ? (
                        <RDFEditor value={rdfData} onChange={setRdfData} theme={theme} />
                      ) : (
                        <RDFEditor value={shapesGraph} onChange={setShapesGraph} theme={theme} />
                      )}
                    </div>
                  </div>
                }
                rightPanel={
                  <SRLEditor
                    value={srlCode}
                    onChange={setSrlCode}
                    validationMessages={result?.messages}
                    theme={theme}
                    onEditorReady={handleSRLEditorReady}
                    onGrammarRuleChange={showDiagramPanel ? handleGrammarRuleChange : undefined}
                  />
                }
                bottomPanel={
                  showDiagramPanel ? (
                    <SyntaxDiagramPanel
                      theme={theme}
                      highlightedRule={highlightedGrammarRule}
                      onRuleHover={handleDiagramRuleHover}
                      onRuleClick={handleDiagramRuleClick}
                    />
                  ) : (
                    <SyntaxBreakdown
                      code={srlCode}
                      theme={theme}
                      onTokenHover={handleTokenHover}
                      onTokenClick={handleTokenClick}
                    />
                  )
                }
              />
            </Panel>

            <ResizeHandle direction={isNarrow ? 'vertical' : 'horizontal'} />

            {/* Right panel with tabs for Validation and Inferred Triples */}
            <Panel defaultSize={isNarrow ? 40 : 25} minSize={15} maxSize={isNarrow ? 70 : 50}>
              <div className={`h-full flex flex-col bg-surface-2 border-border ${isNarrow ? 'border-t' : 'border-l'}`}>
                {/* Tab headers */}
                <div
                  role="tablist"
                  aria-label="Results panels"
                  className="shrink-0 flex border-b border-border bg-surface-2"
                >
                  <button
                    role="tab"
                    id="tab-validation"
                    aria-selected={activeRightTab === 'validation'}
                    aria-controls="panel-validation"
                    onClick={() => setActiveRightTab('validation')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                      activeRightTab === 'validation'
                        ? 'text-ink'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 12l2 2 4-4" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                      Validation
                      {result && (
                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                          result.isValid
                            ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            : theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                        }`}>
                          {result.messages.filter(m => m.type === 'error').length || '✓'}
                        </span>
                      )}
                    </span>
                    {activeRightTab === 'validation' && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                        theme === 'dark' ? 'bg-blue-500' : 'bg-blue-600'
                      }`} />
                    )}
                  </button>
                  <button
                    role="tab"
                    id="tab-inferred"
                    aria-selected={activeRightTab === 'inferred'}
                    aria-controls="panel-inferred"
                    onClick={() => setActiveRightTab('inferred')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                      activeRightTab === 'inferred'
                        ? 'text-ink'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Inferred
                      {executionResult && executionResult.errors.length === 0 && (
                        <span className={`text-[10px] px-1 py-0.5 rounded ${
                          theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                        }`}>
                          {executionResult.inferredTriples.length}
                        </span>
                      )}
                    </span>
                    {activeRightTab === 'inferred' && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                        theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                      }`} />
                    )}
                  </button>
                </div>

                {/* Tab content */}
                <div
                  className="flex-1 overflow-hidden"
                  role="tabpanel"
                  id={activeRightTab === 'validation' ? 'panel-validation' : 'panel-inferred'}
                  aria-labelledby={activeRightTab === 'validation' ? 'tab-validation' : 'tab-inferred'}
                >
                  {activeRightTab === 'validation' ? (
                    <ValidationPanel result={result} isValidating={isValidating} />
                  ) : (
                    <InferredTriplesPanel
                      result={executionResult}
                      prefixes={prefixes}
                      theme={theme}
                      onRuleHover={handleRuleHover}
                      onTripleHover={handleTripleHover}
                      highlightedRuleIndex={highlightedRuleIndex}
                    />
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </main>
      </div>

      {/* Status bar */}
      <footer className="h-6 px-4 flex items-center justify-between text-[11px] border-t shrink-0 bg-surface-2 border-border text-ink-muted">
        <span>SHACL 1.2 Rules • Shape Rule Language</span>
        <div className="flex items-center gap-4">
          {isExecuting && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Executing rules...
            </span>
          )}
          {executionResult && !isExecuting && (
            <span className={executionResult.errors.length === 0 ? 'text-green-500' : 'text-orange-400'}>
              {executionResult.inferredTriples.length} inferred • {executionResult.executionTime.toFixed(1)}ms
            </span>
          )}
          {executionError && !isExecuting && (
            <span className="text-red-400" title={executionError}>
              Execution error
            </span>
          )}
          <span className="text-border-2">|</span>
          {isValidating && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Validating...
            </span>
          )}
          {result && !isValidating && (
            <span className={result.isValid ? 'text-green-500' : 'text-red-400'}>
              {result.isValid 
                ? '✓ Valid' 
                : `${result.messages?.filter(m => m.type === 'error').length || 0} errors`}
            </span>
          )}
          {result?.parseTime !== undefined && (
            <span>Parsed in {result.parseTime.toFixed(1)}ms</span>
          )}
        </div>
      </footer>
    </div>
  );
}
