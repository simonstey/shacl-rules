/**
 * Dynamic SHACL Validator
 * Processes shapes where constraint parameters contain node expressions
 */

import { Store, DataFactory, NamedNode, Literal, Term } from 'n3';
import {
  NodeExpression,
  RDFTerm,
  DynamicShape,
  DynamicPropertyShape,
  DynamicConstraint,
  DynamicValidationResult,
  ConstraintResult,
  EvaluationScope,
  EvaluationTrace,
  SH,
  RDF,
  XSD,
} from './ast';
import { NodeExpressionEvaluator, EvaluationOptions, EvaluationResult } from './evaluator';

const { namedNode, literal } = DataFactory;

export interface ValidationOptions extends EvaluationOptions {
  abortOnFirstViolation?: boolean;
  includeExpressionTraces?: boolean;
}

export interface ShapeValidationReport {
  conforms: boolean;
  results: DynamicValidationResult[];
  executionTime: number;
}

/**
 * Dynamic SHACL Validator
 * Handles shapes with node expressions in constraint parameters
 */
export class DynamicValidator {
  private store: Store;
  private evaluator: NodeExpressionEvaluator;
  private options: ValidationOptions;
  private shapes: Map<string, DynamicShape>;

  constructor(store: Store, shapes: DynamicShape[], options: ValidationOptions = {}) {
    this.store = store;
    this.evaluator = new NodeExpressionEvaluator(store, options);
    this.options = {
      abortOnFirstViolation: false,
      includeExpressionTraces: true,
      ...options,
    };
    this.shapes = new Map(shapes.map(s => [this.termKey(s.id), s]));
  }

