import { createToken, Lexer } from 'chevrotain';

// Whitespace and Comments (skipped)
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const Comment = createToken({
  name: 'Comment',
  pattern: /#[^\n\r]*/,
  group: Lexer.SKIPPED,
});

// Keywords
//
// `keyword(name, literal)` bakes in the case-insensitive flag and a trailing
// `(?![\w:-])` boundary lookahead, so a keyword only matches when it is NOT
// immediately followed by an identifier character, a prefixed-name separator, or
// a hyphen. Without the boundary a bare `/RULE/i` would mis-lex the prefix of an
// identifier or prefixed name (e.g. `SET` inside `SETTING`, `IN` inside
// `:inCoreDept`, `TRANSITIVE` as the prefix of `transitive:foo`). Keeping the
// lookahead in the factory means every keyword gets it by construction. (`RdfType`
// uses `\b` for the same reason.)
function keyword(name: string, literal: string) {
  return createToken({ name, pattern: new RegExp(`${literal}(?![\\w:-])`, 'i') });
}

export const Rule = keyword('Rule', 'RULE');
export const Where = keyword('Where', 'WHERE');
export const If = keyword('If', 'IF');
export const Then = keyword('Then', 'THEN');
export const Data = keyword('Data', 'DATA');
export const Prefix = keyword('Prefix', 'PREFIX');
export const Base = keyword('Base', 'BASE');
export const Filter = keyword('Filter', 'FILTER');
export const Not = keyword('Not', 'NOT');
export const Set = keyword('Set', 'SET');
export const Transitive = keyword('Transitive', 'TRANSITIVE');
export const Symmetric = keyword('Symmetric', 'SYMMETRIC');
export const Inverse = keyword('Inverse', 'INVERSE');
export const For = keyword('For', 'FOR');
export const Version = keyword('Version', 'VERSION');
export const Imports = keyword('Imports', 'IMPORTS');
export const In = keyword('In', 'IN');

// RDF Type
export const RdfType = createToken({ name: 'RdfType', pattern: /a\b/ });

// Delimiters
export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ });
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });
export const DoubleLeftAngle = createToken({ name: 'DoubleLeftAngle', pattern: /<</ });
export const DoubleRightAngle = createToken({ name: 'DoubleRightAngle', pattern: />>/ });

// Punctuation
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Assign = createToken({ name: 'Assign', pattern: /:=/ });
export const Colon = createToken({ name: 'Colon', pattern: /:(?!:)/ });
export const DoubleCaret = createToken({ name: 'DoubleCaret', pattern: /\^\^/ });
export const Caret = createToken({ name: 'Caret', pattern: /\^/ });
export const Pipe = createToken({ name: 'Pipe', pattern: /\|/ });

