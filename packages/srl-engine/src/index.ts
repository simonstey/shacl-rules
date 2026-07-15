// srl-engine — SHACL 1.2 Rules (SRL) parser, validator, and inference engine.
// Curated public API. Internal helpers (parserInstance, joinSolutions,
// setCurrentStore/Now, ASTBuilder, SRLParser) are intentionally not exported.

// ── Language front end ──────────────────────────────────────────────
export { buildAST } from './srl/ast';
export {
  parseSRL,
  getSerializedGrammar,
  getGrammarRuleNames,
  type ParseResult,
  type GrammarRuleInfo,
} from './srl/parser';
export { SRLLexer, allTokens } from './srl/tokens';
export type {
  SourceLocation,
  RDFTerm,
  IRITerm,
  LiteralTerm,
  BlankNodeTerm,
  VariableTerm,
  TriplePattern,
  FilterElement,
  AssignmentElement,
  NegationElement,
  BodyElement,
  RuleHead,
  RuleBody,
  Rule,
  TransitiveDeclaration,
  SymmetricDeclaration,
  InverseDeclaration,
  Declaration,
  DataBlock,
  PrefixDeclaration,
  BaseDeclaration,
  RuleSet,
  BinaryOperator,
  UnaryOperator,
  PathExpression,
  PathIRI,
  PathSequence,
  PathInverse,
  Expression,
} from './srl/ast';

// ── Engine ──────────────────────────────────────────────────────────
export {
  executeRules,
  expandDeclarations,
  formatTripleForDisplay,
  type ExecutionResult,
  type InferredTriple,
  type RuleInfo,
  type ExecutorOptions,
} from './rules/executor';
export {
  stratifyRules,
  isStratifiable,
  isRunOnce,
  hasAssignment,
  headHasBlankNode,
  type StratifiedRule,
  type StratificationLayer,
  type StratificationCheck,
} from './rules/stratifier';
export {
  PatternMatcher,
  getPatternVariables,
  isTriplePattern,
  isVariable,
  isRDFTerm,
  termsEqual,
  n3TermToRDFTerm,
  termToN3,
  quadToString,
  termToString,
  triplePatternToString,
  type SolutionMapping,
} from './rules/pattern-matcher';
export type { EvalResult } from './rules/expression-evaluator';

// ── Validation ──────────────────────────────────────────────────────
export {
  validateSRL,
  type ValidationMessage,
  type ValidationResult,
} from './validation/validator';
