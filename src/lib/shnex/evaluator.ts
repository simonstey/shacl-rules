/**
 * SHACL 1.2 Node Expression Evaluator
 * Implements evalExpr(expr, focusGraph, focusNode, scope) semantics per spec
 */

import { Store, DataFactory, NamedNode, Literal, Quad, Term } from 'n3';
import {
  NodeExpression,
  PropertyPath,
  RDFTerm,
  EvaluationScope,
  EvaluationStep,
  EvaluationTrace,
  SHNEX,
  SH,
  RDF,
  RDFS,
  XSD,
  SPARQL,
} from './ast';

const { namedNode, literal } = DataFactory;

export interface EvaluationOptions {
  trace?: boolean;
  maxIterations?: number;
  timeout?: number;
}

export interface EvaluationResult {
  nodes: RDFTerm[];
  trace?: EvaluationTrace;
  error?: string;
}

/**
 * Node Expression Evaluator
 */
export class NodeExpressionEvaluator {
  private store: Store;
  private shapes: Map<string, Term[]>;
  private options: EvaluationOptions;
  private startTime: number = 0;

  constructor(store: Store, options: EvaluationOptions = {}) {
    this.store = store;
    this.shapes = new Map();
    this.options = {
      trace: true,
      maxIterations: 10000,
      timeout: 5000,
      ...options,
    };
  }

