'use client';

import { useCallback } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

interface RDFEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  language?: 'turtle' | 'json';
}

export function RDFEditor({
  value,
  onChange,
  theme = 'dark',
  readOnly = false,
  language = 'turtle',
}: RDFEditorProps) {
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    // Register Turtle language if not available
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'turtle')) {
      monaco.languages.register({ id: 'turtle' });
      monaco.languages.setMonarchTokensProvider('turtle', {
        defaultToken: 'invalid',
        tokenPostfix: '.ttl',
        ignoreCase: false,

        keywords: ['a', 'true', 'false'],

        tokenizer: {
          root: [
            { include: '@whitespace' },
            [/<[^<>"{}|^`\\\s]*>/, 'string.iri'],
            [/[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*/, 'type.prefixedName'],
            [/:[a-zA-Z_][a-zA-Z0-9_-]*/, 'type.localName'],
            [/_:[a-zA-Z0-9_-]+/, 'identifier.blankNode'],
            // Use [@] character class to match literal @ (avoids Monarch state reference)
            [/[@]prefix\b/, 'keyword.directive'],
            [/[@]base\b/, 'keyword.directive'],
            [/[@][a-zA-Z]+(-[a-zA-Z0-9]+)*/, 'tag.language'],
            [/\^\^/, 'operator'],
            [/[{}()\[\]]/, '@brackets'],
            [/[;,.]/, 'delimiter'],
            [/[+-]?[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?/, 'number.float'],
            [/[+-]?[0-9]+/, 'number.integer'],
            [/"""/, 'string.quote', '@stringLongDouble'],
            [/'''/, 'string.quote', '@stringLongSingle'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string.quote', '@stringDouble'],
            [/'/, 'string.quote', '@stringSingle'],
            [
              /[a-zA-Z_]\w*/,
              {
                cases: {
                  '@keywords': 'keyword',
                  '@default': 'identifier',
                },
              },
            ],
          ],
          whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/#.*$/, 'comment'],
          ],
          stringDouble: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"/, 'string.quote', '@pop'],
          ],
          stringSingle: [
            [/[^\\']+/, 'string'],
            [/\\./, 'string.escape'],
            [/'/, 'string.quote', '@pop'],
          ],
          stringLongDouble: [
            [/[^"\\]+/, 'string'],
            [/\\./, 'string.escape'],
            [/"""/, 'string.quote', '@pop'],
            [/"/, 'string'],
          ],
          stringLongSingle: [
            [/[^'\\]+/, 'string'],
            [/\\./, 'string.escape'],
            [/'''/, 'string.quote', '@pop'],
            [/'/, 'string'],
          ],
        },
      } as Monaco.languages.IMonarchLanguage);
    }
  }, []);

  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue !== undefined) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  return (
    <Editor
      height="100%"
      language={language === 'turtle' ? 'turtle' : 'json'}
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
      }}
    />
  );
}
