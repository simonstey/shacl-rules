/**
 * Monaco Editor language support for SHACL Node Expressions (shnex) in Turtle
 * Provides syntax highlighting overlay, hover documentation, and code completion
 */

import type * as MonacoEditor from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';

export const SHNEX_TURTLE_LANGUAGE_ID = 'shnex-turtle';

// SHNEX vocabulary terms for highlighting
const SHNEX_PREDICATES = [
  'pathValues',
  'focusNode',
  'nodes',
  'var',
  'exists',
  'if',
  'then',
  'else',
  'distinct',
  'intersection',
  'concat',
  'remove',
  'join',
  'filterShape',
  'limit',
  'offset',
  'orderBy',
  'descending',
  'flatMap',
  'findFirst',
  'matchAll',
  'count',
  'min',
  'max',
  'sum',
  'instancesOf',
  'nodesMatching',
  'arg',
  'empty',
];

const SHACL_PREDICATES = [
  'path',
  'targetClass',
  'targetNode',
  'targetSubjectsOf',
  'targetObjectsOf',
  'property',
  'node',
  'class',
  'datatype',
  'minCount',
  'maxCount',
  'minInclusive',
  'maxInclusive',
  'minExclusive',
  'maxExclusive',
  'minLength',
  'maxLength',
  'pattern',
  'in',
  'hasValue',
  'equals',
  'disjoint',
  'expression',
  'nodeByExpression',
  'inversePath',
  'alternativePath',
  'zeroOrMorePath',
  'oneOrMorePath',
  'zeroOrOnePath',
  'NodeShape',
  'PropertyShape',
];

export const shnexTurtleLanguageConfiguration: MonacoEditor.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['[', ']'],
    ['(', ')'],
    ['<', '>'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  folding: {
    markers: {
      start: /\[/,
      end: /\]/,
    },
  },
};