  /**
   * Evaluate a node expression
   */
  evaluate(
    expr: NodeExpression,
    focusNode: RDFTerm,
    scope?: Partial<EvaluationScope>
  ): EvaluationResult {
    this.startTime = Date.now();

    const fullScope: EvaluationScope = {
      focusNode,
      variables: new Map([
        ['focusNode', [focusNode]],
        ...(scope?.variables || []),
      ]),
    };

    try {
      const steps: EvaluationStep[] = [];
      const nodes = this.evalExpr(expr, fullScope, steps);

      const result: EvaluationResult = { nodes };

      if (this.options.trace) {
        result.trace = {
          expression: expr,
          focusNode,
          result: nodes,
          steps,
          executionTime: Date.now() - this.startTime,
        };
      }

      return result;
    } catch (error) {
      return {
        nodes: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Core evaluation function
   */
  private evalExpr(
    expr: NodeExpression,
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    this.checkTimeout();

    const inputNodes = [scope.focusNode];
    let outputNodes: RDFTerm[] = [];
    const subSteps: EvaluationStep[] = [];

    switch (expr.type) {
      case 'iri':
        outputNodes = [expr.value];
        break;

      case 'literal':
        outputNodes = [expr.value];
        break;

      case 'empty':
        outputNodes = [];
        break;

      case 'var':
        outputNodes = scope.variables.get(expr.varName) || [];
        break;

      case 'list':
        outputNodes = expr.elements.flatMap(e => this.evalExpr(e, scope, subSteps));
        break;

      case 'pathValues':
        outputNodes = this.evalPathValues(expr, scope, subSteps);
        break;

      case 'exists':
        outputNodes = this.evalExists(expr, scope, subSteps);
        break;

      case 'if':
        outputNodes = this.evalIf(expr, scope, subSteps);
        break;

      case 'distinct':
        outputNodes = this.evalDistinct(expr, scope, subSteps);
        break;

      case 'intersection':
        outputNodes = this.evalIntersection(expr, scope, subSteps);
        break;

      case 'concat':
        outputNodes = this.evalConcat(expr, scope, subSteps);
        break;

      case 'remove':
        outputNodes = this.evalRemove(expr, scope, subSteps);
        break;

      case 'join':
        outputNodes = this.evalJoin(expr, scope, subSteps);
        break;

      case 'filterShape':
        outputNodes = this.evalFilterShape(expr, scope, subSteps);
        break;

      case 'limit':
        outputNodes = this.evalLimit(expr, scope, subSteps);
        break;

      case 'offset':
        outputNodes = this.evalOffset(expr, scope, subSteps);
        break;

      case 'orderBy':
        outputNodes = this.evalOrderBy(expr, scope, subSteps);
        break;

      case 'flatMap':
        outputNodes = this.evalFlatMap(expr, scope, subSteps);
        break;

      case 'findFirst':
        outputNodes = this.evalFindFirst(expr, scope, subSteps);
        break;

      case 'matchAll':
        outputNodes = this.evalMatchAll(expr, scope, subSteps);
        break;

      case 'count':
        outputNodes = this.evalCount(expr, scope, subSteps);
        break;

      case 'min':
        outputNodes = this.evalMin(expr, scope, subSteps);
        break;

      case 'max':
        outputNodes = this.evalMax(expr, scope, subSteps);
        break;

      case 'sum':
        outputNodes = this.evalSum(expr, scope, subSteps);
        break;

      case 'instancesOf':
        outputNodes = this.evalInstancesOf(expr, scope, subSteps);
        break;

      case 'nodesMatching':
        outputNodes = this.evalNodesMatching(expr, scope, subSteps);
        break;

      case 'function':
        outputNodes = this.evalFunction(expr, scope, subSteps);
        break;

      case 'arg':
        outputNodes = this.evalArg(expr, scope);
        break;

      default:
        outputNodes = [];
    }

    if (this.options.trace) {
      steps.push({
        expression: expr,
        inputNodes,
        scope: { ...scope, variables: new Map(scope.variables) },
        outputNodes,
        subSteps: subSteps.length > 0 ? subSteps : undefined,
      });
    }

    return outputNodes;
  }

  /**
   * PathValues - property path traversal
   */
  private evalPathValues(
    expr: { path: PropertyPath; focusNode?: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    let startNodes: RDFTerm[];

    if (expr.focusNode) {
      startNodes = this.evalExpr(expr.focusNode, scope, steps);
    } else {
      startNodes = [scope.focusNode];
    }

    const results: RDFTerm[] = [];
    for (const startNode of startNodes) {
      const pathResults = this.traversePath(expr.path, startNode);
      results.push(...pathResults);
    }

    return results;
  }

  /**
   * Traverse a property path from a starting node
   */
  private traversePath(path: PropertyPath, startNode: RDFTerm): RDFTerm[] {
    switch (path.type) {
      case 'predicate': {
        const quads = this.store.getQuads(startNode, path.predicate, null, null);
        return quads.map(q => q.object as RDFTerm);
      }

      case 'inverse': {
        const innerResults = this.traverseInversePath(path.path, startNode);
        return innerResults;
      }

      case 'sequence': {
        let current: RDFTerm[] = [startNode];
        for (const subPath of path.paths) {
          const next: RDFTerm[] = [];
          for (const node of current) {
            next.push(...this.traversePath(subPath, node));
          }
          current = next;
        }
        return current;
      }

      case 'alternative': {
        const results: RDFTerm[] = [];
        for (const subPath of path.paths) {
          results.push(...this.traversePath(subPath, startNode));
        }
        return this.distinct(results);
      }

      case 'zeroOrMore': {
        return this.traverseTransitive(path.path, startNode, true);
      }

      case 'oneOrMore': {
        return this.traverseTransitive(path.path, startNode, false);
      }

      case 'zeroOrOne': {
        const results = [startNode, ...this.traversePath(path.path, startNode)];
        return this.distinct(results);
      }

      default:
        return [];
    }
  }

  private traverseInversePath(path: PropertyPath, targetNode: RDFTerm): RDFTerm[] {
    switch (path.type) {
      case 'predicate': {
        const quads = this.store.getQuads(null, path.predicate, targetNode, null);
        return quads.map(q => q.subject as RDFTerm);
      }
      default:
        return [];
    }
  }

  private traverseTransitive(path: PropertyPath, startNode: RDFTerm, includeStart: boolean): RDFTerm[] {
    const visited = new Set<string>();
    const results: RDFTerm[] = includeStart ? [startNode] : [];
    const queue: RDFTerm[] = [startNode];

    if (includeStart) {
      visited.add(this.termKey(startNode));
    }

    let iterations = 0;
    const maxIterations = this.options.maxIterations!;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const next = this.traversePath(path, current);

      for (const node of next) {
        const key = this.termKey(node);
        if (!visited.has(key)) {
          visited.add(key);
          results.push(node);
          queue.push(node);
        }
      }
    }

    return results;
  }

  /**
   * Exists - returns true if expression has ≥1 result
   */
  private evalExists(
    expr: { expression: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const results = this.evalExpr(expr.expression, scope, steps);
    const value = results.length > 0;
    return [literal(value.toString(), namedNode(XSD.boolean))];
  }

  /**
   * If/Then/Else - conditional with lazy evaluation
   */
  private evalIf(
    expr: { condition: NodeExpression; then: NodeExpression; else: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const condResults = this.evalExpr(expr.condition, scope, steps);
    const isTrue = this.isTruthy(condResults);

    if (isTrue) {
      return this.evalExpr(expr.then, scope, steps);
    } else {
      return this.evalExpr(expr.else, scope, steps);
    }
  }

  /**
   * Distinct - remove duplicates (term equality)
   */
  private evalDistinct(
    expr: { nodes: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    return this.distinct(nodes);
  }

  /**
   * Intersection - set intersection
   */
  private evalIntersection(
    expr: { expressions: NodeExpression[] },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    if (expr.expressions.length === 0) return [];

    const sets = expr.expressions.map(e => {
      const nodes = this.evalExpr(e, scope, steps);
      return new Set(nodes.map(n => this.termKey(n)));
    });

    const nodeMap = new Map<string, RDFTerm>();
    const firstNodes = this.evalExpr(expr.expressions[0], scope, steps);
    for (const node of firstNodes) {
      nodeMap.set(this.termKey(node), node);
    }

    const intersection = [...sets[0]].filter(key =>
      sets.every(set => set.has(key))
    );

    return intersection.map(key => nodeMap.get(key)!);
  }

  /**
   * Concat - concatenate sequences preserving order (may have duplicates)
   */
  private evalConcat(
    expr: { expressions: NodeExpression[] },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const results: RDFTerm[] = [];
    for (const e of expr.expressions) {
      results.push(...this.evalExpr(e, scope, steps));
    }
    return results;
  }

  /**
   * Remove - remove all occurrences of nodes
   */
  private evalRemove(
    expr: { nodes: NodeExpression; remove: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    const toRemove = new Set(
      this.evalExpr(expr.remove, scope, steps).map(n => this.termKey(n))
    );
    return nodes.filter(n => !toRemove.has(this.termKey(n)));
  }

  /**
   * Join - set union (eliminates duplicates)
   */
  private evalJoin(
    expr: { expressions: NodeExpression[] },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const seen = new Set<string>();
    const results: RDFTerm[] = [];

    for (const e of expr.expressions) {
      for (const node of this.evalExpr(e, scope, steps)) {
        const key = this.termKey(node);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(node);
        }
      }
    }

    return results;
  }

  /**
   * FilterShape - keep nodes conforming to shape
   */
  private evalFilterShape(
    expr: { nodes: NodeExpression; shape: RDFTerm },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    // TODO: Implement actual shape conformance checking
    // For now, return all nodes (placeholder)
    return nodes;
  }

  /**
   * Limit - take first N nodes
   */
  private evalLimit(
    expr: { nodes: NodeExpression; limit: number },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    return nodes.slice(0, expr.limit);
  }

  /**
   * Offset - skip first N nodes
   */
  private evalOffset(
    expr: { nodes: NodeExpression; offset: number },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    return nodes.slice(expr.offset);
  }

  /**
   * OrderBy - sort nodes by property value
   */
  private evalOrderBy(
    expr: { nodes: NodeExpression; orderBy: PropertyPath; descending?: boolean },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    
    const sorted = [...nodes].sort((a, b) => {
      const aValues = this.traversePath(expr.orderBy, a);
      const bValues = this.traversePath(expr.orderBy, b);
      
      const aVal = aValues[0]?.value ?? '';
      const bVal = bValues[0]?.value ?? '';
      
      const comparison = aVal.localeCompare(bVal);
      return expr.descending ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * FlatMap - apply expression to each node with changed focus node
   */
  private evalFlatMap(
    expr: { nodes: NodeExpression; flatMap: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const inputNodes = this.evalExpr(expr.nodes, scope, steps);
    const results: RDFTerm[] = [];

    for (const node of inputNodes) {
      const newScope: EvaluationScope = {
        focusNode: node,
        variables: new Map([
          ...scope.variables,
          ['focusNode', [node]],
        ]),
      };
      results.push(...this.evalExpr(expr.flatMap, newScope, steps));
    }

    return results;
  }

  /**
   * FindFirst - first node conforming to shape
   */
  private evalFindFirst(
    expr: { nodes: NodeExpression; shape: RDFTerm },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    
    for (const node of nodes) {
      // TODO: Implement actual shape conformance checking
      // For now, return the first node
      return [node];
    }

    return [];
  }

  /**
   * MatchAll - returns true if all nodes conform to shape
   */
  private evalMatchAll(
    expr: { nodes: NodeExpression; shape: RDFTerm },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    
    // TODO: Implement actual shape conformance checking
    // For now, return true
    return [literal('true', namedNode(XSD.boolean))];
  }

  /**
   * Count - count of nodes as xsd:integer
   */
  private evalCount(
    expr: { nodes: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    return [literal(nodes.length.toString(), namedNode(XSD.integer))];
  }

  /**
   * Min - minimum value
   */
  private evalMin(
    expr: { nodes: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    if (nodes.length === 0) return [];

    const values = nodes
      .filter(n => n.termType === 'Literal')
      .map(n => ({ node: n, value: this.toNumber(n as Literal) }))
      .filter(v => !isNaN(v.value));

    if (values.length === 0) return [];

    const min = values.reduce((a, b) => (a.value < b.value ? a : b));
    return [min.node];
  }

  /**
   * Max - maximum value
   */
  private evalMax(
    expr: { nodes: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    if (nodes.length === 0) return [];

    const values = nodes
      .filter(n => n.termType === 'Literal')
      .map(n => ({ node: n, value: this.toNumber(n as Literal) }))
      .filter(v => !isNaN(v.value));

    if (values.length === 0) return [];

    const max = values.reduce((a, b) => (a.value > b.value ? a : b));
    return [max.node];
  }

  /**
   * Sum - sum of values
   */
  private evalSum(
    expr: { nodes: NodeExpression },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const nodes = this.evalExpr(expr.nodes, scope, steps);
    
    const sum = nodes
      .filter(n => n.termType === 'Literal')
      .map(n => this.toNumber(n as Literal))
      .filter(v => !isNaN(v))
      .reduce((a, b) => a + b, 0);

    return [literal(sum.toString(), namedNode(XSD.decimal))];
  }

  /**
   * InstancesOf - all SHACL instances of class
   */
  private evalInstancesOf(
    expr: { class: RDFTerm },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const results: RDFTerm[] = [];
    const classes = this.getClassAndSubclasses(expr.class);

    for (const cls of classes) {
      const quads = this.store.getQuads(null, namedNode(RDF.type), cls, null);
      for (const quad of quads) {
        results.push(quad.subject as RDFTerm);
      }
    }

    return this.distinct(results);
  }

  private getClassAndSubclasses(cls: RDFTerm): RDFTerm[] {
    const classes: RDFTerm[] = [cls];
    const visited = new Set<string>([this.termKey(cls)]);
    const queue: RDFTerm[] = [cls];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const subclassQuads = this.store.getQuads(null, namedNode(RDFS.subClassOf), current, null);
      
      for (const quad of subclassQuads) {
        const subclass = quad.subject as RDFTerm;
        const key = this.termKey(subclass);
        if (!visited.has(key)) {
          visited.add(key);
          classes.push(subclass);
          queue.push(subclass);
        }
      }
    }

    return classes;
  }

  /**
   * NodesMatching - all nodes conforming to shape
   */
  private evalNodesMatching(
    expr: { shape: RDFTerm },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    // TODO: Implement actual shape conformance checking
    // For now, return all subjects in the graph
    const subjects = new Set<string>();
    const results: RDFTerm[] = [];

    for (const quad of this.store.getQuads(null, null, null, null)) {
      const key = this.termKey(quad.subject as RDFTerm);
      if (!subjects.has(key)) {
        subjects.add(key);
        results.push(quad.subject as RDFTerm);
      }
    }

    return results;
  }

  /**
   * Function - SPARQL function evaluation
   */
  private evalFunction(
    expr: { functionIRI: NamedNode; arguments: NodeExpression[] },
    scope: EvaluationScope,
    steps: EvaluationStep[]
  ): RDFTerm[] {
    const args = expr.arguments.map(a => this.evalExpr(a, scope, steps));
    const funcName = expr.functionIRI.value.replace(SPARQL.namespace, '');

    return this.evaluateSPARQLFunction(funcName, args);
  }

  private evaluateSPARQLFunction(funcName: string, args: RDFTerm[][]): RDFTerm[] {
    const flatArgs = args.map(a => a[0]).filter(Boolean);

    switch (funcName.toUpperCase()) {
      case 'STRLEN': {
        if (flatArgs[0]?.termType === 'Literal') {
          const len = flatArgs[0].value.length;
          return [literal(len.toString(), namedNode(XSD.integer))];
        }
        return [];
      }

      case 'CONCAT': {
        const strs = flatArgs
          .filter(a => a.termType === 'Literal')
          .map(a => a.value);
        return [literal(strs.join(''))];
      }

      case 'UCASE': {
        if (flatArgs[0]?.termType === 'Literal') {
          return [literal(flatArgs[0].value.toUpperCase())];
        }
        return [];
      }

      case 'LCASE': {
        if (flatArgs[0]?.termType === 'Literal') {
          return [literal(flatArgs[0].value.toLowerCase())];
        }
        return [];
      }

      case 'CONTAINS': {
        if (flatArgs[0]?.termType === 'Literal' && flatArgs[1]?.termType === 'Literal') {
          const contains = flatArgs[0].value.includes(flatArgs[1].value);
          return [literal(contains.toString(), namedNode(XSD.boolean))];
        }
        return [];
      }

      case 'STRSTARTS': {
        if (flatArgs[0]?.termType === 'Literal' && flatArgs[1]?.termType === 'Literal') {
          const starts = flatArgs[0].value.startsWith(flatArgs[1].value);
          return [literal(starts.toString(), namedNode(XSD.boolean))];
        }
        return [];
      }

      case 'STRENDS': {
        if (flatArgs[0]?.termType === 'Literal' && flatArgs[1]?.termType === 'Literal') {
          const ends = flatArgs[0].value.endsWith(flatArgs[1].value);
          return [literal(ends.toString(), namedNode(XSD.boolean))];
        }
        return [];
      }

      case 'ABS': {
        if (flatArgs[0]?.termType === 'Literal') {
          const num = Math.abs(parseFloat(flatArgs[0].value));
          return [literal(num.toString(), namedNode(XSD.decimal))];
        }
        return [];
      }

      case 'CEIL': {
        if (flatArgs[0]?.termType === 'Literal') {
          const num = Math.ceil(parseFloat(flatArgs[0].value));
          return [literal(num.toString(), namedNode(XSD.integer))];
        }
        return [];
      }

      case 'FLOOR': {
        if (flatArgs[0]?.termType === 'Literal') {
          const num = Math.floor(parseFloat(flatArgs[0].value));
          return [literal(num.toString(), namedNode(XSD.integer))];
        }
        return [];
      }

      case 'ROUND': {
        if (flatArgs[0]?.termType === 'Literal') {
          const num = Math.round(parseFloat(flatArgs[0].value));
          return [literal(num.toString(), namedNode(XSD.integer))];
        }
        return [];
      }

      case 'NOW': {
        const now = new Date().toISOString();
        return [literal(now, namedNode(XSD.namespace + 'dateTime'))];
      }

      case 'RAND': {
        const rand = Math.random();
        return [literal(rand.toString(), namedNode(XSD.decimal))];
      }

      default:
        return [];
    }
  }

  /**
   * Arg - access argument by key in custom functions
   */
  private evalArg(
    expr: { key: RDFTerm | number },
    scope: EvaluationScope
  ): RDFTerm[] {
    const key = typeof expr.key === 'number' 
      ? `arg${expr.key}` 
      : expr.key.value;
    return scope.variables.get(key) || [];
  }

  // Utility functions

  private distinct(nodes: RDFTerm[]): RDFTerm[] {
    const seen = new Set<string>();
    const result: RDFTerm[] = [];

    for (const node of nodes) {
      const key = this.termKey(node);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(node);
      }
    }

    return result;
  }

  private termKey(term: RDFTerm): string {
    if (term.termType === 'Literal') {
      return `L:${term.value}:${term.datatype?.value || ''}:${term.language || ''}`;
    }
    return `${term.termType}:${term.value}`;
  }

  private isTruthy(nodes: RDFTerm[]): boolean {
    if (nodes.length === 0) return false;
    const first = nodes[0];
    if (first.termType === 'Literal') {
      if (first.datatype?.value === XSD.boolean) {
        return first.value === 'true';
      }
      return first.value !== '' && first.value !== '0';
    }
    return true;
  }

  private toNumber(lit: Literal): number {
    return parseFloat(lit.value);
  }

  private checkTimeout(): void {
    if (this.options.timeout && Date.now() - this.startTime > this.options.timeout) {
      throw new Error('Evaluation timeout exceeded');
    }
  }
}

/**
 * Create an evaluator for a given RDF store
 */
export function createEvaluator(store: Store, options?: EvaluationOptions): NodeExpressionEvaluator {
  return new NodeExpressionEvaluator(store, options);
}

/**
 * Evaluate a node expression against an RDF store
 */
export function evaluateExpression(
  store: Store,
  expr: NodeExpression,
  focusNode: RDFTerm,
  options?: EvaluationOptions
): EvaluationResult {
  const evaluator = createEvaluator(store, options);
  return evaluator.evaluate(expr, focusNode);
}