  /**
   * Validate all target nodes against all shapes
   */
  validateAll(): ShapeValidationReport {
    const startTime = Date.now();
    const results: DynamicValidationResult[] = [];
    let conforms = true;

    for (const shape of this.shapes.values()) {
      const targetNodes = this.getTargetNodes(shape);

      for (const targetNode of targetNodes) {
        const result = this.validateNode(targetNode, shape);
        results.push(result);

        if (!result.conforms) {
          conforms = false;
          if (this.options.abortOnFirstViolation) {
            return {
              conforms: false,
              results,
              executionTime: Date.now() - startTime,
            };
          }
        }
      }
    }

    return {
      conforms,
      results,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Validate a single node against a shape
   */
  validateNode(focusNode: RDFTerm, shape: DynamicShape): DynamicValidationResult {
    const constraintResults: ConstraintResult[] = [];
    let conforms = true;

    // Validate node shape constraints
    for (const constraint of shape.constraints) {
      const result = this.evaluateConstraint(focusNode, constraint);
      constraintResults.push(result);
      if (!result.conforms) {
        conforms = false;
      }
    }

    // Validate property shape constraints
    for (const propShape of shape.propertyShapes) {
      const propResults = this.validatePropertyShape(focusNode, propShape);
      constraintResults.push(...propResults);
      if (propResults.some(r => !r.conforms)) {
        conforms = false;
      }
    }

    return {
      conforms,
      focusNode,
      shape: shape.id,
      constraintResults,
    };
  }

  /**
   * Validate a property shape against a focus node
   */
  private validatePropertyShape(
    focusNode: RDFTerm,
    propShape: DynamicPropertyShape
  ): ConstraintResult[] {
    const results: ConstraintResult[] = [];

    // Get value nodes via the property path
    const valueNodes = this.getValueNodes(focusNode, propShape.path);

    // Evaluate each constraint against each value node
    for (const constraint of propShape.constraints) {
      for (const valueNode of valueNodes) {
        const result = this.evaluatePropertyConstraint(focusNode, valueNode, constraint);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get value nodes for a property path from a focus node
   */
  private getValueNodes(focusNode: RDFTerm, path: import('./ast').PropertyPath): RDFTerm[] {
    // Use the evaluator's path traversal via a pathValues expression
    const pathValuesExpr: NodeExpression = {
      type: 'pathValues',
      path,
    };

    const result = this.evaluator.evaluate(pathValuesExpr, focusNode);
    return result.nodes;
  }

  /**
   * Evaluate a node shape constraint
   */
  private evaluateConstraint(
    focusNode: RDFTerm,
    constraint: DynamicConstraint
  ): ConstraintResult {
    const scope: Partial<EvaluationScope> = {
      variables: new Map([
        ['focusNode', [focusNode]],
      ]),
    };

    // sh:expression constraint
    if (constraint.constraintComponent.value === SH.expression) {
      return this.evaluateExpressionConstraint(focusNode, constraint, scope);
    }

    // sh:nodeByExpression constraint
    if (constraint.constraintComponent.value === SH.nodeByExpression) {
      return this.evaluateNodeByExpressionConstraint(focusNode, constraint, scope);
    }

    // For other constraints with dynamic parameter values
    return this.evaluateDynamicParameterConstraint(focusNode, null, constraint, scope);
  }

  /**
   * Evaluate a property constraint
   */
  private evaluatePropertyConstraint(
    focusNode: RDFTerm,
    valueNode: RDFTerm,
    constraint: DynamicConstraint
  ): ConstraintResult {
    const scope: Partial<EvaluationScope> = {
      variables: new Map([
        ['focusNode', [focusNode]],
        ['value', [valueNode]],
      ]),
    };

    return this.evaluateDynamicParameterConstraint(focusNode, valueNode, constraint, scope);
  }

  /**
   * Evaluate sh:expression constraint
   * The expression must return true for the constraint to pass
   */
  private evaluateExpressionConstraint(
    focusNode: RDFTerm,
    constraint: DynamicConstraint,
    scope: Partial<EvaluationScope>
  ): ConstraintResult {
    const result = this.evaluator.evaluate(constraint.expression, focusNode, scope);
    
    const conforms = this.isTruthy(result.nodes);

    return {
      constraint,
      conforms,
      message: conforms ? undefined : 'Expression constraint not satisfied',
      expressionTrace: this.options.includeExpressionTraces ? result.trace : undefined,
    };
  }

  /**
   * Evaluate sh:nodeByExpression constraint
   * Value nodes must conform to shapes produced by the expression
   */
  private evaluateNodeByExpressionConstraint(
    focusNode: RDFTerm,
    constraint: DynamicConstraint,
    scope: Partial<EvaluationScope>
  ): ConstraintResult {
    // Evaluate the expression to get the shapes
    const result = this.evaluator.evaluate(constraint.expression, focusNode, scope);
    const shapes = result.nodes;

    // Check if the focus node conforms to all produced shapes
    let conforms = true;
    for (const shapeRef of shapes) {
      const shape = this.shapes.get(this.termKey(shapeRef));
      if (shape) {
        const validationResult = this.validateNode(focusNode, shape);
        if (!validationResult.conforms) {
          conforms = false;
          break;
        }
      }
    }

    return {
      constraint,
      conforms,
      message: conforms ? undefined : 'Node does not conform to dynamically computed shapes',
      expressionTrace: this.options.includeExpressionTraces ? result.trace : undefined,
    };
  }

  /**
   * Evaluate a constraint with dynamically computed parameter value
   */
  private evaluateDynamicParameterConstraint(
    focusNode: RDFTerm,
    valueNode: RDFTerm | null,
    constraint: DynamicConstraint,
    scope: Partial<EvaluationScope>
  ): ConstraintResult {
    // Evaluate the expression to get the constraint parameter value
    const result = this.evaluator.evaluate(constraint.expression, focusNode, scope);
    const paramValue = result.nodes;

    // Store the evaluated value
    constraint.evaluatedValue = paramValue;

    // Now check the constraint based on the parameter type
    const conforms = this.checkConstraint(
      constraint.parameter.value,
      valueNode || focusNode,
      paramValue
    );

    return {
      constraint,
      conforms,
      valueNode: valueNode || undefined,
      message: conforms ? undefined : `Constraint ${constraint.parameter.value} not satisfied`,
      expressionTrace: this.options.includeExpressionTraces ? result.trace : undefined,
    };
  }

  /**
   * Check a specific constraint type
   */
  private checkConstraint(
    constraintType: string,
    valueNode: RDFTerm,
    paramValue: RDFTerm[]
  ): boolean {
    const shNamespace = SH.namespace;

    // sh:minInclusive
    if (constraintType === shNamespace + 'minInclusive') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const value = parseFloat(valueNode.value);
      const min = parseFloat(paramValue[0].value);
      return !isNaN(value) && !isNaN(min) && value >= min;
    }

    // sh:maxInclusive
    if (constraintType === shNamespace + 'maxInclusive') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const value = parseFloat(valueNode.value);
      const max = parseFloat(paramValue[0].value);
      return !isNaN(value) && !isNaN(max) && value <= max;
    }

    // sh:minExclusive
    if (constraintType === shNamespace + 'minExclusive') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const value = parseFloat(valueNode.value);
      const min = parseFloat(paramValue[0].value);
      return !isNaN(value) && !isNaN(min) && value > min;
    }

    // sh:maxExclusive
    if (constraintType === shNamespace + 'maxExclusive') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const value = parseFloat(valueNode.value);
      const max = parseFloat(paramValue[0].value);
      return !isNaN(value) && !isNaN(max) && value < max;
    }

    // sh:in
    if (constraintType === shNamespace + 'in') {
      const valueKey = this.termKey(valueNode);
      return paramValue.some(pv => this.termKey(pv) === valueKey);
    }

    // sh:hasValue
    if (constraintType === shNamespace + 'hasValue') {
      const valueKey = this.termKey(valueNode);
      return paramValue.some(pv => this.termKey(pv) === valueKey);
    }

    // sh:class
    if (constraintType === shNamespace + 'class') {
      if (paramValue.length === 0) return true;
      const requiredClass = paramValue[0];
      const typeQuads = this.store.getQuads(valueNode, namedNode(RDF.type), null, null);
      return typeQuads.some(q => this.termKey(q.object as RDFTerm) === this.termKey(requiredClass));
    }

    // sh:datatype
    if (constraintType === shNamespace + 'datatype') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const datatype = (valueNode as Literal).datatype;
      return datatype?.value === paramValue[0].value;
    }

    // sh:minLength
    if (constraintType === shNamespace + 'minLength') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const minLen = parseInt(paramValue[0].value, 10);
      return !isNaN(minLen) && valueNode.value.length >= minLen;
    }

