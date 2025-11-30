/**
 * SHACL 1.2 Node Expressions AST Types
 * Based on the revised SHACL 1.2 Node Expressions specification
 * @see https://raw.githack.com/w3c/data-shapes/new-issue-484-sequence-shnex/shacl12-node-expr/index.html
 */

import type { NamedNode, BlankNode, Literal, Quad } from 'n3';

export type RDFTerm = NamedNode | BlankNode | Literal;

/**
 * Base interface for all node expressions
 */
export interface BaseNodeExpression {
  type: NodeExpressionType;
  id?: RDFTerm;
}

/**
 * All possible node expression types
 */
export type NodeExpressionType =
  // Constants
  | 'iri'
  | 'literal'
  // Basic
  | 'empty'
  | 'var'
  | 'list'
  | 'pathValues'
  | 'exists'
  | 'if'
  // List Operators
  | 'distinct'
  | 'intersection'
  | 'concat'
  | 'remove'
  | 'join'
  | 'filterShape'
  | 'limit'
  | 'offset'
  | 'orderBy'
  // Sequence Operators
  | 'flatMap'
  | 'findFirst'
  | 'matchAll'
  // Aggregations
  | 'count'
  | 'min'
  | 'max'
  | 'sum'
  // Miscellaneous
  | 'instancesOf'
  | 'nodesMatching'
  // SPARQL Functions
  | 'function'
  // Custom Functions
  | 'namedParamFunction'
  | 'listParamFunction'
  | 'arg';

// ============================================================================
// Constant Expressions
// ============================================================================

/**
 * IRI Expression - returns the IRI itself
 */
export interface IRIExpression extends BaseNodeExpression {
  type: 'iri';
  value: NamedNode;
}

/**
 * Literal Expression - returns the literal itself
 */
export interface LiteralExpression extends BaseNodeExpression {
  type: 'literal';
  value: Literal;
}

// ============================================================================
// Basic Expressions
// ============================================================================

/**
 * Empty Expression - returns empty list []
 */
export interface EmptyExpression extends BaseNodeExpression {
  type: 'empty';
}

/**
 * Var Expression - returns scope variable value
 * shnex:var specifies the variable name (e.g., "focusNode", "value")
 */
export interface VarExpression extends BaseNodeExpression {
  type: 'var';
  varName: string;
}

/**
 * List Expression - returns list members from rdf:first/rest
 */
export interface ListExpression extends BaseNodeExpression {
  type: 'list';
  elements: NodeExpression[];
}

/**
 * Path Values Expression - property path traversal
 * Optional shnex:focusNode to specify a different starting node
 */
export interface PathValuesExpression extends BaseNodeExpression {
  type: 'pathValues';
  path: PropertyPath;
  focusNode?: NodeExpression;
}

/**
 * Exists Expression - returns true if nested expr has ≥1 node
 */
export interface ExistsExpression extends BaseNodeExpression {
  type: 'exists';
  expression: NodeExpression;
}

/**
 * If/Then/Else Expression - conditional evaluation with lazy branches
 */
export interface IfExpression extends BaseNodeExpression {
  type: 'if';
  condition: NodeExpression;
  then: NodeExpression;
  else: NodeExpression;
}

// ============================================================================
// List Operators
// ============================================================================

/**
 * Distinct Expression - remove duplicates (term equality)
 */
export interface DistinctExpression extends BaseNodeExpression {
  type: 'distinct';
  nodes: NodeExpression;
}

/**
 * Intersection Expression - set intersection of node expression lists
 */
export interface IntersectionExpression extends BaseNodeExpression {
  type: 'intersection';
  expressions: NodeExpression[];
}

/**
 * Concat Expression (was Union) - concatenate sequences preserving order
 * May have duplicates
 */
export interface ConcatExpression extends BaseNodeExpression {
  type: 'concat';
  expressions: NodeExpression[];
}

/**
 * Remove Expression (was Minus) - remove nodes from shnex:nodes that appear in shnex:remove
 * Removes all occurrences
 */
export interface RemoveExpression extends BaseNodeExpression {
  type: 'remove';
  nodes: NodeExpression;
  remove: NodeExpression;
}

/**
 * Join Expression (new) - set union, nodes in any of the listed expressions
 */
export interface JoinExpression extends BaseNodeExpression {
  type: 'join';
  expressions: NodeExpression[];
}

/**
 * FilterShape Expression - keep nodes from shnex:nodes conforming to shape
 */
export interface FilterShapeExpression extends BaseNodeExpression {
  type: 'filterShape';
  nodes: NodeExpression;
  shape: RDFTerm;
}

/**
 * Limit Expression - take first N nodes from shnex:nodes
 */
