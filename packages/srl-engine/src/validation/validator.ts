import { parseSRL } from '../srl/parser';
import { SRLLexer } from '../srl/tokens';
import { IToken } from 'chevrotain';
import { Store, Parser as N3Parser } from 'n3';
import {
  buildAST,
  RuleSet,
  Rule,
  BodyElement,
  TriplePattern,
  Expression,
  SourceLocation,
  TargetedRule,
} from '../srl/ast';
import { expandDeclarations } from '../rules/executor';
import { isStratifiable } from '../rules/stratifier';
import { getPatternVariables, isTriplePattern } from '../rules/pattern-matcher';

// The complete SHACL 1.2 Rules built-in function set (grammar production [121]).
// A bareword function call whose name is not in this set is an error. Notably
// BOUND, RAND, COALESCE, and the hash functions (MD5/SHA*) are NOT included.
const SPEC_BUILTINS = new Set(
  [
    'STR', 'LANG', 'LANGMATCHES', 'LANGDIR', 'DATATYPE', 'IRI', 'URI', 'BNODE',
    'ABS', 'CEIL', 'FLOOR', 'ROUND', 'CONCAT', 'SUBSTR', 'STRLEN', 'REPLACE',
    'UCASE', 'LCASE', 'ENCODE_FOR_URI', 'CONTAINS', 'STRSTARTS', 'STRENDS',
    'STRBEFORE', 'STRAFTER', 'YEAR', 'MONTH', 'DAY', 'HOURS', 'MINUTES',
    'SECONDS', 'TIMEZONE', 'TZ', 'NOW', 'UUID', 'STRUUID', 'IF', 'STRLANG',
    'STRLANGDIR', 'STRDT', 'SAMETERM', 'ISIRI', 'ISURI', 'ISBLANK', 'ISLITERAL',
    'ISNUMERIC', 'HASLANG', 'HASLANGDIR', 'REGEX', 'ISTRIPLE', 'TRIPLE',
    'SUBJECT', 'PREDICATE', 'OBJECT',
  ]
);

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  /**
   * Distinguishes stratification errors from §4.2 well-formedness errors.
   * The W3C suite treats these as separate categories: a rule set can be
   * well-formed per §4.2 yet non-stratifiable. Absent ⇒ a well-formedness
   * (or lexer/parser/prefix) message.
   */
  category?: 'stratification';
}

export interface ValidationResult {
  messages: ValidationMessage[];
  parseTime: number;
  /** True when there are no error messages of ANY kind (the playground run-gate). */
  isValid: boolean;
  /**
   * True when there are no §4.2 well-formedness (or lexer/parser) errors —
   * IGNORING stratification. A rule set can be well-formed but non-stratifiable;
   * consumers wanting §4.2 conformance independently of runnability read this.
   */
  isWellFormed: boolean;
}

export interface WorkerMessage {
  type: 'validate' | 'parse';
  id: string;
  code: string;
}

export interface WorkerResponse {
  type: 'result';
  id: string;
  result: ValidationResult;
}

interface PrefixDeclaration {
  prefix: string;
  iri: string;
  line: number;
  column: number;
}

function extractPrefixes(tokens: IToken[]): PrefixDeclaration[] {
  const prefixes: PrefixDeclaration[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tokenType?.name === 'Prefix') {
      let prefix = '';
      let iriToken: IToken | null = null;
      
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (next.tokenType?.name === 'Identifier') {
          prefix = next.image;
          if (i + 3 < tokens.length && tokens[i + 3]?.tokenType?.name === 'IRI') {
            iriToken = tokens[i + 3];
          }
        } else if (next.tokenType?.name === 'Colon') {
          prefix = '';
          if (i + 2 < tokens.length && tokens[i + 2]?.tokenType?.name === 'IRI') {
            iriToken = tokens[i + 2];
          }
        }
      }
      
      if (iriToken) {
        prefixes.push({
          prefix,
          iri: iriToken.image,
          line: token.startLine || 1,
          column: token.startColumn || 1,
        });
      }
    }
  }
  
  return prefixes;
}

// Token-level prefix-usage scan: every `prefix:local` occurrence, so we can
// flag prefixes used but never declared. Cheap and independent of the AST.
function extractPrefixUsages(
  tokens: IToken[]
): Array<{ prefix: string; line: number; column: number; fullName: string }> {
  const prefixUsages: Array<{ prefix: string; line: number; column: number; fullName: string }> = [];

  for (const token of tokens) {
    if (token.tokenType?.name === 'PrefixedName') {
      const match = token.image.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):/);
      if (match) {
        prefixUsages.push({
          prefix: match[1],
          line: token.startLine || 1,
          column: token.startColumn || 1,
          fullName: token.image,
        });
      }
    }
  }

  return prefixUsages;
}