    // sh:maxLength
    if (constraintType === shNamespace + 'maxLength') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      const maxLen = parseInt(paramValue[0].value, 10);
      return !isNaN(maxLen) && valueNode.value.length <= maxLen;
    }

    // sh:pattern
    if (constraintType === shNamespace + 'pattern') {
      if (valueNode.termType !== 'Literal' || paramValue.length === 0) return true;
      try {
        const regex = new RegExp(paramValue[0].value);
        return regex.test(valueNode.value);
      } catch {
        return false;
      }
    }

    // sh:equals
    if (constraintType === shNamespace + 'equals') {
      const valueKey = this.termKey(valueNode);
      return paramValue.some(pv => this.termKey(pv) === valueKey);
    }

    // sh:disjoint
    if (constraintType === shNamespace + 'disjoint') {
      const valueKey = this.termKey(valueNode);
      return !paramValue.some(pv => this.termKey(pv) === valueKey);
    }

    // Default: constraint type not recognized, assume valid
    return true;
  }

  /**
   * Get all target nodes for a shape
   */
  private getTargetNodes(shape: DynamicShape): RDFTerm[] {
    const nodes: RDFTerm[] = [];
    const seen = new Set<string>();

    const addNode = (node: RDFTerm) => {
      const key = this.termKey(node);
      if (!seen.has(key)) {
        seen.add(key);
        nodes.push(node);
      }
    };

    // sh:targetClass
    if (shape.targetClass) {
      for (const cls of shape.targetClass) {
        const instances = this.store.getQuads(null, namedNode(RDF.type), cls, null);
        for (const quad of instances) {
          addNode(quad.subject as RDFTerm);
        }
      }
    }

    // sh:targetNode
    if (shape.targetNode) {
      for (const node of shape.targetNode) {
        addNode(node);
      }
    }

    // sh:targetSubjectsOf
    if (shape.targetSubjectsOf) {
      for (const pred of shape.targetSubjectsOf) {
        const quads = this.store.getQuads(null, pred, null, null);
        for (const quad of quads) {
          addNode(quad.subject as RDFTerm);
        }
      }
    }

    // sh:targetObjectsOf
    if (shape.targetObjectsOf) {
      for (const pred of shape.targetObjectsOf) {
        const quads = this.store.getQuads(null, pred, null, null);
        for (const quad of quads) {
          addNode(quad.object as RDFTerm);
        }
      }
    }

    return nodes;
  }

  private termKey(term: RDFTerm): string {
    if (term.termType === 'Literal') {
      return `L:${term.value}:${(term as Literal).datatype?.value || ''}:${(term as Literal).language || ''}`;
    }
    return `${term.termType}:${term.value}`;
  }

  private isTruthy(nodes: RDFTerm[]): boolean {
    if (nodes.length === 0) return false;
    const first = nodes[0];
    if (first.termType === 'Literal') {
      if ((first as Literal).datatype?.value === XSD.boolean) {
        return first.value === 'true';
      }
      return first.value !== '' && first.value !== '0';
    }
    return true;
  }
}

/**
 * Create a dynamic validator for a given store and shapes
 */
export function createDynamicValidator(
  store: Store,
  shapes: DynamicShape[],
  options?: ValidationOptions
): DynamicValidator {
  return new DynamicValidator(store, shapes, options);
}

/**
 * Validate RDF data against dynamic SHACL shapes
 */
export function validateWithDynamicShapes(
  store: Store,
  shapes: DynamicShape[],
  options?: ValidationOptions
): ShapeValidationReport {
  const validator = createDynamicValidator(store, shapes, options);
  return validator.validateAll();
}