export interface LimitExpression extends BaseNodeExpression {
  type: 'limit';
  nodes: NodeExpression;
  limit: number;
}

/**
 * Offset Expression - skip first N nodes from shnex:nodes
 */
export interface OffsetExpression extends BaseNodeExpression {
  type: 'offset';
  nodes: NodeExpression;
  offset: number;
}

/**
 * OrderBy Expression - sort nodes by property
 */
export interface OrderByExpression extends BaseNodeExpression {
  type: 'orderBy';
  nodes: NodeExpression;
  orderBy: PropertyPath;
  descending?: boolean;
}

// ============================================================================
// Sequence Operators (new in revised spec)
// ============================================================================

/**
 * FlatMap Expression - apply expr to each input node with changed focus node, flatten results
 */
export interface FlatMapExpression extends BaseNodeExpression {
  type: 'flatMap';
  nodes: NodeExpression;
  flatMap: NodeExpression;
}

/**
 * FindFirst Expression - first node in sequence conforming to shape, or empty
 */
export interface FindFirstExpression extends BaseNodeExpression {
  type: 'findFirst';
  nodes: NodeExpression;
  shape: RDFTerm;
}

/**
 * MatchAll Expression - returns true if all nodes conform to shape, else false
 */
export interface MatchAllExpression extends BaseNodeExpression {
  type: 'matchAll';
  nodes: NodeExpression;
  shape: RDFTerm;
}

// ============================================================================
// Aggregation Expressions
// ============================================================================

/**
 * Count Expression - count of nodes as xsd:integer
 */
export interface CountExpression extends BaseNodeExpression {
  type: 'count';
  nodes: NodeExpression;
}

/**
 * Min Expression - minimum value (per SPARQL MIN semantics)
 */
export interface MinExpression extends BaseNodeExpression {
  type: 'min';
  nodes: NodeExpression;
}

/**
 * Max Expression - maximum value (per SPARQL MAX semantics)
 */
export interface MaxExpression extends BaseNodeExpression {
  type: 'max';
  nodes: NodeExpression;
}

/**
 * Sum Expression - sum of values (per SPARQL SUM semantics)
 */
export interface SumExpression extends BaseNodeExpression {
  type: 'sum';
  nodes: NodeExpression;
}

// ============================================================================
// Miscellaneous Expressions
// ============================================================================

/**
 * InstancesOf Expression - all SHACL instances of class (includes subclasses)
 */
export interface InstancesOfExpression extends BaseNodeExpression {
  type: 'instancesOf';
  class: RDFTerm;
}

/**
 * NodesMatching Expression - all nodes in graph conforming to shape
 */
export interface NodesMatchingExpression extends BaseNodeExpression {
  type: 'nodesMatching';
  shape: RDFTerm;
}

// ============================================================================
// SPARQL Functions
// ============================================================================

/**
 * Function Expression - 60+ SPARQL functions
 */
export interface FunctionExpression extends BaseNodeExpression {
  type: 'function';
  functionIRI: NamedNode;
  arguments: NodeExpression[];
}

// ============================================================================
// Custom Functions
// ============================================================================

/**
 * Named Parameter Function Expression - user-defined via sh:NamedParameterExpressionFunction
 */
export interface NamedParamFunctionExpression extends BaseNodeExpression {
  type: 'namedParamFunction';
  function: RDFTerm;
  parameters: Map<RDFTerm, NodeExpression>;
}

/**
 * List Parameter Function Expression - user-defined via sh:ListParameterExpressionFunction
 */
export interface ListParamFunctionExpression extends BaseNodeExpression {
  type: 'listParamFunction';
  function: RDFTerm;
  arguments: NodeExpression[];
}

/**
 * Arg Expression - access argument by key (IRI or integer index) in custom functions
 */
export interface ArgExpression extends BaseNodeExpression {
  type: 'arg';
  key: RDFTerm | number;
}

// ============================================================================
// Union type for all node expressions
// ============================================================================

export type NodeExpression =
  // Constants
  | IRIExpression
  | LiteralExpression
  // Basic
  | EmptyExpression
  | VarExpression
  | ListExpression
  | PathValuesExpression
  | ExistsExpression
  | IfExpression
  // List Operators
  | DistinctExpression
  | IntersectionExpression
  | ConcatExpression
  | RemoveExpression
  | JoinExpression
  | FilterShapeExpression
  | LimitExpression
  | OffsetExpression
  | OrderByExpression
  // Sequence Operators
  | FlatMapExpression
  | FindFirstExpression
  | MatchAllExpression
  // Aggregations
  | CountExpression
  | MinExpression
  | MaxExpression
  | SumExpression
  // Miscellaneous
  | InstancesOfExpression
  | NodesMatchingExpression
  // SPARQL Functions
  | FunctionExpression
  // Custom Functions
  | NamedParamFunctionExpression
  | ListParamFunctionExpression
  | ArgExpression;

