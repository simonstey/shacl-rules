'use client';

import { useMemo, useState, useCallback } from 'react';
import { parseSRL, ParseResult } from '@/lib/srl/parser';
import { IToken } from 'chevrotain';

interface SyntaxBreakdownProps {
  code: string;
  theme?: 'light' | 'dark';
  onTokenHover?: (range: { startLine: number; startColumn: number; endLine: number; endColumn: number } | null) => void;
  onTokenClick?: (range: { startLine: number; startColumn: number; endLine: number; endColumn: number }) => void;
}

interface TokenInfo {
  type: string;
  image: string;
  category: 'keyword' | 'variable' | 'iri' | 'literal' | 'operator' | 'delimiter' | 'identifier' | 'comment';
  description: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  startOffset: number;
  endOffset: number;
}

const TOKEN_CATEGORIES: Record<string, TokenInfo['category']> = {
  Rule: 'keyword',
  Where: 'keyword',
  If: 'keyword',
  Then: 'keyword',
  Data: 'keyword',
  Prefix: 'keyword',
  Base: 'keyword',
  Filter: 'keyword',
  Bind: 'keyword',
  As: 'keyword',
  Not: 'keyword',
  Transitive: 'keyword',
  Symmetric: 'keyword',
  Inverse: 'keyword',
  Version: 'keyword',
  Imports: 'keyword',
  True: 'keyword',
  False: 'keyword',
  RdfType: 'keyword',
  QuestionVar: 'variable',
  DollarVar: 'variable',
  IRI: 'iri',
  PrefixedName: 'iri',
  ColonLocalName: 'iri',
  BlankNode: 'identifier',
  StringLiteralQuote: 'literal',
  StringLiteralSingleQuote: 'literal',
  StringLiteralLongQuote: 'literal',
  StringLiteralLongSingleQuote: 'literal',
  LangTag: 'literal',
  Decimal: 'literal',
  Double: 'literal',
  Integer: 'literal',
  Equals: 'operator',
  NotEquals: 'operator',
  LessThan: 'operator',
  GreaterThan: 'operator',
  LessOrEqual: 'operator',
  GreaterOrEqual: 'operator',
  Plus: 'operator',
  Minus: 'operator',
  Asterisk: 'operator',
  Slash: 'operator',
  Percent: 'operator',
  Ampersand: 'operator',
  DoublePipe: 'operator',
  Bang: 'operator',
  ColonMinus: 'operator',
  DoubleCaret: 'operator',
  LBrace: 'delimiter',
  RBrace: 'delimiter',
  LParen: 'delimiter',
  RParen: 'delimiter',
  LBracket: 'delimiter',
  RBracket: 'delimiter',
  LAngle: 'delimiter',
  RAngle: 'delimiter',
  DoubleLeftAngle: 'delimiter',
  DoubleRightAngle: 'delimiter',
  Dot: 'delimiter',
  Comma: 'delimiter',
  Semicolon: 'delimiter',
  Colon: 'delimiter',
  Identifier: 'identifier',
};

