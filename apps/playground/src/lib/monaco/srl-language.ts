import type * as MonacoEditor from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
export const SRL_LANGUAGE_ID = "srl";

export const srlLanguageConfiguration: MonacoEditor.languages.LanguageConfiguration =
  {
    comments: {
      lineComment: "#",
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
      ["<", ">"],
      ["<<", ">>"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: "<<", close: ">>" },
      { open: '"', close: '"', notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string"] },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "<", close: ">" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /\{/,
        end: /\}/,
      },
    },
  };

export const srlMonarchTokensProvider: MonacoEditor.languages.IMonarchLanguage =
  {
    defaultToken: "invalid",
    tokenPostfix: ".srl",
    ignoreCase: true,

    keywords: [
      "RULE",
      "WHERE",
      "IF",
      "THEN",
      "DATA",
      "PREFIX",
      "BASE",
      "FILTER",
      "NOT",
      "SET",
      "IN",
      "FOR",
      "TRANSITIVE",
      "SYMMETRIC",
      "INVERSE",
      "VERSION",
      "IMPORTS",
    ],

    // The complete SHACL 1.2 Rules built-in function set (grammar [121]).
    builtinFunctions: [
      "STR",
      "LANG",
      "LANGMATCHES",
      "LANGDIR",
      "DATATYPE",
      "IRI",
      "URI",
      "BNODE",
      "ABS",
      "CEIL",
      "FLOOR",
      "ROUND",
      "CONCAT",
      "SUBSTR",
      "STRLEN",
      "REPLACE",
      "UCASE",
      "LCASE",
      "ENCODE_FOR_URI",
      "CONTAINS",
      "STRSTARTS",
      "STRENDS",
      "STRBEFORE",
      "STRAFTER",
      "YEAR",
      "MONTH",
      "DAY",
      "HOURS",
      "MINUTES",
      "SECONDS",
      "TIMEZONE",
      "TZ",
      "NOW",
      "UUID",
      "STRUUID",
      "IF",
      "STRLANG",
      "STRLANGDIR",
      "STRDT",
      "SAMETERM",
      "ISIRI",
      "ISURI",
      "ISBLANK",
      "ISLITERAL",
      "ISNUMERIC",
      "HASLANG",
      "HASLANGDIR",
      "REGEX",
      "ISTRIPLE",
      "TRIPLE",
      "SUBJECT",
      "PREDICATE",
      "OBJECT",
    ],

    typeKeywords: ["true", "false", "a"],

    operators: [
      "=",
      "!=",
      "<",
      ">",
      "<=",
      ">=",
      "+",
      "-",
      "*",
      "/",
      "&&",
      "||",
      "!",
      "^^",
      ":=",
    ],

    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    escapes:
      /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    tokenizer: {
      root: [
        { include: "@whitespace" },

        // Reified triple markers
        [/<</, "delimiter.reified"],
        [/>>/, "delimiter.reified"],

        // IRI with angle brackets
        [/<[^<>"{}|^`\\\s]*>/, "string.iri"],

        // Prefixed names with colon
        [
          /[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*/,
          "type.prefixedName",
        ],

        // Colon local name
        [/:[a-zA-Z_][a-zA-Z0-9_-]*/, "type.localName"],

        // Blank nodes
        [/_:[a-zA-Z0-9_-]+/, "identifier.blankNode"],

        // Variables
        [/\?[a-zA-Z_][a-zA-Z0-9_]*/, "variable.question"],
        [/\$[a-zA-Z_][a-zA-Z0-9_]*/, "variable.dollar"],

        // Language tag
        [/@[a-zA-Z]+(-[a-zA-Z0-9]+)*/, "tag.language"],

        // Keywords and identifiers
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@builtinFunctions": "predefined.function",
              "@typeKeywords": "keyword.constant",
              "@default": "identifier",
            },
          },
        ],

        // Delimiters and operators
        [/[{}()\[\]]/, "@brackets"],
        [/:=/, "operator.assign"],
        [/\^\^/, "operator.datatype"],
        [/[;,.]/, "delimiter"],

        [
          /@symbols/,
          {
            cases: {
              "@operators": "operator",
              "@default": "",
            },
          },
        ],

        // Numbers
        [/[+-]?[0-9]+\.[0-9]*[eE][+-]?[0-9]+/, "number.float"],
        [/[+-]?\.[0-9]+[eE][+-]?[0-9]+/, "number.float"],
        [/[+-]?[0-9]+[eE][+-]?[0-9]+/, "number.float"],
        [/[+-]?[0-9]*\.[0-9]+/, "number.decimal"],
        [/[+-]?[0-9]+/, "number.integer"],

        // Strings
        [/"""/, "string.quote", "@stringLongDouble"],
        [/'''/, "string.quote", "@stringLongSingle"],
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string.quote", "@stringDouble"],
        [/'/, "string.quote", "@stringSingle"],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/#.*$/, "comment"],
      ],

      stringDouble: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string.quote", "@pop"],
      ],

      stringSingle: [
        [/[^\\']+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/'/, "string.quote", "@pop"],
      ],

      stringLongDouble: [
        [/[^"\\]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"""/, "string.quote", "@pop"],
        [/"/, "string"],
      ],

      stringLongSingle: [
        [/[^'\\]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/'''/, "string.quote", "@pop"],
        [/'/, "string"],
      ],
    },
  };

export const srlTheme: MonacoEditor.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    // Keywords - vibrant purple/magenta
    { token: "keyword", foreground: "D19AFF", fontStyle: "bold" },
    { token: "keyword.constant", foreground: "7DD3FC" },

    // Functions - warm yellow
    { token: "predefined.function", foreground: "FFD580", fontStyle: "italic" },

    // Variables - bright sky blue
    { token: "variable.question", foreground: "67E8F9" },
    { token: "variable.dollar", foreground: "67E8F9" },

    // IRIs and prefixed names - teal/cyan
    { token: "string.iri", foreground: "5EEAD4" },
    { token: "type.prefixedName", foreground: "2DD4BF" },
    { token: "type.localName", foreground: "2DD4BF" },

    // Blank nodes - golden
    { token: "identifier.blankNode", foreground: "FCD34D" },

    // Language tags - muted gray
    { token: "tag.language", foreground: "9CA3AF" },

    // Strings - coral/salmon
    { token: "string", foreground: "FCA5A5" },
    { token: "string.quote", foreground: "FCA5A5" },
    { token: "string.escape", foreground: "FDBA74" },

    // Numbers - soft green
    { token: "number", foreground: "86EFAC" },
    { token: "number.integer", foreground: "86EFAC" },
    { token: "number.decimal", foreground: "86EFAC" },
    { token: "number.float", foreground: "86EFAC" },

    // Operators - bright white
    { token: "operator", foreground: "E5E7EB" },
    { token: "operator.assign", foreground: "D19AFF", fontStyle: "bold" },
    { token: "operator.datatype", foreground: "E5E7EB" },

    // Delimiters - subtle gray
    { token: "delimiter", foreground: "A1A1AA" },
    { token: "delimiter.reified", foreground: "C084FC" },

    // Comments - muted green
    { token: "comment", foreground: "6EE7B7", fontStyle: "italic" },

    // Identifiers
    { token: "identifier", foreground: "D4D4D8" },

    // Invalid
    { token: "invalid", foreground: "F87171", background: "7F1D1D" },
  ],
  colors: {
    "editor.background": "#18181B",
    "editor.foreground": "#E4E4E7",
    "editor.lineHighlightBackground": "#27272A",
    "editor.selectionBackground": "#3B82F640",
    "editor.inactiveSelectionBackground": "#3B82F620",
    "editorCursor.foreground": "#60A5FA",
    "editorWhitespace.foreground": "#3F3F46",
    "editorIndentGuide.background": "#27272A",
    "editorIndentGuide.activeBackground": "#3F3F46",
    "editorLineNumber.foreground": "#52525B",
    "editorLineNumber.activeForeground": "#A1A1AA",
    "editorBracketMatch.background": "#8B5CF640",
    "editorBracketMatch.border": "#8B5CF6",
  },
};

export const srlLightTheme: MonacoEditor.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    // Keywords - deep purple
    { token: "keyword", foreground: "7C3AED", fontStyle: "bold" },
    { token: "keyword.constant", foreground: "2563EB" },

    // Functions - warm brown
    { token: "predefined.function", foreground: "B45309", fontStyle: "italic" },

    // Variables - deep blue
    { token: "variable.question", foreground: "0369A1" },
    { token: "variable.dollar", foreground: "0369A1" },

    // IRIs and prefixed names - teal
    { token: "string.iri", foreground: "0D9488" },
    { token: "type.prefixedName", foreground: "0F766E" },
    { token: "type.localName", foreground: "0F766E" },

    // Blank nodes - amber
    { token: "identifier.blankNode", foreground: "D97706" },

    // Language tags
    { token: "tag.language", foreground: "6B7280" },

    // Strings - rose red
    { token: "string", foreground: "BE123C" },
    { token: "string.quote", foreground: "BE123C" },
    { token: "string.escape", foreground: "EA580C" },

    // Numbers - emerald green
    { token: "number", foreground: "059669" },
    { token: "number.integer", foreground: "059669" },
    { token: "number.decimal", foreground: "059669" },
    { token: "number.float", foreground: "059669" },

    // Operators
    { token: "operator", foreground: "374151" },
    { token: "operator.assign", foreground: "7C3AED", fontStyle: "bold" },
    { token: "operator.datatype", foreground: "374151" },

    // Delimiters
    { token: "delimiter", foreground: "6B7280" },
    { token: "delimiter.reified", foreground: "9333EA" },

    // Comments - forest green
    { token: "comment", foreground: "16A34A", fontStyle: "italic" },

    // Identifiers
    { token: "identifier", foreground: "374151" },

    // Invalid
    { token: "invalid", foreground: "DC2626", background: "FEE2E2" },
  ],
  colors: {
    "editor.background": "#FAFAFA",
    "editor.foreground": "#18181B",
    "editor.lineHighlightBackground": "#F4F4F5",
    "editor.selectionBackground": "#3B82F630",
    "editor.inactiveSelectionBackground": "#3B82F615",
    "editorCursor.foreground": "#2563EB",
    "editorWhitespace.foreground": "#E4E4E7",
    "editorIndentGuide.background": "#E4E4E7",
    "editorIndentGuide.activeBackground": "#D4D4D8",
    "editorLineNumber.foreground": "#A1A1AA",
    "editorLineNumber.activeForeground": "#52525B",
    "editorBracketMatch.background": "#8B5CF630",
    "editorBracketMatch.border": "#8B5CF6",
  },
};