// ============================================================================
// Property Path Types (SHACL property paths)
// ============================================================================

export type PropertyPathType =
  | 'predicate'
  | 'inverse'
  | 'sequence'
  | 'alternative'
  | 'zeroOrMore'
  | 'oneOrMore'
  | 'zeroOrOne';

export interface BasePropertyPath {
  type: PropertyPathType;
}

/**
 * Simple predicate path
 */
export interface PredicatePath extends BasePropertyPath {
  type: 'predicate';
  predicate: NamedNode;
}

/**
 * Inverse path - ^predicate
 */
export interface InversePath extends BasePropertyPath {
  type: 'inverse';
  path: PropertyPath;
}

/**
 * Sequence path - path1/path2
 */
export interface SequencePath extends BasePropertyPath {
  type: 'sequence';
  paths: PropertyPath[];
}

/**
 * Alternative path - path1|path2
 */
export interface AlternativePath extends BasePropertyPath {
  type: 'alternative';
  paths: PropertyPath[];
}

/**
 * Zero or more path - path*
 */
export interface ZeroOrMorePath extends BasePropertyPath {
  type: 'zeroOrMore';
  path: PropertyPath;
}

/**
 * One or more path - path+
 */
export interface OneOrMorePath extends BasePropertyPath {
  type: 'oneOrMore';
  path: PropertyPath;
}

/**
 * Zero or one path - path?
 */
export interface ZeroOrOnePath extends BasePropertyPath {
  type: 'zeroOrOne';
  path: PropertyPath;
}

export type PropertyPath =
  | PredicatePath
  | InversePath
  | SequencePath
  | AlternativePath
  | ZeroOrMorePath
  | OneOrMorePath
  | ZeroOrOnePath;

// ============================================================================
// Evaluation Context and Trace Types
// ============================================================================

/**
 * Scope for variable bindings during evaluation
 */
export interface EvaluationScope {
  focusNode: RDFTerm;
  variables: Map<string, RDFTerm[]>;
}

/**
 * Single step in evaluation trace
 */
export interface EvaluationStep {
  expression: NodeExpression;
  inputNodes: RDFTerm[];
  scope: EvaluationScope;
  outputNodes: RDFTerm[];
  details?: string;
  subSteps?: EvaluationStep[];
}

/**
 * Complete evaluation trace
 */
export interface EvaluationTrace {
  expression: NodeExpression;
  focusNode: RDFTerm;
  result: RDFTerm[];
  steps: EvaluationStep[];
  executionTime: number;
}

// ============================================================================
// Dynamic SHACL Types
// ============================================================================

/**
 * Constraint with dynamic parameter values
 */
export interface DynamicConstraint {
  constraintComponent: NamedNode;
  parameter: NamedNode;
  expression: NodeExpression;
  evaluatedValue?: RDFTerm[];
}

/**
 * Shape with potentially dynamic constraints
 */
export interface DynamicShape {
  id: RDFTerm;
  targetClass?: RDFTerm[];
  targetNode?: RDFTerm[];
  targetSubjectsOf?: NamedNode[];
  targetObjectsOf?: NamedNode[];
  constraints: DynamicConstraint[];
  propertyShapes: DynamicPropertyShape[];
}

/**
 * Property shape with potentially dynamic constraints
 */
export interface DynamicPropertyShape {
  id?: RDFTerm;
  path: PropertyPath;
  constraints: DynamicConstraint[];
}

/**
 * Result of dynamic validation
 */
export interface DynamicValidationResult {
  conforms: boolean;
  focusNode: RDFTerm;
  shape: RDFTerm;
  constraintResults: ConstraintResult[];
}

/**
 * Result of a single constraint check
 */
export interface ConstraintResult {
  constraint: DynamicConstraint;
  conforms: boolean;
  valueNode?: RDFTerm;
  message?: string;
  expressionTrace?: EvaluationTrace;
}

// ============================================================================
// SHNEX Vocabulary Namespace
// ============================================================================