// Operators
export const Equals = createToken({ name: 'Equals', pattern: /=/ });
export const NotEquals = createToken({ name: 'NotEquals', pattern: /!=/ });
export const LessThan = createToken({ name: 'LessThan', pattern: /</ });
export const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ });
export const LessOrEqual = createToken({ name: 'LessOrEqual', pattern: /<=/ });
export const GreaterOrEqual = createToken({ name: 'GreaterOrEqual', pattern: />=/ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Asterisk = createToken({ name: 'Asterisk', pattern: /\*/ });
export const Slash = createToken({ name: 'Slash', pattern: /\// });
export const Percent = createToken({ name: 'Percent', pattern: /%/ });
export const Ampersand = createToken({ name: 'Ampersand', pattern: /&&/ });
export const DoublePipe = createToken({ name: 'DoublePipe', pattern: /\|\|/ });
export const Bang = createToken({ name: 'Bang', pattern: /!/ });
export const QuestionMark = createToken({ name: 'QuestionMark', pattern: /\?(?![a-zA-Z_])/ });

// Variables
export const QuestionVar = createToken({
  name: 'QuestionVar',
  pattern: /\?[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const DollarVar = createToken({
  name: 'DollarVar',
  pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/,
});

// IRI - Full IRI with angle brackets
export const IRI = createToken({
  name: 'IRI',
  pattern: /<[^<>"{}|^`\\\s]*>/,
});

// Prefixed Name
export const PrefixedName = createToken({
  name: 'PrefixedName',
  pattern: /[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*/,
});

// Empty prefix name (e.g., :localName)
export const ColonLocalName = createToken({
  name: 'ColonLocalName',
  pattern: /:[a-zA-Z_][a-zA-Z0-9_-]*/,
});

// Blank Node
export const BlankNode = createToken({
  name: 'BlankNode',
  pattern: /_:[a-zA-Z0-9_-]+/,
});

// Literals
export const StringLiteralQuote = createToken({
  name: 'StringLiteralQuote',
  pattern: /"([^"\\]|\\.)*"/,
});

export const StringLiteralSingleQuote = createToken({
  name: 'StringLiteralSingleQuote',
  pattern: /'([^'\\]|\\.)*'/,
});

export const StringLiteralLongQuote = createToken({
  name: 'StringLiteralLongQuote',
  pattern: /"""([^"\\]|\\.|"(?!""))*"""/,
});

export const StringLiteralLongSingleQuote = createToken({
  name: 'StringLiteralLongSingleQuote',
  pattern: /'''([^'\\]|\\.|'(?!''))*'''/,
});

// Language Tag (RDF 1.2 allows an optional base-direction suffix `--ltr`/`--rtl`,
// which must be lowercase). Ordered so the `--dir` suffix wins over a `-subtag`.
export const LangTag = createToken({
  name: 'LangTag',
  pattern: /@[a-zA-Z]+(--(ltr|rtl)|-[a-zA-Z0-9]+)*/,
});

// Numbers
export const Decimal = createToken({
  name: 'Decimal',
  pattern: /[+-]?[0-9]*\.[0-9]+/,
});

export const Double = createToken({
  name: 'Double',
  pattern: /[+-]?([0-9]+\.[0-9]*[eE][+-]?[0-9]+|\.[0-9]+[eE][+-]?[0-9]+|[0-9]+[eE][+-]?[0-9]+)/,
});

export const Integer = createToken({
  name: 'Integer',
  pattern: /[+-]?[0-9]+/,
});

// Boolean
export const True = keyword('True', 'true');
export const False = keyword('False', 'false');

// Identifier (for function names, etc.)
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// All tokens in order of priority
export const allTokens = [
  WhiteSpace,
  Comment,
  // Multi-char operators first
  DoubleLeftAngle,
  DoubleRightAngle,
  Assign,
  DoubleCaret,
  NotEquals,
  LessOrEqual,
  GreaterOrEqual,
  Ampersand,
  DoublePipe,
  // Keywords
  Rule,
  Where,
  If,
  Then,
  Data,
  Prefix,
  Base,
  Filter,
  Not,
  Set,
  Transitive,
  Symmetric,
  Inverse,
  For,
  In,
  Version,
  Imports,
  True,
  False,
  RdfType,
  // String literals (long before short)
  StringLiteralLongQuote,
  StringLiteralLongSingleQuote,
  StringLiteralQuote,
  StringLiteralSingleQuote,
  // Numbers (specific to general)
  Double,
  Decimal,
  Integer,
  // Variables
  QuestionVar,
  DollarVar,
  // IRI and names
  IRI,
  BlankNode,
  PrefixedName,
  ColonLocalName,
  LangTag,
  // Delimiters
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  // Punctuation
  Dot,
  Comma,
  Semicolon,
  Colon,
  Caret,
  // Operators — LessThan/GreaterThan must be lexable for comparison FILTERs
  // (full IRIs `<…>` are matched earlier, so a bare `<`/`>` is a comparison).
  Equals,
  LessThan,
  GreaterThan,
  Plus,
  Minus,
  Asterisk,
  Slash,
  Percent,
  Bang,
  QuestionMark,
  // Identifier last
  Identifier,
];

export const SRLLexer = new Lexer(allTokens);