/**
 * Registers the shared `srl-dark` / `srl-light` editor themes.
 *
 * Monaco's active theme is GLOBAL — a single theme applies to every editor
 * instance. Both the SRL and RDF editors must therefore use the same theme
 * names, or whichever editor renders last clobbers the other's colors. This is
 * idempotent (`defineTheme` overwrites) and safe to call from every editor.
 */
export function registerSRLThemes(monaco: Monaco) {
  monaco.editor.defineTheme("srl-dark", srlTheme);
  monaco.editor.defineTheme("srl-light", srlLightTheme);
}

export function registerSRLLanguage(monaco: Monaco) {
  monaco.languages.register({ id: SRL_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(
    SRL_LANGUAGE_ID,
    srlLanguageConfiguration
  );
  monaco.languages.setMonarchTokensProvider(
    SRL_LANGUAGE_ID,
    srlMonarchTokensProvider
  );
  registerSRLThemes(monaco);

  // Register hover provider
  monaco.languages.registerHoverProvider(SRL_LANGUAGE_ID, {
    provideHover: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position
    ) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const lineContent = model.getLineContent(position.lineNumber);
      const wordStart = word.startColumn - 1;
      const wordEnd = word.endColumn - 1;

      // Check what kind of token this is
      const textBefore = lineContent.substring(0, wordStart);
      const textAt = lineContent.substring(wordStart, wordEnd);
      const fullText = lineContent.substring(wordStart);

      // Variable hover
      if (textBefore.endsWith("?") || textBefore.endsWith("$")) {
        const varPrefix = textBefore.endsWith("?") ? "?" : "$";
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn - 1,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            { value: `**Variable** \`${varPrefix}${textAt}\`` },
            {
              value:
                "A query variable that binds to RDF terms during rule evaluation.",
            },
          ],
        };
      }

      // Prefixed name hover
      const prefixedNameMatch = fullText.match(
        /^([a-zA-Z_][a-zA-Z0-9_-]*):([a-zA-Z_][a-zA-Z0-9_-]*)/
      );
      if (prefixedNameMatch) {
        const [fullMatch, prefix, localName] = prefixedNameMatch;
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.startColumn + fullMatch.length
          ),
          contents: [
            { value: `**Prefixed Name** \`${fullMatch}\`` },
            {
              value: `**Prefix:** \`${prefix}:\`\n**Local name:** \`${localName}\``,
            },
            { value: "_Expand the prefix declaration to see the full IRI._" },
          ],
        };
      }

      // Local name with empty prefix
      if (textBefore.endsWith(":") && !textBefore.endsWith("::")) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn - 1,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            { value: `**Local Name** \`:${textAt}\`` },
            { value: "Uses the default (empty) prefix namespace." },
          ],
        };
      }

      // Keyword documentation
      const keywordDocs: Record<
        string,
        { title: string; description: string; syntax?: string }
      > = {
        RULE: {
          title: "Rule Declaration",
          description:
            "Declares a rule that derives new triples from matched patterns. An optional IRI right after RULE names the rule.",
          syntax: "RULE iri? { head-template } WHERE { body-pattern }",
        },
        WHERE: {
          title: "Where Clause",
          description: "Contains the patterns to match in the data graph.",
          syntax: "WHERE { triple-patterns }",
        },
        IF: {
          title: "If Condition",
          description:
            "Alternative rule syntax - if the body matches, derive the head.",
          syntax: "IF { body-pattern } THEN { head-pattern }",
        },
        THEN: {
          title: "Then Consequence",
          description: "The triples to derive when the IF condition matches.",
          syntax: "IF { ... } THEN { derived-triples }",
        },
        DATA: {
          title: "Data Block",
          description: "Inline RDF data in Turtle-like syntax.",
          syntax: "DATA { triples }",
        },
        PREFIX: {
          title: "Prefix Declaration",
          description: "Declares a namespace prefix for compact IRI notation.",
          syntax: "PREFIX prefix: <IRI>",
        },
        BASE: {
          title: "Base IRI",
          description: "Sets the base IRI for resolving relative IRIs.",
          syntax: "BASE <IRI>",
        },
        FILTER: {
          title: "Filter Expression",
          description: "Restricts solutions based on a boolean expression.",
          syntax: "FILTER(expression)",
        },
        SET: {
          title: "Variable Assignment",
          description:
            "Assigns the result of an expression to a new variable. An evaluation error drops the current solution.",
          syntax: "SET(?variable := expression)",
        },
        NOT: {
          title: "Negation",
          description:
            "Negation-as-failure: matches if the pattern does NOT exist. The body allows only triple patterns and FILTER.",
          syntax: "NOT { pattern }",
        },
        IN: {
          title: "Set Membership",
          description: "Tests if a value is in a list of values.",
          syntax: "?var IN (value1, value2, ...)",
        },
        FOR: {
          title: "Shape Targeting",
          description:
            "Targets a rule to a SHACL shape (opt-in extension). The rule fires once per focus node that conforms to the shape, with the focus variable pre-bound.",
          syntax: "RULE iri? FOR ?var IN <shape> { … } WHERE { … }",
        },
        TRANSITIVE: {
          title: "Transitive Property",
          description:
            "Declares a property as transitive (if A→B and B→C, then A→C).",
          syntax: "TRANSITIVE(property)",
        },
        SYMMETRIC: {
          title: "Symmetric Property",
          description:
            "Declares a property as symmetric (if A→B, then B→A). Note the postfix syntax: the IRI precedes the keyword.",
          syntax: "(property) SYMMETRIC",
        },
        INVERSE: {
          title: "Inverse Properties",
          description: "Declares two properties as inverses of each other.",
          syntax: "INVERSE(property1, property2)",
        },
      };

      const upperWord = textAt.toUpperCase();
      if (keywordDocs[upperWord]) {
        const doc = keywordDocs[upperWord];
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            { value: `**${doc.title}**` },
            { value: doc.description },
            ...(doc.syntax
              ? [{ value: `\`\`\`srl\n${doc.syntax}\n\`\`\`` }]
              : []),
          ],
        };
      }

      // Built-in function documentation (SHACL 1.2 Rules production [121])
      const functionDocs: Record<string, string> = {
        STR: "Converts a term to its lexical string form.",
        LANG: "Returns the language tag of a literal.",
        LANGMATCHES: "Tests if a language tag matches a pattern.",
        DATATYPE: "Returns the datatype IRI of a literal.",
        CONCAT: "Concatenates string arguments.",
        STRLEN: "Returns the length of a string.",
        UCASE: "Converts a string to uppercase.",
        LCASE: "Converts a string to lowercase.",
        CONTAINS: "Tests if a string contains a substring.",
        STRSTARTS: "Tests if a string starts with a prefix.",
        STRENDS: "Tests if a string ends with a suffix.",
        STRBEFORE: "Returns the substring before a match.",
        STRAFTER: "Returns the substring after a match.",
        SUBSTR: "Extracts a substring.",
        REPLACE: "Replaces occurrences of a pattern.",
        REGEX: "Tests if a string matches a regular expression.",
        ENCODE_FOR_URI: "Encodes a string for use in a URI.",
        IF: "Conditional expression: IF(cond, then, else).",
        SAMETERM: "Tests if two terms are the same RDF term.",
        ABS: "Returns the absolute value of a number.",
        CEIL: "Returns the ceiling of a number.",
        FLOOR: "Returns the floor of a number.",
        ROUND: "Rounds a number to the nearest integer.",
        NOW: "Returns the current dateTime (constant per rule-set evaluation).",
        YEAR: "Extracts the year from a dateTime.",
        MONTH: "Extracts the month from a dateTime.",
        DAY: "Extracts the day from a dateTime.",
        HOURS: "Extracts the hours from a dateTime.",
        MINUTES: "Extracts the minutes from a dateTime.",
        SECONDS: "Extracts the seconds from a dateTime.",
        TIMEZONE: "Extracts the timezone as a duration.",
        TZ: "Extracts the timezone as a string.",
        UUID: "Generates a fresh UUID IRI.",
        STRUUID: "Generates a fresh UUID as a string.",
        IRI: "Constructs an IRI from a string.",
        URI: "Constructs an IRI from a string (alias for IRI).",
        BNODE: "Constructs a blank node.",
        STRDT: "Constructs a typed literal.",
        STRLANG: "Constructs a language-tagged literal.",
        ISIRI: "Tests if a term is an IRI.",
        ISBLANK: "Tests if a term is a blank node.",
        ISLITERAL: "Tests if a term is a literal.",
        ISNUMERIC: "Tests if a term is a numeric value.",
      };

      if (functionDocs[upperWord]) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [
            { value: `**Function** \`${upperWord}()\`` },
            { value: functionDocs[upperWord] },
          ],
        };
      }

      return null;
    },
  });

  // Register completion provider
  monaco.languages.registerCompletionItemProvider(SRL_LANGUAGE_ID, {
    provideCompletionItems: (
      model: MonacoEditor.editor.ITextModel,
      position: MonacoEditor.Position
    ) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const keywords = [
        "RULE",
        "WHERE",
        "IF",
        "THEN",
        "DATA",
        "PREFIX",
        "BASE",
        "FILTER",
        "SET",
        "NOT",
        "IN",
        "FOR",
        "TRANSITIVE",
        "SYMMETRIC",
        "INVERSE",
        "VERSION",
        "IMPORTS",
      ];

      const functions = [
        "STR",
        "LANG",
        "LANGMATCHES",
        "LANGDIR",
        "DATATYPE",
        "CONCAT",
        "STRLEN",
        "UCASE",
        "LCASE",
        "CONTAINS",
        "STRSTARTS",
        "STRENDS",
        "STRBEFORE",
        "STRAFTER",
        "SUBSTR",
        "REPLACE",
        "REGEX",
        "ENCODE_FOR_URI",
        "IF",
        "SAMETERM",
        "ABS",
        "CEIL",
        "FLOOR",
        "ROUND",
        "NOW",
        "YEAR",
        "MONTH",
        "DAY",
        "HOURS",
        "MINUTES",
        "SECONDS",
        "TIMEZONE",
        "TZ",
        "UUID",
        "STRUUID",
        "IRI",
        "URI",
        "BNODE",
        "STRDT",
        "STRLANG",
        "STRLANGDIR",
        "ISIRI",
        "ISBLANK",
        "ISLITERAL",
        "ISNUMERIC",
        "HASLANG",
        "HASLANGDIR",
        "ISTRIPLE",
        "TRIPLE",
        "SUBJECT",
        "PREDICATE",
        "OBJECT",
      ];

      const suggestions: MonacoEditor.languages.CompletionItem[] = [
        ...keywords.map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        })),
        ...functions.map((fn) => ({
          label: fn,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${fn}($0)`,
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })),
        {
          label: "RULE template",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "RULE { ${1:?s} ${2:?p} ${3:?o} } WHERE {\n\t$0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Create a new RULE with WHERE clause",
          range,
        },
        {
          label: "IF-THEN template",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "IF {\n\t$1\n} THEN { ${2:?s} ${3:?p} ${4:?o} }",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Create a new IF-THEN rule",
          range,
        },
        {
          label: "PREFIX declaration",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "PREFIX ${1:prefix}: <${2:http://example.org/}>",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a namespace prefix",
          range,
        },
        {
          label: "DATA block",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "DATA {\n\t$0\n}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Create a DATA block for RDF triples",
          range,
        },
        {
          label: "SET assignment",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "SET(${1:?var} := ${2:expression})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Assign an expression result to a new variable",
          range,
        },
        {
          label: "NOT negation",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "NOT { ${0} }",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Negation pattern",
          range,
        },
        {
          label: "TRANSITIVE declaration",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "TRANSITIVE(${1:property})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a transitive property",
          range,
        },
        {
          label: "SYMMETRIC declaration",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "(${1:property}) SYMMETRIC",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare a symmetric property (postfix syntax)",
          range,
        },
        {
          label: "INVERSE declaration",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "INVERSE(${1:property1}, ${2:property2})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Declare inverse properties",
          range,
        },
        {
          label: "IN expression",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "${1:?var} IN (${2:value1}, ${3:value2})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Test if a value is in a list",
          range,
        },
        {
          label: "FOR ... IN shape (targeting)",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "FOR ?${1:this} IN ${2:ex:Shape}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Shape-targeting clause (opt-in extension)",
          range,
        },
        {
          label: "NOT IN expression",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "${1:?var} NOT IN (${2:value1}, ${3:value2})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Test if a value is not in a list",
          range,
        },
      ];

      return { suggestions };
    },
  });
}