const TOKEN_DESCRIPTIONS: Record<string, string> = {
  Rule: 'Rule declaration keyword',
  Where: 'Where clause keyword',
  If: 'If condition keyword',
  Then: 'Then consequence keyword',
  Data: 'Data block keyword',
  Prefix: 'Namespace prefix declaration',
  Base: 'Base IRI declaration',
  Filter: 'Filter expression',
  Bind: 'Variable binding',
  As: 'Alias keyword',
  Not: 'Negation keyword',
  Transitive: 'Transitive property declaration',
  Symmetric: 'Symmetric property declaration',
  Inverse: 'Inverse property declaration',
  Version: 'Version declaration',
  Imports: 'Import declaration',
  True: 'Boolean literal true',
  False: 'Boolean literal false',
  RdfType: 'RDF type shorthand (a)',
  QuestionVar: 'Query variable (?name)',
  DollarVar: 'Dollar variable ($name)',
  IRI: 'Full IRI reference',
  PrefixedName: 'Prefixed name (prefix:local)',
  ColonLocalName: 'Local name with empty prefix',
  BlankNode: 'Blank node identifier',
  StringLiteralQuote: 'String literal (double quotes)',
  StringLiteralSingleQuote: 'String literal (single quotes)',
  StringLiteralLongQuote: 'Long string literal (triple double quotes)',
  StringLiteralLongSingleQuote: 'Long string literal (triple single quotes)',
  LangTag: 'Language tag (@lang)',
  Decimal: 'Decimal number',
  Double: 'Double precision number',
  Integer: 'Integer number',
  Equals: 'Equality operator (=)',
  NotEquals: 'Inequality operator (!=)',
  LessThan: 'Less than operator (<)',
  GreaterThan: 'Greater than operator (>)',
  LessOrEqual: 'Less or equal operator (<=)',
  GreaterOrEqual: 'Greater or equal operator (>=)',
  Plus: 'Addition operator (+)',
  Minus: 'Subtraction operator (-)',
  Asterisk: 'Multiplication operator (*)',
  Slash: 'Division operator (/)',
  Percent: 'Modulo operator (%)',
  Ampersand: 'Logical AND (&&)',
  DoublePipe: 'Logical OR (||)',
  Bang: 'Logical NOT (!)',
  ColonMinus: 'Rule implication (:-)',
  DoubleCaret: 'Datatype operator (^^)',
  LBrace: 'Left brace ({)',
  RBrace: 'Right brace (})',
  LParen: 'Left parenthesis (()',
  RParen: 'Right parenthesis ())',
  LBracket: 'Left bracket ([)',
  RBracket: 'Right bracket (])',
  DoubleLeftAngle: 'Reified triple start (<<)',
  DoubleRightAngle: 'Reified triple end (>>)',
  Dot: 'Statement terminator (.)',
  Comma: 'List separator (,)',
  Semicolon: 'Predicate-object separator (;)',
  Colon: 'Namespace separator (:)',
  Identifier: 'Identifier or function name',
};

