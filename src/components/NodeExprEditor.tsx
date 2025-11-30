'use client';

import { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  registerShnexTurtleLanguage,
  SHNEX_TURTLE_LANGUAGE_ID,
} from '@/lib/monaco/shnex-turtle-language';

interface NodeExprEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: 'light' | 'dark';
  onEditorReady?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void;
}

export function NodeExprEditor({
  value,
  onChange,
  theme,
  onEditorReady,
}: NodeExprEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Register the SHNEX-Turtle language
      registerShnexTurtleLanguage(monaco);

      // Set the language for this editor
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, SHNEX_TURTLE_LANGUAGE_ID);
      }

      // Set the appropriate theme
      monaco.editor.setTheme(theme === 'dark' ? 'shnex-turtle-dark' : 'shnex-turtle-light');

      // Notify parent
      onEditorReady?.(editor, monaco);
    },
    [theme, onEditorReady]
  );

  // Update theme when it changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(
        theme === 'dark' ? 'shnex-turtle-dark' : 'shnex-turtle-light'
      );
    }
  }, [theme]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue || '');
    },
    [onChange]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="turtle"
        language={SHNEX_TURTLE_LANGUAGE_ID}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          lineNumbers: 'on',
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          renderLineHighlight: 'line',
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 8, bottom: 8 },
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showProperties: true,
          },
        }}
      />
    </div>
  );
}

export default NodeExprEditor;