export const shnexTurtleMonarchTokensProvider: MonacoEditor.languages.IMonarchLanguage = {
  defaultToken: 'invalid',
  tokenPostfix: '.shnex-turtle',
  ignoreCase: false,

  keywords: ['a', 'true', 'false'],

  shnexPredicates: SHNEX_PREDICATES,
  shaclPredicates: SHACL_PREDICATES,

  operators: ['^^', '@'],

  symbols: /[=><!~?:&|+\-*\/\^%]+/,

  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      { include: '@whitespace' },

      // Directives
      [/@(prefix|base)\b/i, 'keyword.directive'],

      // IRI with angle brackets
      [/<[^<>"{}|^`\\\s]*>/, 'string.iri'],

      // SHNEX prefixed names (shnex:xxx)
      [
        /shnex:([a-zA-Z_][a-zA-Z0-9_]*)/,
        {
          cases: {
            '@shnexPredicates': 'keyword.shnex',
            '@default': 'type.shnexName',
          },
        },
      ],

      // SHACL prefixed names (sh:xxx)
      [
        /sh:([a-zA-Z_][a-zA-Z0-9_]*)/,
        {
          cases: {
            '@shaclPredicates': 'keyword.shacl',
            '@default': 'type.shaclName',
          },
        },
      ],

      // SPARQL function prefixed names (sparql:xxx)
      [/sparql:[a-zA-Z_][a-zA-Z0-9_]*/, 'predefined.function'],

      // RDF/RDFS/XSD prefixed names
      [/rdf:[a-zA-Z_][a-zA-Z0-9_]*/, 'type.rdf'],
      [/rdfs:[a-zA-Z_][a-zA-Z0-9_]*/, 'type.rdfs'],
      [/xsd:[a-zA-Z_][a-zA-Z0-9_]*/, 'type.xsd'],

      // Other prefixed names
      [/[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*/, 'type.prefixedName'],

      // Colon local name (empty prefix)
      [/:[a-zA-Z_][a-zA-Z0-9_-]*/, 'type.localName'],

      // Blank nodes
      [/_:[a-zA-Z0-9_-]+/, 'identifier.blankNode'],

      // Keywords
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword.constant',
            '@default': 'identifier',
          },
        },
      ],

      // Delimiters
      [/[\[\]()]/, '@brackets'],
      [/\^\^/, 'operator.datatype'],
      [/[;,.]/, 'delimiter'],

      [
        /@symbols/,
        {
          cases: {
            '@operators': 'operator',
            '@default': '',
          },
        },
      ],

      // Language tag
      [/@[a-zA-Z]+(-[a-zA-Z0-9]+)*/, 'tag.language'],

      // Numbers
      [/[+-]?[0-9]+\.[0-9]*[eE][+-]?[0-9]+/, 'number.float'],
      [/[+-]?\.[0-9]+[eE][+-]?[0-9]+/, 'number.float'],
      [/[+-]?[0-9]+[eE][+-]?[0-9]+/, 'number.float'],
      [/[+-]?[0-9]*\.[0-9]+/, 'number.decimal'],
      [/[+-]?[0-9]+/, 'number.integer'],

      // Strings
      [/"""/, 'string.quote', '@stringLongDouble'],
      [/'''/, 'string.quote', '@stringLongSingle'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/'([^'\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string.quote', '@stringDouble'],
      [/'/, 'string.quote', '@stringSingle'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/#.*$/, 'comment'],
    ],

    stringDouble: [
      [/[^\\"]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"/, 'string.quote', '@pop'],
    ],

    stringSingle: [
      [/[^\\']+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'/, 'string.quote', '@pop'],
    ],

    stringLongDouble: [
      [/[^"\\]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/"""/, 'string.quote', '@pop'],
      [/"/, 'string'],
    ],

    stringLongSingle: [
      [/[^'\\]+/, 'string'],
      [/@escapes/, 'string.escape'],
      [/\\./, 'string.escape.invalid'],
      [/'''/, 'string.quote', '@pop'],
      [/'/, 'string'],
    ],
  },
};

export const shnexTurtleDarkTheme: MonacoEditor.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // SHNEX-specific
    { token: 'keyword.shnex', foreground: 'C084FC', fontStyle: 'bold' },
    { token: 'type.shnexName', foreground: 'C084FC' },
    
    // SHACL-specific
    { token: 'keyword.shacl', foreground: '60A5FA', fontStyle: 'bold' },
    { token: 'type.shaclName', foreground: '60A5FA' },
    
    // SPARQL functions
    { token: 'predefined.function', foreground: 'FFD580', fontStyle: 'italic' },
    
    // RDF/RDFS/XSD
    { token: 'type.rdf', foreground: '6EE7B7' },
    { token: 'type.rdfs', foreground: '6EE7B7' },
    { token: 'type.xsd', foreground: '6EE7B7' },
    
    // Turtle basics
    { token: 'keyword.directive', foreground: 'D19AFF', fontStyle: 'bold' },
    { token: 'keyword.constant', foreground: '7DD3FC' },
    { token: 'string.iri', foreground: '5EEAD4' },
    { token: 'type.prefixedName', foreground: '2DD4BF' },
    { token: 'type.localName', foreground: '2DD4BF' },
    { token: 'identifier.blankNode', foreground: 'FCD34D' },
    { token: 'tag.language', foreground: '9CA3AF' },
    { token: 'string', foreground: 'FCA5A5' },
    { token: 'string.quote', foreground: 'FCA5A5' },
    { token: 'string.escape', foreground: 'FDBA74' },
    { token: 'number', foreground: '86EFAC' },
    { token: 'number.integer', foreground: '86EFAC' },
    { token: 'number.decimal', foreground: '86EFAC' },
    { token: 'number.float', foreground: '86EFAC' },
    { token: 'operator', foreground: 'E5E7EB' },
    { token: 'operator.datatype', foreground: 'E5E7EB' },
    { token: 'delimiter', foreground: 'A1A1AA' },
    { token: 'comment', foreground: '6EE7B7', fontStyle: 'italic' },
    { token: 'identifier', foreground: 'D4D4D8' },
    { token: 'invalid', foreground: 'F87171', background: '7F1D1D' },
  ],
  colors: {
    'editor.background': '#18181B',
    'editor.foreground': '#E4E4E7',
    'editor.lineHighlightBackground': '#27272A',
    'editor.selectionBackground': '#8B5CF640',
    'editor.inactiveSelectionBackground': '#8B5CF620',
    'editorCursor.foreground': '#C084FC',
    'editorWhitespace.foreground': '#3F3F46',
    'editorIndentGuide.background': '#27272A',
    'editorIndentGuide.activeBackground': '#3F3F46',
    'editorLineNumber.foreground': '#52525B',
    'editorLineNumber.activeForeground': '#A1A1AA',
    'editorBracketMatch.background': '#C084FC40',
    'editorBracketMatch.border': '#C084FC',
  },
};

export const shnexTurtleLightTheme: MonacoEditor.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    // SHNEX-specific
    { token: 'keyword.shnex', foreground: '9333EA', fontStyle: 'bold' },
    { token: 'type.shnexName', foreground: '9333EA' },
    
    // SHACL-specific
    { token: 'keyword.shacl', foreground: '2563EB', fontStyle: 'bold' },
    { token: 'type.shaclName', foreground: '2563EB' },
    
    // SPARQL functions
    { token: 'predefined.function', foreground: 'B45309', fontStyle: 'italic' },
    
    // RDF/RDFS/XSD
    { token: 'type.rdf', foreground: '059669' },
    { token: 'type.rdfs', foreground: '059669' },
    { token: 'type.xsd', foreground: '059669' },
    
    // Turtle basics
    { token: 'keyword.directive', foreground: '7C3AED', fontStyle: 'bold' },
    { token: 'keyword.constant', foreground: '2563EB' },
    { token: 'string.iri', foreground: '0D9488' },
    { token: 'type.prefixedName', foreground: '0F766E' },
    { token: 'type.localName', foreground: '0F766E' },
    { token: 'identifier.blankNode', foreground: 'D97706' },
    { token: 'tag.language', foreground: '6B7280' },
    { token: 'string', foreground: 'BE123C' },
    { token: 'string.quote', foreground: 'BE123C' },
    { token: 'string.escape', foreground: 'EA580C' },
    { token: 'number', foreground: '059669' },
    { token: 'number.integer', foreground: '059669' },
    { token: 'number.decimal', foreground: '059669' },
    { token: 'number.float', foreground: '059669' },
    { token: 'operator', foreground: '374151' },
    { token: 'operator.datatype', foreground: '374151' },
    { token: 'delimiter', foreground: '6B7280' },
    { token: 'comment', foreground: '16A34A', fontStyle: 'italic' },
    { token: 'identifier', foreground: '374151' },
    { token: 'invalid', foreground: 'DC2626', background: 'FEE2E2' },
  ],
  colors: {
    'editor.background': '#FAFAFA',
    'editor.foreground': '#18181B',
    'editor.lineHighlightBackground': '#F4F4F5',
    'editor.selectionBackground': '#9333EA30',
    'editor.inactiveSelectionBackground': '#9333EA15',
    'editorCursor.foreground': '#9333EA',
    'editorWhitespace.foreground': '#E4E4E7',
    'editorIndentGuide.background': '#E4E4E7',
    'editorIndentGuide.activeBackground': '#D4D4D8',
    'editorLineNumber.foreground': '#A1A1AA',
    'editorLineNumber.activeForeground': '#52525B',
    'editorBracketMatch.background': '#9333EA30',
    'editorBracketMatch.border': '#9333EA',
  },
};

// Documentation for SHNEX predicates
const shnexDocumentation: Record<string, { title: string; description: string; syntax?: string }> = {
  pathValues: {
    title: 'Path Values Expression',
    description: 'Evaluates a property path from the focus node or specified starting node.',
    syntax: '[ shnex:pathValues <path> ]',
  },
  focusNode: {
    title: 'Focus Node Override',
    description: 'Specifies an alternative starting node for path traversal.',
    syntax: '[ shnex:pathValues <path> ; shnex:focusNode <expr> ]',
  },
  nodes: {
    title: 'Input Nodes',
    description: 'Specifies the input node sequence for list and sequence operators.',
    syntax: '[ shnex:distinct [ shnex:nodes <expr> ] ]',
  },
  var: {
    title: 'Variable Expression',
    description: 'Returns the value of a scope variable (e.g., "focusNode", "value").',
    syntax: '[ shnex:var "focusNode" ]',
  },
  exists: {
    title: 'Exists Expression',
    description: 'Returns true if the nested expression produces at least one node.',
    syntax: '[ shnex:exists <expr> ]',
  },
  if: {
    title: 'If Condition',
    description: 'Conditional expression with lazy evaluation of branches.',
    syntax: '[ shnex:if <cond> ; shnex:then <expr1> ; shnex:else <expr2> ]',
  },
  then: {
    title: 'Then Branch',
    description: 'Expression to evaluate if the condition is true.',
  },
  else: {
    title: 'Else Branch',
    description: 'Expression to evaluate if the condition is false.',
  },
  distinct: {
    title: 'Distinct Expression',
    description: 'Removes duplicate nodes (term equality).',
    syntax: '[ shnex:distinct <expr> ]',
  },
  intersection: {
    title: 'Intersection Expression',
    description: 'Returns nodes that appear in all listed expressions.',
    syntax: '[ shnex:intersection ( <expr1> <expr2> ... ) ]',
  },
  concat: {
    title: 'Concat Expression',
    description: 'Concatenates sequences preserving order (may have duplicates).',
    syntax: '[ shnex:concat ( <expr1> <expr2> ... ) ]',
  },
  remove: {
    title: 'Remove Expression',
    description: 'Removes all occurrences of nodes from the sequence.',
    syntax: '[ shnex:nodes <input> ; shnex:remove <toRemove> ]',
  },
  join: {
    title: 'Join Expression',
    description: 'Set union - returns nodes appearing in any listed expression (no duplicates).',
    syntax: '[ shnex:join ( <expr1> <expr2> ... ) ]',
  },
  filterShape: {
    title: 'Filter Shape Expression',
    description: 'Keeps only nodes that conform to the specified shape.',
    syntax: '[ shnex:nodes <expr> ; shnex:filterShape <shape> ]',
  },
  limit: {
    title: 'Limit Expression',
    description: 'Takes only the first N nodes from the sequence.',
    syntax: '[ shnex:nodes <expr> ; shnex:limit 10 ]',
  },
  offset: {
    title: 'Offset Expression',
    description: 'Skips the first N nodes from the sequence.',
    syntax: '[ shnex:nodes <expr> ; shnex:offset 5 ]',
  },
  orderBy: {
    title: 'Order By Expression',
    description: 'Sorts nodes by property values.',
    syntax: '[ shnex:nodes <expr> ; shnex:orderBy <path> ]',
  },
  descending: {
    title: 'Descending Order',
    description: 'Sort in descending order (default is ascending).',
    syntax: '[ shnex:nodes <expr> ; shnex:orderBy <path> ; shnex:descending true ]',
  },
  flatMap: {
    title: 'FlatMap Expression',
    description: 'Applies expression to each input node with changed focus node, flattens results.',
    syntax: '[ shnex:nodes <input> ; shnex:flatMap <expr> ]',
  },
  findFirst: {
    title: 'Find First Expression',
    description: 'Returns the first node conforming to the shape, or empty.',
    syntax: '[ shnex:nodes <expr> ; shnex:findFirst <shape> ]',
  },
  matchAll: {
    title: 'Match All Expression',
    description: 'Returns true if all nodes conform to the shape.',
    syntax: '[ shnex:nodes <expr> ; shnex:matchAll <shape> ]',
  },
  count: {
    title: 'Count Expression',
    description: 'Returns the count of nodes as xsd:integer.',
    syntax: '[ shnex:count <expr> ]',
  },
  min: {
    title: 'Min Expression',
    description: 'Returns the minimum value (per SPARQL MIN semantics).',
    syntax: '[ shnex:min <expr> ]',
  },
  max: {
    title: 'Max Expression',
    description: 'Returns the maximum value (per SPARQL MAX semantics).',
    syntax: '[ shnex:max <expr> ]',
  },
  sum: {
    title: 'Sum Expression',
    description: 'Returns the sum of values (per SPARQL SUM semantics).',
    syntax: '[ shnex:sum <expr> ]',
  },
  instancesOf: {
    title: 'Instances Of Expression',
    description: 'Returns all SHACL instances of the class (includes subclasses).',
    syntax: '[ shnex:instancesOf <class> ]',
  },
  nodesMatching: {
    title: 'Nodes Matching Expression',
    description: 'Returns all nodes in the graph conforming to the shape.',
    syntax: '[ shnex:nodesMatching <shape> ]',
  },
  arg: {
    title: 'Arg Expression',
    description: 'Accesses an argument by key (IRI or integer index) in custom functions.',
    syntax: '[ shnex:arg 1 ] or [ shnex:arg ex:paramName ]',
  },
  empty: {
    title: 'Empty Expression',
    description: 'Returns an empty sequence [].',
    syntax: 'shnex:empty',
  },
};

export function registerShnexTurtleLanguage(monaco: Monaco) {
  // Register the language
  monaco.languages.register({ id: SHNEX_TURTLE_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(
    SHNEX_TURTLE_LANGUAGE_ID,
    shnexTurtleLanguageConfiguration
  );
  monaco.languages.setMonarchTokensProvider(
    SHNEX_TURTLE_LANGUAGE_ID,
    shnexTurtleMonarchTokensProvider
  );

  // Register themes
  monaco.editor.defineTheme('shnex-turtle-dark', shnexTurtleDarkTheme);
  monaco.editor.defineTheme('shnex-turtle-light', shnexTurtleLightTheme);

  // Register hover provider
  monaco.languages.registerHoverProvider(SHNEX_TURTLE_LANGUAGE_ID, {
    provideHover: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position
    ) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const lineContent = model.getLineContent(position.lineNumber);
      const wordStart = word.startColumn - 1;
      const textBefore = lineContent.substring(Math.max(0, wordStart - 10), wordStart);
      const text = word.word;

      // Check for shnex: prefix
      if (textBefore.endsWith('shnex:')) {
        const doc = shnexDocumentation[text];
        if (doc) {
          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn - 6,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**${doc.title}**` },
              { value: doc.description },
              ...(doc.syntax ? [{ value: `\`\`\`turtle\n${doc.syntax}\n\`\`\`` }] : []),
            ],
          };
        }
      }

      return null;
    },
  });

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(SHNEX_TURTLE_LANGUAGE_ID, {
    triggerCharacters: [':'],
    provideCompletionItems: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position
    ) => {
      const word = model.getWordUntilPosition(position);
      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, word.startColumn - 1);

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: MonacoEditor.languages.CompletionItem[] = [];

      // SHNEX completions
      if (textBefore.endsWith('shnex:')) {
        for (const [predicate, doc] of Object.entries(shnexDocumentation)) {
          suggestions.push({
            label: predicate,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: predicate,
            documentation: doc.description,
            range,
          });
        }
      }

      // SHACL completions
      if (textBefore.endsWith('sh:')) {
        for (const pred of SHACL_PREDICATES) {
          suggestions.push({
            label: pred,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText: pred,
            range,
          });
        }
      }

      // Prefix suggestions
      if (word.word === '' || textBefore.match(/\s$/)) {
        suggestions.push(
          {
            label: 'shnex:',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'shnex:',
            documentation: 'SHACL Node Expressions vocabulary',
            range,
          },
          {
            label: 'sh:',
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: 'sh:',
            documentation: 'SHACL vocabulary',
            range,
          }
        );
      }

      // Snippet templates
      if (word.word === '' || word.word.toLowerCase().startsWith('@')) {
        suggestions.push(
          {
            label: '@prefix shnex',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'SHNEX prefix declaration',
            range,
          },
          {
            label: '@prefix sh',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '@prefix sh: <http://www.w3.org/ns/shacl#> .',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'SHACL prefix declaration',
            range,
          }
        );
      }

      // Expression templates
      suggestions.push(
        {
          label: 'pathValues expression',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '[ shnex:pathValues ${1:ex:property} ]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a pathValues expression',
          range,
        },
        {
          label: 'count expression',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '[ shnex:count [ shnex:pathValues ${1:ex:property} ] ]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Count nodes matching a path',
          range,
        },
        {
          label: 'flatMap expression',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            '[ shnex:nodes [ shnex:pathValues ${1:ex:items} ] ;\n  shnex:flatMap [ shnex:pathValues ${2:ex:property} ] ]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'FlatMap over items to collect nested properties',
          range,
        },
        {
          label: 'if-then-else expression',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            '[ shnex:if [ shnex:exists [ shnex:pathValues ${1:ex:condition} ] ] ;\n  shnex:then ${2:ex:trueValue} ;\n  shnex:else ${3:ex:falseValue} ]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Conditional expression',
          range,
        }
      );

      return { suggestions };
    },
  });
}