const CATEGORY_COLORS: Record<TokenInfo['category'], { dark: string; light: string; bg: string }> = {
  keyword: { dark: 'text-purple-400', light: 'text-purple-600', bg: 'bg-purple-500/10' },
  variable: { dark: 'text-sky-400', light: 'text-sky-600', bg: 'bg-sky-500/10' },
  iri: { dark: 'text-teal-400', light: 'text-teal-600', bg: 'bg-teal-500/10' },
  literal: { dark: 'text-orange-400', light: 'text-orange-600', bg: 'bg-orange-500/10' },
  operator: { dark: 'text-yellow-400', light: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  delimiter: { dark: 'text-zinc-400', light: 'text-zinc-600', bg: 'bg-zinc-500/10' },
  identifier: { dark: 'text-emerald-400', light: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  comment: { dark: 'text-green-500', light: 'text-green-600', bg: 'bg-green-500/10' },
};

function tokenToInfo(token: IToken): TokenInfo {
  const tokenType = token.tokenType?.name || 'Unknown';
  return {
    type: tokenType,
    image: token.image,
    category: TOKEN_CATEGORIES[tokenType] || 'identifier',
    description: TOKEN_DESCRIPTIONS[tokenType] || tokenType,
    startLine: token.startLine || 1,
    startColumn: token.startColumn || 1,
    endLine: token.endLine || token.startLine || 1,
    endColumn: token.endColumn || (token.startColumn || 1) + token.image.length,
    startOffset: token.startOffset,
    endOffset: token.endOffset || token.startOffset + token.image.length,
  };
}

interface ParsedStructure {
  prefixes: Array<{ prefix: string; iri: string; line: number }>;
  rules: Array<{ type: string; line: number; variables: string[] }>;
  dataBlocks: Array<{ line: number; tripleCount: number }>;
  declarations: Array<{ type: string; property: string; line: number }>;
}

function analyzeStructure(tokens: IToken[]): ParsedStructure {
  const structure: ParsedStructure = {
    prefixes: [],
    rules: [],
    dataBlocks: [],
    declarations: [],
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const tokenType = token.tokenType?.name;

    if (tokenType === 'Prefix' && i + 2 < tokens.length) {
      const nextToken = tokens[i + 1];
      let prefix = '';
      let iriToken: IToken | null = null;

      if (nextToken?.tokenType?.name === 'Identifier') {
        prefix = nextToken.image;
        if (tokens[i + 3]?.tokenType?.name === 'IRI') {
          iriToken = tokens[i + 3];
        }
      } else if (nextToken?.tokenType?.name === 'Colon' && tokens[i + 2]?.tokenType?.name === 'IRI') {
        iriToken = tokens[i + 2];
      }

      if (iriToken) {
        structure.prefixes.push({
          prefix: prefix || ':',
          iri: iriToken.image,
          line: token.startLine || 1,
        });
      }
    }

    if (tokenType === 'Rule' || tokenType === 'If') {
      const variables: string[] = [];
      let j = i + 1;
      while (j < tokens.length && j < i + 50) {
        const t = tokens[j];
        if (t.tokenType?.name === 'QuestionVar' || t.tokenType?.name === 'DollarVar') {
          if (!variables.includes(t.image)) {
            variables.push(t.image);
          }
        }
        j++;
      }
      structure.rules.push({
        type: tokenType === 'Rule' ? 'RULE...WHERE' : 'IF...THEN',
        line: token.startLine || 1,
        variables,
      });
    }

    if (tokenType === 'Data') {
      let braceCount = 0;
      let tripleCount = 0;
      let j = i + 1;
      while (j < tokens.length) {
        const t = tokens[j];
        if (t.tokenType?.name === 'LBrace') braceCount++;
        if (t.tokenType?.name === 'RBrace') {
          braceCount--;
          if (braceCount === 0) break;
        }
        if (t.tokenType?.name === 'Dot') tripleCount++;
        j++;
      }
      structure.dataBlocks.push({
        line: token.startLine || 1,
        tripleCount: tripleCount || 1,
      });
    }

    if (tokenType === 'Transitive' || tokenType === 'Symmetric' || tokenType === 'Inverse') {
      let property = '';
      let j = i + 1;
      while (j < tokens.length && j < i + 5) {
        const t = tokens[j];
        if (t.tokenType?.name === 'PrefixedName' || t.tokenType?.name === 'ColonLocalName' || t.tokenType?.name === 'IRI') {
          property = t.image;
          break;
        }
        j++;
      }
      structure.declarations.push({
        type: tokenType,
        property,
        line: token.startLine || 1,
      });
    }

    i++;
  }

  return structure;
}

export function SyntaxBreakdown({ 
  code, 
  theme = 'dark',
  onTokenHover,
  onTokenClick,
}: SyntaxBreakdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<TokenInfo['category'] | 'all'>('all');
  const [viewMode, setViewMode] = useState<'tokens' | 'structure'>('structure');
  const [hoveredToken, setHoveredToken] = useState<TokenInfo | null>(null);

  const parseResult = useMemo((): ParseResult & { tokenInfos: TokenInfo[]; structure: ParsedStructure } => {
    try {
      const result = parseSRL(code);
      const tokenInfos = result.tokens.map(tokenToInfo);
      const structure = analyzeStructure(result.tokens);
      return { ...result, tokenInfos, structure };
    } catch {
      return { 
        cst: null, 
        errors: [], 
        tokens: [], 
        tokenInfos: [],
        structure: { prefixes: [], rules: [], dataBlocks: [], declarations: [] }
      };
    }
  }, [code]);

  const filteredTokens = useMemo(() => {
    if (selectedCategory === 'all') return parseResult.tokenInfos;
    return parseResult.tokenInfos.filter(t => t.category === selectedCategory);
  }, [parseResult.tokenInfos, selectedCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: parseResult.tokenInfos.length };
    for (const token of parseResult.tokenInfos) {
      counts[token.category] = (counts[token.category] || 0) + 1;
    }
    return counts;
  }, [parseResult.tokenInfos]);

  const handleTokenMouseEnter = useCallback((token: TokenInfo) => {
    setHoveredToken(token);
    onTokenHover?.({
      startLine: token.startLine,
      startColumn: token.startColumn,
      endLine: token.endLine,
      endColumn: token.endColumn,
    });
  }, [onTokenHover]);

  const handleTokenMouseLeave = useCallback(() => {
    setHoveredToken(null);
    onTokenHover?.(null);
  }, [onTokenHover]);

  const handleTokenClick = useCallback((token: TokenInfo) => {
    onTokenClick?.({
      startLine: token.startLine,
      startColumn: token.startColumn,
      endLine: token.endLine,
      endColumn: token.endColumn,
    });
  }, [onTokenClick]);

  const bgColor = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700';
  const mutedColor = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const borderColor = theme === 'dark' ? 'border-zinc-700/50' : 'border-zinc-200';

  return (
    <div className={`h-full flex flex-col ${bgColor} ${textColor} text-sm`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderColor}`}>
        {/* View mode toggle */}
        <div className={`flex rounded-md overflow-hidden border ${borderColor}`}>
          <button
            onClick={() => setViewMode('structure')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'structure'
                ? theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                : theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            }`}
          >
            Structure
          </button>
          <button
            onClick={() => setViewMode('tokens')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'tokens'
                ? theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                : theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            }`}
          >
            Tokens
          </button>
        </div>

        {/* Category filter (only in tokens view) */}
        {viewMode === 'tokens' && (
          <div className="flex items-center gap-1 ml-2">
            {(['all', 'keyword', 'variable', 'iri', 'literal', 'operator', 'identifier'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`
                  px-2 py-1 text-xs rounded-full transition-colors
                  ${selectedCategory === cat
                    ? cat === 'all' 
                      ? theme === 'dark' ? 'bg-zinc-600 text-white' : 'bg-zinc-700 text-white'
                      : CATEGORY_COLORS[cat as TokenInfo['category']].bg + ' ' + CATEGORY_COLORS[cat as TokenInfo['category']][theme]
                    : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                  }
                `}
              >
                {cat} {categoryCounts[cat] > 0 && <span className="ml-1 opacity-60">({categoryCounts[cat]})</span>}
              </button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className={`ml-auto text-xs ${mutedColor}`}>
          {parseResult.tokenInfos.length} tokens • {parseResult.errors.length} errors
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {viewMode === 'structure' ? (
          <div className="space-y-4">
            {/* Prefixes */}
            {parseResult.structure.prefixes.length > 0 && (
              <div>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${mutedColor}`}>
                  Prefixes ({parseResult.structure.prefixes.length})
                </h4>
                <div className="space-y-1">
                  {parseResult.structure.prefixes.map((p, i) => (
                    <div 
                      key={i}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer
                        ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}
                      `}
                      onClick={() => onTokenClick?.({ startLine: p.line, startColumn: 1, endLine: p.line, endColumn: 100 })}
                    >
                      <span className={`font-mono ${CATEGORY_COLORS.keyword[theme]}`}>{p.prefix}</span>
                      <span className={mutedColor}>→</span>
                      <span className={`font-mono truncate ${CATEGORY_COLORS.iri[theme]}`}>{p.iri}</span>
                      <span className={`ml-auto ${mutedColor}`}>L{p.line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rules */}
            {parseResult.structure.rules.length > 0 && (
              <div>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${mutedColor}`}>
                  Rules ({parseResult.structure.rules.length})
                </h4>
                <div className="space-y-1">
                  {parseResult.structure.rules.map((r, i) => (
                    <div 
                      key={i}
                      className={`
                        px-2 py-1.5 rounded text-xs cursor-pointer
                        ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}
                      `}
                      onClick={() => onTokenClick?.({ startLine: r.line, startColumn: 1, endLine: r.line, endColumn: 100 })}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${CATEGORY_COLORS.keyword[theme]}`}>{r.type}</span>
                        <span className={`ml-auto ${mutedColor}`}>L{r.line}</span>
                      </div>
                      {r.variables.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.variables.map((v, j) => (
                            <span 
                              key={j}
                              className={`px-1.5 py-0.5 rounded font-mono ${CATEGORY_COLORS.variable.bg} ${CATEGORY_COLORS.variable[theme]}`}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Property Declarations */}
            {parseResult.structure.declarations.length > 0 && (
              <div>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${mutedColor}`}>
                  Property Declarations ({parseResult.structure.declarations.length})
                </h4>
                <div className="space-y-1">
                  {parseResult.structure.declarations.map((d, i) => (
                    <div 
                      key={i}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer
                        ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}
                      `}
                      onClick={() => onTokenClick?.({ startLine: d.line, startColumn: 1, endLine: d.line, endColumn: 100 })}
                    >
                      <span className={`font-mono ${CATEGORY_COLORS.keyword[theme]}`}>{d.type}</span>
                      <span className={`font-mono ${CATEGORY_COLORS.iri[theme]}`}>{d.property}</span>
                      <span className={`ml-auto ${mutedColor}`}>L{d.line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data Blocks */}
            {parseResult.structure.dataBlocks.length > 0 && (
              <div>
                <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${mutedColor}`}>
                  Data Blocks ({parseResult.structure.dataBlocks.length})
                </h4>
                <div className="space-y-1">
                  {parseResult.structure.dataBlocks.map((d, i) => (
                    <div 
                      key={i}
                      className={`
                        flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer
                        ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}
                      `}
                      onClick={() => onTokenClick?.({ startLine: d.line, startColumn: 1, endLine: d.line, endColumn: 100 })}
                    >
                      <span className={`font-mono ${CATEGORY_COLORS.keyword[theme]}`}>DATA</span>
                      <span className={mutedColor}>~{d.tripleCount} triples</span>
                      <span className={`ml-auto ${mutedColor}`}>L{d.line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 text-red-400">
                  Errors ({parseResult.errors.length})
                </h4>
                <div className="space-y-1">
                  {parseResult.errors.map((e, i) => (
                    <div 
                      key={i}
                      className={`
                        px-2 py-1.5 rounded text-xs bg-red-500/10 text-red-400 cursor-pointer
                        hover:bg-red-500/20
                      `}
                      onClick={() => {
                        const line = e.token?.startLine || 1;
                        const col = e.token?.startColumn || 1;
                        onTokenClick?.({ startLine: line, startColumn: col, endLine: line, endColumn: col + 1 });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{e.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Token list view */
          <div className="space-y-0.5">
            {filteredTokens.map((token, index) => {
              const colors = CATEGORY_COLORS[token.category];
              const isHovered = hoveredToken === token;
              
              return (
                <div
                  key={index}
                  className={`
                    flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors
                    ${isHovered 
                      ? theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                      : theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                    }
                  `}
                  onMouseEnter={() => handleTokenMouseEnter(token)}
                  onMouseLeave={handleTokenMouseLeave}
                  onClick={() => handleTokenClick(token)}
                >
                  {/* Category badge */}
                  <span className={`
                    px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
                    ${colors.bg} ${colors[theme]}
                  `}>
                    {token.category.slice(0, 3)}
                  </span>
                  
                  {/* Token image */}
                  <code className={`font-mono text-xs truncate max-w-32 ${colors[theme]}`}>
                    {token.image.length > 30 ? token.image.slice(0, 30) + '...' : token.image}
                  </code>
                  
                  {/* Token type */}
                  <span className={`text-xs ${mutedColor} hidden sm:block`}>
                    {token.type}
                  </span>
                  
                  {/* Position */}
                  <span className={`ml-auto text-xs ${mutedColor} tabular-nums`}>
                    {token.startLine}:{token.startColumn}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover info panel */}
      {hoveredToken && viewMode === 'tokens' && (
        <div className={`border-t ${borderColor} px-3 py-2 ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className={`text-xs font-medium ${CATEGORY_COLORS[hoveredToken.category][theme]}`}>
                {hoveredToken.type}
              </div>
              <div className={`text-xs mt-0.5 ${mutedColor}`}>
                {hoveredToken.description}
              </div>
            </div>
            <div className={`text-xs ${mutedColor} text-right`}>
              <div>Line {hoveredToken.startLine}, Col {hoveredToken.startColumn}</div>
              <div>Offset {hoveredToken.startOffset}-{hoveredToken.endOffset}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