// Prefix diagnostics (undefined-prefix warnings, duplicate-prefix notices) run
// off the token stream so they work even when the AST fails to build.
function checkPrefixIssues(tokens: IToken[], prefixes: PrefixDeclaration[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const prefixUsages = extractPrefixUsages(tokens);

  const declaredPrefixes = new Set(prefixes.map(p => p.prefix));
  declaredPrefixes.add(''); // Empty prefix is always valid if declared

  for (const usage of prefixUsages) {
    if (!declaredPrefixes.has(usage.prefix)) {
      messages.push({
        type: 'warning',
        message: `Undefined prefix '${usage.prefix}:' used in '${usage.fullName}'`,
        startLine: usage.line,
        startColumn: usage.column,
        endLine: usage.line,
        endColumn: usage.column + usage.fullName.length,
      });
    }
  }

  const prefixCounts = new Map<string, number>();
  for (const prefix of prefixes) {
    prefixCounts.set(prefix.prefix, (prefixCounts.get(prefix.prefix) || 0) + 1);
  }

  for (const prefix of prefixes) {
    if ((prefixCounts.get(prefix.prefix) || 0) > 1) {
      messages.push({
        type: 'info',
        message: `Prefix '${prefix.prefix || ':'}' is declared multiple times`,
        startLine: prefix.line,
        startColumn: prefix.column,
        endLine: prefix.line,
        endColumn: prefix.column + 6, // length of "PREFIX"
      });
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// AST-based well-formedness (SHACL 1.2 Rules §4.2 "well-formed rule")
// ---------------------------------------------------------------------------

// Variables occurring in a triple pattern (subject / predicate / object).
function variablesInPattern(pattern: TriplePattern): Set<string> {
  return new Set(getPatternVariables(pattern));
}

// Single traversal of an Expression tree: collects referenced variables into
// `vars` and every function-call name into `fns`.
function walkExpression(expr: Expression, vars: Set<string>, fns: string[]): void {
  switch (expr.type) {
    case 'variable':
      vars.add(expr.name);
      break;
    case 'binary':
      walkExpression(expr.left, vars, fns);
      walkExpression(expr.right, vars, fns);
      break;
    case 'unary':
      walkExpression(expr.operand, vars, fns);
      break;
    case 'function':
      fns.push(expr.name);
      for (const arg of expr.args) walkExpression(arg, vars, fns);
      break;
    case 'in':
      walkExpression(expr.value, vars, fns);
      for (const item of expr.list) walkExpression(item, vars, fns);
      break;
    default:
      break;
  }
}

function locToMessage(
  type: ValidationMessage['type'],
  message: string,
  location?: SourceLocation
): ValidationMessage {
  const line = location?.startLine ?? 1;
  const col = location?.startColumn ?? 1;
  return {
    type,
    message,
    startLine: line,
    startColumn: col,
    endLine: location?.endLine ?? line,
    endColumn: location?.endColumn ?? col + 1,
  };
}

// Validate a FILTER/SET expression: every referenced variable must be in
// `vPrev`, and every function name must be a spec [121] built-in. `kind` is the
// label used in the unbound-variable message ("FILTER" / "SET expression").
function checkExpression(
  expr: Expression,
  vPrev: Set<string>,
  kind: string,
  location: SourceLocation | undefined,
  messages: ValidationMessage[]
): void {
  const vars = new Set<string>();
  const fns: string[] = [];
  walkExpression(expr, vars, fns);

  for (const v of vars) {
    if (!vPrev.has(v)) {
      messages.push(
        locToMessage('error', `${kind} references variable '?${v}' not bound by an earlier body element`, location)
      );
    }
  }
  for (const fn of fns) {
    if (!SPEC_BUILTINS.has(fn.toUpperCase())) {
      messages.push(
        locToMessage('error', `Unknown function '${fn}' — not a SHACL 1.2 Rules built-in`, location)
      );
    }
  }
}

// Verify a body element sequence is well-formed given the initial variable set
// `v0`; returns V_all (v0 ∪ every variable the sequence defines). Records errors.
function checkWellFormedSequence(
  elements: BodyElement[],
  v0: Set<string>,
  messages: ValidationMessage[]
): Set<string> {
  const vPrev = new Set(v0); // V_{i-1}

  for (const element of elements) {
    if (isTriplePattern(element)) {
      for (const v of variablesInPattern(element)) vPrev.add(v);
    } else if (element.type === 'filter') {
      checkExpression(element.expression, vPrev, 'FILTER', element.location, messages);
    } else if (element.type === 'assignment') {
      checkExpression(element.expression, vPrev, 'SET expression', element.location, messages);
      // Single-assignment: the assigned variable must be new.
      if (vPrev.has(element.variable)) {
        messages.push(
          locToMessage('error', `SET variable '?${element.variable}' is already bound earlier (assignments must introduce a new variable)`, element.location)
        );
      }
      vPrev.add(element.variable);
    } else if (element.type === 'negation') {
      // The negation body must be well-formed given V_{i-1}; variables bound
      // only inside the negation do not leak into the outer scope.
      checkWellFormedSequence(element.patterns, new Set(vPrev), messages);
    }
  }

  return vPrev;
}

function checkRuleWellFormedness(rule: Rule, messages: ValidationMessage[], v0: Set<string> = new Set()): void {
  const vAll = checkWellFormedSequence(rule.body.elements, v0, messages);

  const headVars = new Set<string>();
  for (const template of rule.head.patterns) {
    for (const v of variablesInPattern(template)) headVars.add(v);
  }
  for (const v of headVars) {
    if (!vAll.has(v)) {
      messages.push(
        locToMessage('error', `Variable '?${v}' in rule head is not bound in rule body`, rule.location)
      );
    }
  }
}

// AST-driven semantic checks: rule well-formedness, ground DATA blocks, and the
// stratification condition. Runs only when the parse produced a clean CST.
function checkAstSemantics(ruleSet: RuleSet, shapesStore?: Store): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const rule of ruleSet.rules) {
    checkRuleWellFormedness(rule, messages);
  }
  for (const tr of ruleSet.targetedRules) {
    checkRuleWellFormedness(tr.rule, messages, new Set([tr.focusVar]));
  }

  // DATA blocks must be ground — no variables in any position.
  for (const block of ruleSet.dataBlocks) {
    for (const triple of block.patterns) {
      if (variablesInPattern(triple).size > 0) {
        messages.push(
          locToMessage('error', 'DATA blocks must be ground (no variables allowed)', triple.location ?? block.location)
        );
      }
    }
  }

  // Stratification: declarations expand to synthetic rules, so check the full set.
  // Targeted rules (+ their shape-gate edges) must be included, else a targeted-gate
  // cycle would pass validation but throw at execution (validation is the run gate).
  const expanded = expandDeclarations(ruleSet.declarations, ruleSet.prefixes);
  const allRules = [...ruleSet.rules, ...expanded];
  const strat = isStratifiable(allRules, ruleSet.targetedRules, shapesStore);
  if (!strat.stratifiable) {
    messages.push({ ...locToMessage('error', strat.reason ?? 'Rule set is not stratifiable'), category: 'stratification' });
  }

  return messages;
}

export function validateSRL(
  code: string,
  options?: { extensions?: boolean; shapesGraph?: string; shapesStore?: Store },
): ValidationResult {
  const startTime = performance.now();
  const messages: ValidationMessage[] = [];

  try {
    // First, try lexing
    const lexResult = SRLLexer.tokenize(code);

    // Add lexer errors
    for (const error of lexResult.errors) {
      messages.push({
        type: 'error',
        message: error.message,
        startLine: error.line ?? 1,
        startColumn: error.column ?? 1,
        endLine: error.line ?? 1,
        endColumn: (error.column ?? 1) + (error.length ?? 1),
      });
    }

    // Then parse
    const parseResult = parseSRL(code);

    // Add parser errors
    for (const error of parseResult.errors) {
      const token = error.token;
      messages.push({
        type: 'error',
        message: error.message,
        startLine: token?.startLine ?? 1,
        startColumn: token?.startColumn ?? 1,
        endLine: token?.endLine ?? token?.startLine ?? 1,
        endColumn: token?.endColumn ?? (token?.startColumn ?? 1) + 1,
      });
    }
    
    // Run semantic analysis if no lexer/parser errors.
    if (lexResult.errors.length === 0 && parseResult.errors.length === 0) {
      const prefixes = extractPrefixes(parseResult.tokens);
      messages.push(...checkPrefixIssues(parseResult.tokens, prefixes));

      // AST-based well-formedness + stratification. Guarded so a builder error
      // (e.g. an unsupported-but-parseable construct) degrades to a diagnostic
      // rather than crashing validation.
      try {
        const ruleSet = buildAST(code, { extensions: options?.extensions });
        // Resolve the shapes graph so the stratification check can see the
        // targeted-rule gate edges. shapesStore wins; else parse shapesGraph
        // (a bad shapes graph degrades to no store rather than throwing).
        let shapesStore: Store | undefined = options?.shapesStore;
        if (!shapesStore && options?.shapesGraph) {
          try {
            shapesStore = new Store();
            shapesStore.addQuads(new N3Parser().parse(options.shapesGraph));
          } catch {
            shapesStore = undefined;
          }
        }
        messages.push(...checkAstSemantics(ruleSet, shapesStore));
      } catch (e) {
        messages.push({
          type: 'error',
          message: e instanceof Error ? e.message : 'Failed to analyze rule set',
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        });
      }
    }
  } catch (e) {
    messages.push({
      type: 'error',
      message: e instanceof Error ? e.message : 'Unknown parsing error',
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
    });
  }

  const parseTime = performance.now() - startTime;

  const errors = messages.filter((m) => m.type === 'error');
  return {
    messages,
    parseTime,
    isValid: errors.length === 0,
    // Well-formedness ignores stratification (the W3C suite's separate category).
    isWellFormed: errors.every((m) => m.category === 'stratification'),
  };
}
