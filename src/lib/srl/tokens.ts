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
export const Rule = createToken({ name: 'Rule', pattern: /RULE/i });
export const Where = createToken({ name: 'Where', pattern: /WHERE/i });
export const If = createToken({ name: 'If', pattern: /IF/i });
export const Then = createToken({ name: 'Then', pattern: /THEN/i });
export const Data = createToken({ name: 'Data', pattern: /DATA/i });
export const Prefix = createToken({ name: 'Prefix', pattern: /PREFIX/i });
export const Base = createToken({ name: 'Base', pattern: /BASE/i });
export const Filter = createToken({ name: 'Filter', pattern: /FILTER/i });
export const Bind = createToken({ name: 'Bind', pattern: /BIND/i });
export const As = createToken({ name: 'As', pattern: /AS/i });
export const Not = createToken({ name: 'Not', pattern: /NOT/i });
export const Transitive = createToken({ name: 'Transitive', pattern: /TRANSITIVE/i });
export const Symmetric = createToken({ name: 'Symmetric', pattern: /SYMMETRIC/i });
export const Inverse = createToken({ name: 'Inverse', pattern: /INVERSE/i });
export const Version = createToken({ name: 'Version', pattern: /VERSION/i });
export const Imports = createToken({ name: 'Imports', pattern: /IMPORTS/i });
export const Reflexive = createToken({ name: 'Reflexive', pattern: /REFLEXIVE/i });
export const In = createToken({ name: 'In', pattern: /IN/i });
export const Exists = createToken({ name: 'Exists', pattern: /EXISTS/i });

// RDF Type
export const RdfType = createToken({ name: 'RdfType', pattern: /a\b/ });

// Delimiters
export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ });
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });
export const LAngle = createToken({ name: 'LAngle', pattern: /<(?!<)/ });
export const RAngle = createToken({ name: 'RAngle', pattern: />(?!>)/ });
export const DoubleLeftAngle = createToken({ name: 'DoubleLeftAngle', pattern: /<</ });
export const DoubleRightAngle = createToken({ name: 'DoubleRightAngle', pattern: />>/ });

// Punctuation
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Colon = createToken({ name: 'Colon', pattern: /:(?!:)/ });
export const ColonMinus = createToken({ name: 'ColonMinus', pattern: /:-/ });
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

// Language Tag
export const LangTag = createToken({
  name: 'LangTag',
  pattern: /@[a-zA-Z]+(-[a-zA-Z0-9]+)*/,
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
export const True = createToken({ name: 'True', pattern: /true/i });
export const False = createToken({ name: 'False', pattern: /false/i });

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
  ColonMinus,
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
  Bind,
  As,
  Not,
  Transitive,
  Symmetric,
  Inverse,
  Reflexive,
  In,
  Exists,
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
  LAngle,
  RAngle,
  // Punctuation
  Dot,
  Comma,
  Semicolon,
  Colon,
  Caret,
  Pipe,
  // Operators
  Equals,
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
