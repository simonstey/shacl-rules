/**
 * SHACL 1.2 Node Expressions Module
 * @see https://raw.githack.com/w3c/data-shapes/new-issue-484-sequence-shnex/shacl12-node-expr/index.html
 */

// AST Types
export * from './ast';

// Parser
export { parseTurtle, expressionToTurtle } from './parser';
export type { ParseResult, ParseError } from './parser';

// Evaluator
export {
  NodeExpressionEvaluator,
  createEvaluator,
  evaluateExpression,
} from './evaluator';
export type { EvaluationOptions, EvaluationResult } from './evaluator';

// Dynamic Validator
export {
  DynamicValidator,
  createDynamicValidator,
  validateWithDynamicShapes,
} from './dynamic-validator';
export type { ValidationOptions, ShapeValidationReport } from './dynamic-validator';
