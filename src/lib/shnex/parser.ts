/**
 * SHACL 1.2 Node Expressions Parser
 * Extracts node expression structures from Turtle/RDF
 */

import { Store, Parser, DataFactory, NamedNode, BlankNode, Literal, Quad, Term } from 'n3';
import {
  NodeExpression,
  PropertyPath,
  RDFTerm,
  SHNEX,
  SH,
  RDF,
  RDFS,
  XSD,
  SPARQL,
  IRIExpression,
  LiteralExpression,
  EmptyExpression,
  VarExpression,
  ListExpression,
  PathValuesExpression,
  ExistsExpression,
  IfExpression,
  DistinctExpression,
  IntersectionExpression,
  ConcatExpression,
  RemoveExpression,
  JoinExpression,
  FilterShapeExpression,
  LimitExpression,
  OffsetExpression,
  OrderByExpression,
  FlatMapExpression,
  FindFirstExpression,
  MatchAllExpression,
  CountExpression,
  MinExpression,
  MaxExpression,
  SumExpression,
  InstancesOfExpression,
  NodesMatchingExpression,
  FunctionExpression,
  NamedParamFunctionExpression,
  ListParamFunctionExpression,
  ArgExpression,
  PredicatePath,
  InversePath,
  SequencePath,
  AlternativePath,
  ZeroOrMorePath,
  OneOrMorePath,
  ZeroOrOnePath,
  DynamicShape,
  DynamicPropertyShape,
  DynamicConstraint,
} from './ast';

const { namedNode, literal } = DataFactory;

export interface ParseResult {
  expressions: Map<RDFTerm, NodeExpression>;
  shapes: DynamicShape[];
  prefixes: Map<string, string>;
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  subject?: RDFTerm;
  line?: number;
  column?: number;
}

/**
 * Parse Turtle content and extract node expressions
 */
export function parseTurtle(turtleContent: string): ParseResult {
  const store = new Store();
  const prefixes: Map<string, string> = new Map();
  const errors: ParseError[] = [];

  try {
    const parser = new Parser();
    const quads = parser.parse(turtleContent);
    store.addQuads(quads);

    // Extract prefixes from parser
    const parserPrefixes = (parser as unknown as { _prefixes?: Record<string, string> })._prefixes;
    if (parserPrefixes) {
      for (const [prefix, iri] of Object.entries(parserPrefixes)) {
        prefixes.set(prefix, iri);
      }
    }
  } catch (e) {
    const error = e as Error;
    errors.push({
      message: `Parse error: ${error.message}`,
    });
    return { expressions: new Map(), shapes: [], prefixes, errors };
  }

  const parser = new NodeExpressionParser(store);
  const expressions = parser.parseAllExpressions();
  const shapes = parser.parseShapes();
  errors.push(...parser.errors);

  return { expressions, shapes, prefixes, errors };
}

class NodeExpressionParser {
  private store: Store;
  public errors: ParseError[] = [];
  private parsedExpressions: Map<string, NodeExpression> = new Map();

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Parse all node expressions in the store
   */
  parseAllExpressions(): Map<RDFTerm, NodeExpression> {
    const result = new Map<RDFTerm, NodeExpression>();

    // Find all subjects that have shnex predicates
    const shnexPredicates = [
      SHNEX.pathValues,
      SHNEX.var,
      SHNEX.exists,
      SHNEX.if,
      SHNEX.distinct,
      SHNEX.intersection,
      SHNEX.concat,
      SHNEX.remove,
      SHNEX.join,
      SHNEX.filterShape,
      SHNEX.limit,
      SHNEX.offset,
      SHNEX.orderBy,
      SHNEX.flatMap,
      SHNEX.findFirst,
      SHNEX.matchAll,
      SHNEX.count,
      SHNEX.min,
      SHNEX.max,
      SHNEX.sum,
      SHNEX.instancesOf,
      SHNEX.nodesMatching,
      SHNEX.arg,
    ];

    const processedSubjects = new Set<string>();

    for (const predicate of shnexPredicates) {
      const quads = this.store.getQuads(null, namedNode(predicate), null, null);
      for (const quad of quads) {
        const subjectKey = this.termKey(quad.subject as RDFTerm);
        if (!processedSubjects.has(subjectKey)) {
          processedSubjects.add(subjectKey);
          const expr = this.parseExpression(quad.subject as RDFTerm);
          if (expr) {
            result.set(quad.subject as RDFTerm, expr);
          }
        }
      }
    }

    // Also check for shnex:empty
    const emptyQuads = this.store.getQuads(null, null, namedNode(SHNEX.empty), null);
    for (const quad of emptyQuads) {
      if (quad.predicate.value === RDF.type) {
        const subjectKey = this.termKey(quad.subject as RDFTerm);
        if (!processedSubjects.has(subjectKey)) {
          processedSubjects.add(subjectKey);
          result.set(quad.subject as RDFTerm, { type: 'empty', id: quad.subject as RDFTerm });
        }
      }
    }

    return result;
  }

