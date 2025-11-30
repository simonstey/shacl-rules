'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Example } from '@/lib/examples';
import { useValidation } from '@/lib/validation';
import { useRuleExecution } from '@/lib/rules/useRuleExecution';
import { ExamplesSidebar, ValidationPanel, FileUpload, InferredTriplesPanel } from '@/components';
import { ResizablePanels, ResizeHandle } from './ResizablePanels';
import { SyntaxBreakdown } from './SyntaxBreakdown';
import { SyntaxDiagramPanel } from './SyntaxDiagramPanel';
import { RuleInfo, InferredTriple } from '@/lib/rules/executor';

type RightPanelTab = 'validation' | 'inferred';

const SRLEditor = dynamic(() => import('@/components/SRLEditor').then((mod) => mod.SRLEditor), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-zinc-900">
      <div className="text-zinc-500">Loading editor...</div>
    </div>
  ),
});

const RDFEditor = dynamic(() => import('@/components/RDFEditor').then((mod) => mod.RDFEditor), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-zinc-900">
      <div className="text-zinc-500">Loading editor...</div>
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
SYMMETRIC(:siblingOf)

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

export function Playground() {
  const [srlCode, setSrlCode] = useState(DEFAULT_SRL);
  const [rdfData, setRdfData] = useState(DEFAULT_RDF);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showSyntaxPanel, setShowSyntaxPanel] = useState(true);
  const [showDiagramPanel, setShowDiagramPanel] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>('validation');
  const [highlightedRuleIndex, setHighlightedRuleIndex] = useState<number | null>(null);
  const [highlightedGrammarRule, setHighlightedGrammarRule] = useState<string | null>(null);
  
  const srlEditorRef = useRef<{ editor: editor.IStandaloneCodeEditor | null; monaco: Monaco | null }>({ 
    editor: null, 
    monaco: null 
  });
  
  const ruleDecorationsRef = useRef<string[]>([]);

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
    validate(srlCode);
  }, [srlCode, validate]);

  const handleSelectExample = useCallback((example: Example) => {
    setSrlCode(example.srlCode);
    if (example.rdfData) {
      setRdfData(example.rdfData);
    }
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
    execute(srlCode, rdfData);
  }, [srlCode, rdfData, execute]);

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

    if (range) {
      editor.deltaDecorations([], [
        {
          range: new monaco.Range(range.startLine, range.startColumn, range.endLine, range.endColumn),
          options: {
            className: 'syntax-highlight-hover',
            isWholeLine: false,
          },
        },
      ]);
    }
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
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-zinc-950' : 'bg-zinc-100'}`}>
      {/* Header */}
      <header
        className={`h-12 px-4 flex items-center justify-between border-b shrink-0 ${
          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <h1
            className={`text-base font-semibold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}
          >
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
                ? theme === 'dark' ? 'bg-zinc-700 text-zinc-400 cursor-wait' : 'bg-zinc-200 text-zinc-500 cursor-wait'
                : !result?.isValid
                ? theme === 'dark' ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : theme === 'dark' 
                  ? 'bg-green-600 hover:bg-green-500 text-white' 
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
            className={`p-2 rounded-lg transition-colors ${
              showDiagramPanel
                ? theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                : theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
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
            className={`p-2 rounded-lg transition-colors ${
              showSyntaxPanel
                ? theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                : theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
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
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
            }`}
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
            className={`text-xs px-2 py-1 rounded transition-colors ${
              theme === 'dark'
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
            }`}
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
        />

        {/* Editor area */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            {/* Main editors section */}
            <Panel defaultSize={75} minSize={40}>
              <ResizablePanels
                theme={theme}
                leftTitle="Data Graph (Turtle)"
                rightTitle="Rules (SRL)"
                bottomTitle={showDiagramPanel ? "Syntax Diagrams" : "Syntax Analysis"}
                defaultLeftSize={40}
                defaultBottomSize={28}
                showBottom={showSyntaxPanel || showDiagramPanel}
                leftPanel={
                  <RDFEditor value={rdfData} onChange={setRdfData} theme={theme} />
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

            <ResizeHandle direction="horizontal" theme={theme} />

            {/* Right panel with tabs for Validation and Inferred Triples */}
            <Panel defaultSize={25} minSize={15} maxSize={50}>
              <div className={`h-full flex flex-col ${
                theme === 'dark' ? 'bg-zinc-900 border-l border-zinc-800' : 'bg-white border-l border-zinc-200'
              }`}>
                {/* Tab headers */}
                <div className={`shrink-0 flex border-b ${
                  theme === 'dark' ? 'border-zinc-700/50 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
                }`}>
                  <button
                    onClick={() => setActiveRightTab('validation')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                      activeRightTab === 'validation'
                        ? theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                        : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'
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
                    onClick={() => setActiveRightTab('inferred')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                      activeRightTab === 'inferred'
                        ? theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                        : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'
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
                <div className="flex-1 overflow-hidden">
                  {activeRightTab === 'validation' ? (
                    <ValidationPanel result={result} isValidating={isValidating} theme={theme} />
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
        </div>
      </div>

      {/* Status bar */}
      <footer
        className={`h-6 px-4 flex items-center justify-between text-[11px] border-t shrink-0 ${
          theme === 'dark'
            ? 'bg-zinc-900 border-zinc-800 text-zinc-500'
            : 'bg-white border-zinc-200 text-zinc-500'
        }`}
      >
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
          <span className={theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}>|</span>
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