export const SHNEX = {
  prefix: 'shnex',
  namespace: 'http://www.w3.org/ns/shacl-nex#',
  
  // Expression predicates
  pathValues: 'http://www.w3.org/ns/shacl-nex#pathValues',
  focusNode: 'http://www.w3.org/ns/shacl-nex#focusNode',
  nodes: 'http://www.w3.org/ns/shacl-nex#nodes',
  var: 'http://www.w3.org/ns/shacl-nex#var',
  exists: 'http://www.w3.org/ns/shacl-nex#exists',
  if: 'http://www.w3.org/ns/shacl-nex#if',
  then: 'http://www.w3.org/ns/shacl-nex#then',
  else: 'http://www.w3.org/ns/shacl-nex#else',
  distinct: 'http://www.w3.org/ns/shacl-nex#distinct',
  intersection: 'http://www.w3.org/ns/shacl-nex#intersection',
  concat: 'http://www.w3.org/ns/shacl-nex#concat',
  remove: 'http://www.w3.org/ns/shacl-nex#remove',
  join: 'http://www.w3.org/ns/shacl-nex#join',
  filterShape: 'http://www.w3.org/ns/shacl-nex#filterShape',
  limit: 'http://www.w3.org/ns/shacl-nex#limit',
  offset: 'http://www.w3.org/ns/shacl-nex#offset',
  orderBy: 'http://www.w3.org/ns/shacl-nex#orderBy',
  descending: 'http://www.w3.org/ns/shacl-nex#descending',
  flatMap: 'http://www.w3.org/ns/shacl-nex#flatMap',
  findFirst: 'http://www.w3.org/ns/shacl-nex#findFirst',
  matchAll: 'http://www.w3.org/ns/shacl-nex#matchAll',
  count: 'http://www.w3.org/ns/shacl-nex#count',
  min: 'http://www.w3.org/ns/shacl-nex#min',
  max: 'http://www.w3.org/ns/shacl-nex#max',
  sum: 'http://www.w3.org/ns/shacl-nex#sum',
  instancesOf: 'http://www.w3.org/ns/shacl-nex#instancesOf',
  nodesMatching: 'http://www.w3.org/ns/shacl-nex#nodesMatching',
  arg: 'http://www.w3.org/ns/shacl-nex#arg',
  
  // Empty expression
  empty: 'http://www.w3.org/ns/shacl-nex#empty',
} as const;

export const SH = {
  prefix: 'sh',
  namespace: 'http://www.w3.org/ns/shacl#',
  
  // Core SHACL
  path: 'http://www.w3.org/ns/shacl#path',
  targetClass: 'http://www.w3.org/ns/shacl#targetClass',
  targetNode: 'http://www.w3.org/ns/shacl#targetNode',
  targetSubjectsOf: 'http://www.w3.org/ns/shacl#targetSubjectsOf',
  targetObjectsOf: 'http://www.w3.org/ns/shacl#targetObjectsOf',
  property: 'http://www.w3.org/ns/shacl#property',
  
  // Property paths
  inversePath: 'http://www.w3.org/ns/shacl#inversePath',
  alternativePath: 'http://www.w3.org/ns/shacl#alternativePath',
  zeroOrMorePath: 'http://www.w3.org/ns/shacl#zeroOrMorePath',
  oneOrMorePath: 'http://www.w3.org/ns/shacl#oneOrMorePath',
  zeroOrOnePath: 'http://www.w3.org/ns/shacl#zeroOrOnePath',
  
  // Dynamic SHACL
  expression: 'http://www.w3.org/ns/shacl#expression',
  nodeByExpression: 'http://www.w3.org/ns/shacl#nodeByExpression',
  
  // Custom functions
  NamedParameterExpressionFunction: 'http://www.w3.org/ns/shacl#NamedParameterExpressionFunction',
  ListParameterExpressionFunction: 'http://www.w3.org/ns/shacl#ListParameterExpressionFunction',
  bodyExpression: 'http://www.w3.org/ns/shacl#bodyExpression',
  
  // Node shape and property shape
  NodeShape: 'http://www.w3.org/ns/shacl#NodeShape',
  PropertyShape: 'http://www.w3.org/ns/shacl#PropertyShape',
} as const;

export const RDF = {
  prefix: 'rdf',
  namespace: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  first: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
  rest: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
  nil: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil',
} as const;

export const RDFS = {
  prefix: 'rdfs',
  namespace: 'http://www.w3.org/2000/01/rdf-schema#',
  subClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
} as const;

export const XSD = {
  prefix: 'xsd',
  namespace: 'http://www.w3.org/2001/XMLSchema#',
  boolean: 'http://www.w3.org/2001/XMLSchema#boolean',
  integer: 'http://www.w3.org/2001/XMLSchema#integer',
  decimal: 'http://www.w3.org/2001/XMLSchema#decimal',
  string: 'http://www.w3.org/2001/XMLSchema#string',
} as const;

export const SPARQL = {
  prefix: 'sparql',
  namespace: 'http://www.w3.org/ns/sparql#',
} as const;
