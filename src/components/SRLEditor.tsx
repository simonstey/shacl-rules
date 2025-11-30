'use client';

import { useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { registerSRLLanguage, SRL_LANGUAGE_ID } from '@/lib/monaco';
import { ValidationMessage } from '@/lib/validation';
import { getGrammarRuleForContext } from '@/lib/monaco/useSyntaxDiagrams';

interface SRLEditorProps {
  value: string;
  onChange: (value: string) => void;
  validationMessages?: ValidationMessage[];
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  onEditorReady?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void;
  onGrammarRuleChange?: (ruleName: string | null) => void;
}

export function SRLEditor({
  value,
  onChange,
  validationMessages = [],
  theme = 'dark',
  readOnly = false,
  onEditorReady,
  onGrammarRuleChange,
}: SRLEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const lastRuleRef = useRef<string | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerSRLLanguage(monaco);
    editor.updateOptions({ theme: theme === 'dark' ? 'srl-dark' : 'srl-light' });
    onEditorReady?.(editor, monaco);

    if (onGrammarRuleChange) {
      editor.onDidChangeCursorPosition((e) => {
        const model = editor.getModel();
        if (!model) return;

        const lineContent = model.getLineContent(e.position.lineNumber);
        const ruleName = getGrammarRuleForContext(lineContent, e.position.column);

        if (ruleName !== lastRuleRef.current) {
          lastRuleRef.current = ruleName;
          onGrammarRuleChange(ruleName);
        }
      });
    }
  }, [theme, onEditorReady, onGrammarRuleChange]);

  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue !== undefined) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const monaco = monacoRef.current;
    const markers: editor.IMarkerData[] = validationMessages.map((msg) => ({
      severity:
        msg.type === 'error'
          ? monaco.MarkerSeverity.Error
          : msg.type === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      message: msg.message,
      startLineNumber: msg.startLine,
      startColumn: msg.startColumn,
      endLineNumber: msg.endLine,
      endColumn: msg.endColumn,
    }));

    monaco.editor.setModelMarkers(model, 'srl-validation', markers);
  }, [validationMessages]);

  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      editorRef.current.updateOptions({ theme: theme === 'dark' ? 'srl-dark' : 'srl-light' });
    }
  }, [theme]);

  return (
    <Editor
      height="100%"
      language={SRL_LANGUAGE_ID}
      value={value}
      onChange={handleChange}
      onMount={handleEditorMount}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: 'var(--font-geist-mono), monospace',
        lineNumbers: 'on',
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly,
        tabSize: 2,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
      }}
    />
  );
}