  /**
   * Parse a single node expression
   */
  parseExpression(term: Term): NodeExpression | null {
    const key = this.termKey(term as RDFTerm);
    
    // Check cache
    if (this.parsedExpressions.has(key)) {
      return this.parsedExpressions.get(key)!;
    }

    // Handle IRIs and Literals directly
    if (term.termType === 'NamedNode') {
      // Check if it's the empty expression
      if (term.value === SHNEX.empty) {
        return { type: 'empty' };
      }
      
      // Check if it has any shnex predicates (making it a complex expression)
      const hasExprPredicates = this.store.getQuads(term, null, null, null)
        .some(q => q.predicate.value.startsWith(SHNEX.namespace));
      
      if (!hasExprPredicates) {
        // Simple IRI expression
        return { type: 'iri', value: term };
      }
    }

    if (term.termType === 'Literal') {
      return { type: 'literal', value: term };
    }

    // Parse based on predicates present
    const expr = this.parseComplexExpression(term as RDFTerm);
    if (expr) {
      this.parsedExpressions.set(key, expr);
    }
    return expr;
  }

  private parseComplexExpression(subject: RDFTerm): NodeExpression | null {
    // Check for each expression type based on predicates

    // PathValues
    const pathValues = this.getObject(subject, SHNEX.pathValues);
    if (pathValues) {
      const path = this.parsePath(pathValues);
      const focusNodeTerm = this.getObject(subject, SHNEX.focusNode);
      const focusNode = focusNodeTerm ? this.parseExpression(focusNodeTerm) : undefined;
      
      if (path) {
        return {
          type: 'pathValues',
          id: subject,
          path,
          focusNode: focusNode ?? undefined,
        };
      }
    }

    // Var
    const varName = this.getObject(subject, SHNEX.var);
    if (varName && varName.termType === 'Literal') {
      return {
        type: 'var',
        id: subject,
        varName: varName.value,
      };
    }

    // Exists
    const existsExpr = this.getObject(subject, SHNEX.exists);
    if (existsExpr) {
      const expression = this.parseExpression(existsExpr);
      if (expression) {
        return {
          type: 'exists',
          id: subject,
          expression,
        };
      }
    }

    // If/Then/Else
    const ifCond = this.getObject(subject, SHNEX.if);
    if (ifCond) {
      const thenExpr = this.getObject(subject, SHNEX.then);
      const elseExpr = this.getObject(subject, SHNEX.else);
      
      const condition = this.parseExpression(ifCond);
      const then = thenExpr ? this.parseExpression(thenExpr) : null;
      const elseResult = elseExpr ? this.parseExpression(elseExpr) : null;
      
      if (condition && then && elseResult) {
        return {
          type: 'if',
          id: subject,
          condition,
          then,
          else: elseResult,
        };
      }
    }

    // Distinct
    const distinctNodes = this.getObject(subject, SHNEX.distinct);
    if (distinctNodes) {
      const nodes = this.parseExpression(distinctNodes);
      if (nodes) {
        return {
          type: 'distinct',
          id: subject,
          nodes,
        };
      }
    }

    // Intersection
    const intersectionList = this.getObject(subject, SHNEX.intersection);
    if (intersectionList) {
      const expressions = this.parseList(intersectionList);
      if (expressions.length > 0) {
        return {
          type: 'intersection',
          id: subject,
          expressions,
        };
      }
    }

    // Concat (was Union)
    const concatList = this.getObject(subject, SHNEX.concat);
    if (concatList) {
      const expressions = this.parseList(concatList);
      if (expressions.length > 0) {
        return {
          type: 'concat',
          id: subject,
          expressions,
        };
      }
    }

    // Remove (was Minus)
    const removeNodes = this.getObject(subject, SHNEX.remove);
    if (removeNodes) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        const remove = this.parseExpression(removeNodes);
        if (nodes && remove) {
          return {
            type: 'remove',
            id: subject,
            nodes,
            remove,
          };
        }
      }
    }

    // Join
    const joinList = this.getObject(subject, SHNEX.join);
    if (joinList) {
      const expressions = this.parseList(joinList);
      if (expressions.length > 0) {
        return {
          type: 'join',
          id: subject,
          expressions,
        };
      }
    }

    // FilterShape
    const filterShape = this.getObject(subject, SHNEX.filterShape);
    if (filterShape) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        if (nodes) {
          return {
            type: 'filterShape',
            id: subject,
            nodes,
            shape: filterShape as RDFTerm,
          };
        }
      }
    }

    // Limit
    const limitValue = this.getObject(subject, SHNEX.limit);
    if (limitValue && limitValue.termType === 'Literal') {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        if (nodes) {
          return {
            type: 'limit',
            id: subject,
            nodes,
            limit: parseInt(limitValue.value, 10),
          };
        }
      }
    }

    // Offset
    const offsetValue = this.getObject(subject, SHNEX.offset);
    if (offsetValue && offsetValue.termType === 'Literal') {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        if (nodes) {
          return {
            type: 'offset',
            id: subject,
            nodes,
            offset: parseInt(offsetValue.value, 10),
          };
        }
      }
    }

    // OrderBy
    const orderByPath = this.getObject(subject, SHNEX.orderBy);
    if (orderByPath) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        const path = this.parsePath(orderByPath);
        const descending = this.getObject(subject, SHNEX.descending);
        
        if (nodes && path) {
          return {
            type: 'orderBy',
            id: subject,
            nodes,
            orderBy: path,
            descending: descending?.value === 'true',
          };
        }
      }
    }

    // FlatMap
    const flatMapExpr = this.getObject(subject, SHNEX.flatMap);
    if (flatMapExpr) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        const flatMap = this.parseExpression(flatMapExpr);
        if (nodes && flatMap) {
          return {
            type: 'flatMap',
            id: subject,
            nodes,
            flatMap,
          };
        }
      }
    }

    // FindFirst
    const findFirstShape = this.getObject(subject, SHNEX.findFirst);
    if (findFirstShape) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        if (nodes) {
          return {
            type: 'findFirst',
            id: subject,
            nodes,
            shape: findFirstShape as RDFTerm,
          };
        }
      }
    }

    // MatchAll
    const matchAllShape = this.getObject(subject, SHNEX.matchAll);
    if (matchAllShape) {
      const nodesObj = this.getObject(subject, SHNEX.nodes);
      if (nodesObj) {
        const nodes = this.parseExpression(nodesObj);
        if (nodes) {
          return {
            type: 'matchAll',
            id: subject,
            nodes,
            shape: matchAllShape as RDFTerm,
          };
        }
      }
    }

    // Count
    const countNodes = this.getObject(subject, SHNEX.count);
    if (countNodes) {
      const nodes = this.parseExpression(countNodes);
      if (nodes) {
        return {
          type: 'count',
          id: subject,
          nodes,
        };
      }
    }

    // Min
    const minNodes = this.getObject(subject, SHNEX.min);
    if (minNodes) {
      const nodes = this.parseExpression(minNodes);
      if (nodes) {
        return {
          type: 'min',
          id: subject,
          nodes,
        };
      }
    }

    // Max
    const maxNodes = this.getObject(subject, SHNEX.max);
    if (maxNodes) {
      const nodes = this.parseExpression(maxNodes);
      if (nodes) {
        return {
          type: 'max',
          id: subject,
          nodes,
        };
      }
    }

    // Sum
    const sumNodes = this.getObject(subject, SHNEX.sum);
    if (sumNodes) {
      const nodes = this.parseExpression(sumNodes);
      if (nodes) {
        return {
          type: 'sum',
          id: subject,
          nodes,
        };
      }
    }

    // InstancesOf
    const instancesOfClass = this.getObject(subject, SHNEX.instancesOf);
    if (instancesOfClass) {
      return {
        type: 'instancesOf',
        id: subject,
        class: instancesOfClass as RDFTerm,
      };
    }

    // NodesMatching
    const nodesMatchingShape = this.getObject(subject, SHNEX.nodesMatching);
    if (nodesMatchingShape) {
      return {
        type: 'nodesMatching',
        id: subject,
        shape: nodesMatchingShape as RDFTerm,
      };
    }

    // Arg
    const argKey = this.getObject(subject, SHNEX.arg);
    if (argKey) {
      const key = argKey.termType === 'Literal' 
        ? parseInt(argKey.value, 10) 
        : argKey as RDFTerm;
      return {
        type: 'arg',
        id: subject,
        key,
      };
    }

    // Check if it's an RDF list
    const firstValue = this.getObject(subject, RDF.first);
    if (firstValue) {
      const elements = this.parseRDFList(subject);
      return {
        type: 'list',
        id: subject,
        elements,
      };
    }

    // Check for SPARQL function expressions
    const typeQuads = this.store.getQuads(subject, namedNode(RDF.type), null, null);
    for (const quad of typeQuads) {
      if (quad.object.value.startsWith(SPARQL.namespace)) {
        // This is a SPARQL function
        return this.parseFunctionExpression(subject, quad.object as NamedNode);
      }
    }

    // If still no match and it's a named node, treat as IRI expression
    if (subject.termType === 'NamedNode') {
      return { type: 'iri', value: subject };
    }

    return null;
  }

  private parseFunctionExpression(subject: RDFTerm, functionIRI: NamedNode): FunctionExpression | null {
    // Get all argument predicates (could be shnex:arg1, shnex:arg2, etc. or a list)
    const args: NodeExpression[] = [];
    
    // Try to find numbered arguments
    for (let i = 1; i <= 10; i++) {
      const argPred = `${SHNEX.namespace}arg${i}`;
      const argValue = this.getObject(subject, argPred);
      if (argValue) {
        const expr = this.parseExpression(argValue);
        if (expr) {
          args.push(expr);
        }
      } else {
        break;
      }
    }

    return {
      type: 'function',
      id: subject,
      functionIRI,
      arguments: args,
    };
  }

  /**
   * Parse a property path
   */
  private parsePath(term: Term): PropertyPath | null {
    if (term.termType === 'NamedNode') {
      return { type: 'predicate', predicate: term };
    }

    if (term.termType === 'BlankNode') {
      // Check for inverse path
      const inversePath = this.getObject(term as RDFTerm, SH.inversePath);
      if (inversePath) {
        const path = this.parsePath(inversePath);
        if (path) {
          return { type: 'inverse', path };
        }
      }

      // Check for alternative path
      const altPath = this.getObject(term as RDFTerm, SH.alternativePath);
      if (altPath) {
        const paths = this.parsePathList(altPath);
        if (paths.length > 0) {
          return { type: 'alternative', paths };
        }
      }

      // Check for zero or more
      const zeroOrMore = this.getObject(term as RDFTerm, SH.zeroOrMorePath);
      if (zeroOrMore) {
        const path = this.parsePath(zeroOrMore);
        if (path) {
          return { type: 'zeroOrMore', path };
        }
      }

      // Check for one or more
      const oneOrMore = this.getObject(term as RDFTerm, SH.oneOrMorePath);
      if (oneOrMore) {
        const path = this.parsePath(oneOrMore);
        if (path) {
          return { type: 'oneOrMore', path };
        }
      }

      // Check for zero or one
      const zeroOrOne = this.getObject(term as RDFTerm, SH.zeroOrOnePath);
      if (zeroOrOne) {
        const path = this.parsePath(zeroOrOne);
        if (path) {
          return { type: 'zeroOrOne', path };
        }
      }

      // Check if it's a list (sequence path)
      const firstValue = this.getObject(term as RDFTerm, RDF.first);
      if (firstValue) {
        const paths = this.parsePathList(term);
        if (paths.length > 0) {
          return { type: 'sequence', paths };
        }
      }
    }

    return null;
  }

  private parsePathList(term: Term): PropertyPath[] {
    const paths: PropertyPath[] = [];
    let current = term;

    while (current && current.value !== RDF.nil) {
      const first = this.getObject(current as RDFTerm, RDF.first);
      if (first) {
        const path = this.parsePath(first);
        if (path) {
          paths.push(path);
        }
      }

      const rest = this.getObject(current as RDFTerm, RDF.rest);
      if (rest) {
        current = rest;
      } else {
        break;
      }
    }

    return paths;
  }

  /**
   * Parse an RDF list into node expressions
   */
  private parseList(term: Term): NodeExpression[] {
    if (term.termType === 'NamedNode' && term.value === RDF.nil) {
      return [];
    }
    return this.parseRDFList(term as RDFTerm);
  }

  private parseRDFList(head: RDFTerm): NodeExpression[] {
    const elements: NodeExpression[] = [];
    let current: Term | null = head;

    while (current && current.value !== RDF.nil) {
      const first = this.getObject(current as RDFTerm, RDF.first);
      if (first) {
        const expr = this.parseExpression(first);
        if (expr) {
          elements.push(expr);
        }
      }

      const rest = this.getObject(current as RDFTerm, RDF.rest);
      if (rest) {
        current = rest;
      } else {
        break;
      }
    }

    return elements;
  }

  /**
   * Parse all SHACL shapes with potential dynamic constraints
   */
  parseShapes(): DynamicShape[] {
    const shapes: DynamicShape[] = [];

    // Find all NodeShapes
    const nodeShapeQuads = this.store.getQuads(null, namedNode(RDF.type), namedNode(SH.NodeShape), null);
    
    for (const quad of nodeShapeQuads) {
      const shape = this.parseShape(quad.subject as RDFTerm);
      if (shape) {
        shapes.push(shape);
      }
    }

    return shapes;
  }

  private parseShape(subject: RDFTerm): DynamicShape | null {
    const shape: DynamicShape = {
      id: subject,
      constraints: [],
      propertyShapes: [],
    };

    // Parse target declarations
    const targetClasses = this.store.getQuads(subject, namedNode(SH.targetClass), null, null);
    if (targetClasses.length > 0) {
      shape.targetClass = targetClasses.map(q => q.object as RDFTerm);
    }

    const targetNodes = this.store.getQuads(subject, namedNode(SH.targetNode), null, null);
    if (targetNodes.length > 0) {
      shape.targetNode = targetNodes.map(q => q.object as RDFTerm);
    }

    const targetSubjectsOf = this.store.getQuads(subject, namedNode(SH.targetSubjectsOf), null, null);
    if (targetSubjectsOf.length > 0) {
      shape.targetSubjectsOf = targetSubjectsOf.map(q => q.object as NamedNode);
    }

    const targetObjectsOf = this.store.getQuads(subject, namedNode(SH.targetObjectsOf), null, null);
    if (targetObjectsOf.length > 0) {
      shape.targetObjectsOf = targetObjectsOf.map(q => q.object as NamedNode);
    }

    // Parse property shapes
    const propertyQuads = this.store.getQuads(subject, namedNode(SH.property), null, null);
    for (const propQuad of propertyQuads) {
      const propShape = this.parsePropertyShape(propQuad.object as RDFTerm);
      if (propShape) {
        shape.propertyShapes.push(propShape);
      }
    }

    // Parse sh:expression constraints
    const exprConstraints = this.store.getQuads(subject, namedNode(SH.expression), null, null);
    for (const exprQuad of exprConstraints) {
      const expr = this.parseExpression(exprQuad.object);
      if (expr) {
        shape.constraints.push({
          constraintComponent: namedNode(SH.expression),
          parameter: namedNode(SH.expression),
          expression: expr,
        });
      }
    }

    // Parse sh:nodeByExpression constraints
    const nodeByExprConstraints = this.store.getQuads(subject, namedNode(SH.nodeByExpression), null, null);
    for (const exprQuad of nodeByExprConstraints) {
      const expr = this.parseExpression(exprQuad.object);
      if (expr) {
        shape.constraints.push({
          constraintComponent: namedNode(SH.nodeByExpression),
          parameter: namedNode(SH.nodeByExpression),
          expression: expr,
        });
      }
    }

    return shape;
  }

  private parsePropertyShape(subject: RDFTerm): DynamicPropertyShape | null {
    const pathTerm = this.getObject(subject, SH.path);
    if (!pathTerm) {
      return null;
    }

    const path = this.parsePath(pathTerm);
    if (!path) {
      return null;
    }

    const propShape: DynamicPropertyShape = {
      id: subject,
      path,
      constraints: [],
    };

    // Check for dynamic constraints (constraint parameters with node expressions)
    const allQuads = this.store.getQuads(subject, null, null, null);
    for (const quad of allQuads) {
      // Skip the path predicate
      if (quad.predicate.value === SH.path) {
        continue;
      }

      // Check if the object is a node expression
      const expr = this.parseExpression(quad.object);
      if (expr && expr.type !== 'iri' && expr.type !== 'literal') {
        propShape.constraints.push({
          constraintComponent: quad.predicate as NamedNode,
          parameter: quad.predicate as NamedNode,
          expression: expr,
        });
      }
    }

    return propShape;
  }

  /**
   * Get a single object for a subject-predicate pair
   */
  private getObject(subject: RDFTerm, predicate: string): Term | null {
    const quads = this.store.getQuads(subject, namedNode(predicate), null, null);
    return quads.length > 0 ? quads[0].object : null;
  }

  /**
   * Generate a unique key for a term
   */
  private termKey(term: RDFTerm): string {
    return `${term.termType}:${term.value}`;
  }
}

/**
 * Serialize a node expression back to Turtle
 */
export function expressionToTurtle(expr: NodeExpression, prefixes?: Map<string, string>): string {
  const lines: string[] = [];
  
  const prefixMap = new Map([
    ['shnex', SHNEX.namespace],
    ['sh', SH.namespace],
    ['rdf', RDF.namespace],
    ['xsd', XSD.namespace],
    ...(prefixes || []),
  ]);

  // Add prefix declarations
  for (const [prefix, iri] of prefixMap) {
    lines.push(`@prefix ${prefix}: <${iri}> .`);
  }
  lines.push('');

  // Serialize the expression
  const exprTurtle = serializeExpression(expr, prefixMap);
  lines.push(exprTurtle);

  return lines.join('\n');
}

function serializeExpression(expr: NodeExpression, prefixes: Map<string, string>): string {
  const termToString = (term: RDFTerm): string => {
    if (term.termType === 'NamedNode') {
      // Check if we can use a prefix
      for (const [prefix, ns] of prefixes) {
        if (term.value.startsWith(ns)) {
          return `${prefix}:${term.value.slice(ns.length)}`;
        }
      }
      return `<${term.value}>`;
    }
    if (term.termType === 'Literal') {
      if (term.datatype?.value === XSD.integer) {
        return term.value;
      }
      if (term.datatype?.value === XSD.boolean) {
        return term.value;
      }
      if (term.language) {
        return `"${term.value}"@${term.language}`;
      }
      return `"${term.value}"`;
    }
    if (term.termType === 'BlankNode') {
      return `_:${term.value}`;
    }
    // Handle other term types (Variable, DefaultGraph, Quad)
    return `<${(term as { value: string }).value}>`;
  };

  switch (expr.type) {
    case 'iri':
      return termToString(expr.value);
    case 'literal':
      return termToString(expr.value);
    case 'empty':
      return 'shnex:empty';
    case 'var':
      return `[ shnex:var "${expr.varName}" ]`;
    case 'pathValues':
      return `[ shnex:pathValues ${serializePath(expr.path, prefixes)} ]`;
    case 'count':
      return `[ shnex:count ${serializeExpression(expr.nodes, prefixes)} ]`;
    default:
      return `[ # ${expr.type} expression ]`;
  }
}

function serializePath(path: PropertyPath, prefixes: Map<string, string>): string {
  switch (path.type) {
    case 'predicate':
      for (const [prefix, ns] of prefixes) {
        if (path.predicate.value.startsWith(ns)) {
          return `${prefix}:${path.predicate.value.slice(ns.length)}`;
        }
      }
      return `<${path.predicate.value}>`;
    case 'inverse':
      return `[ sh:inversePath ${serializePath(path.path, prefixes)} ]`;
    case 'sequence':
      return `( ${path.paths.map(p => serializePath(p, prefixes)).join(' ')} )`;
    case 'alternative':
      return `[ sh:alternativePath ( ${path.paths.map(p => serializePath(p, prefixes)).join(' ')} ) ]`;
    default:
      return '';
  }
}
