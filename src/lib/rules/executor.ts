import { Store, Quad, Parser as N3Parser, NamedNode, Literal, BlankNode, DefaultGraph } from 'n3';
import { 
  RuleSet, 
  Rule, 
  TriplePattern, 
  BodyElement, 
  Declaration,
  NegationElement,
  SourceLocation,
  RDFTerm
} from '../srl/ast';
import { 
  PatternMatcher, 
  SolutionMapping, 
  instantiateTriple, 
  quadToString,
  substitutePattern,
  joinSolutions,
  termToN3,
  n3TermToRDFTerm,
  isVariable
} from './pattern-matcher';
import { evaluateFilter, evaluateExpression, resultToTerm } from './expression-evaluator';
import { stratifyRules, StratifiedRule } from './stratifier';

export interface InferredTriple {
  quad: Quad;
  quadString: string;
  sourceRule: RuleInfo;
  iteration: number;
}

export interface RuleInfo {
  index: number;
  name: string;
  location?: SourceLocation;
  head: TriplePattern[];
  originalRule: Rule;
}

export interface ExecutionResult {
  inferredTriples: InferredTriple[];
  baseTriples: Quad[];
  totalTriples: number;
  iterations: number;
  executionTime: number;
  ruleInfos: RuleInfo[];
  errors: string[];
}

export interface ExecutorOptions {
  maxIterations?: number;
  includeBaseTriples?: boolean;
}

const DEFAULT_OPTIONS: ExecutorOptions = {
  maxIterations: 100,
  includeBaseTriples: false,
};

export function expandDeclarations(declarations: Declaration[], prefixes: Map<string, string>): Rule[] {
  const expandedRules: Rule[] = [];
  
  for (const decl of declarations) {
    switch (decl.type) {
      case 'transitive': {
        const prop: RDFTerm = { termType: 'iri', value: decl.property };
        expandedRules.push({
          type: 'rule',
          name: `TRANSITIVE(${decl.property})`,
          head: {
            patterns: [{
              subject: { termType: 'variable', value: 'x' },
              predicate: prop,
              object: { termType: 'variable', value: 'z' },
            }]
          },
          body: {
            elements: [
              {
                subject: { termType: 'variable', value: 'x' },
                predicate: prop,
                object: { termType: 'variable', value: 'y' },
              },
              {
                subject: { termType: 'variable', value: 'y' },
                predicate: prop,
                object: { termType: 'variable', value: 'z' },
              }
            ]
          },
          location: decl.location,
        });
        break;
      }
      
      case 'symmetric': {
        const prop: RDFTerm = { termType: 'iri', value: decl.property };
        expandedRules.push({
          type: 'rule',
          name: `SYMMETRIC(${decl.property})`,
          head: {
            patterns: [{
              subject: { termType: 'variable', value: 'b' },
              predicate: prop,
              object: { termType: 'variable', value: 'a' },
            }]
          },
          body: {
            elements: [{
              subject: { termType: 'variable', value: 'a' },
              predicate: prop,
              object: { termType: 'variable', value: 'b' },
            }]
          },
          location: decl.location,
        });
        break;
      }
      
      case 'inverse': {
        const prop1: RDFTerm = { termType: 'iri', value: decl.property1 };
        const prop2: RDFTerm = { termType: 'iri', value: decl.property2 };
        
        expandedRules.push({
          type: 'rule',
          name: `INVERSE(${decl.property1}, ${decl.property2})`,
          head: {
            patterns: [{
              subject: { termType: 'variable', value: 'b' },
              predicate: prop2,
              object: { termType: 'variable', value: 'a' },
            }]
          },
          body: {
            elements: [{
              subject: { termType: 'variable', value: 'a' },
              predicate: prop1,
              object: { termType: 'variable', value: 'b' },
            }]
          },
          location: decl.location,
        });
        
        expandedRules.push({
          type: 'rule',
          name: `INVERSE(${decl.property2}, ${decl.property1})`,
          head: {
            patterns: [{
              subject: { termType: 'variable', value: 'b' },
              predicate: prop1,
              object: { termType: 'variable', value: 'a' },
            }]
          },
          body: {
            elements: [{
              subject: { termType: 'variable', value: 'a' },
              predicate: prop2,
              object: { termType: 'variable', value: 'b' },
            }]
          },
          location: decl.location,
        });
        break;
      }
    }
  }
  
  return expandedRules;
}

function isTriplePattern(element: BodyElement): element is TriplePattern {
  return 'subject' in element && 'predicate' in element && 'object' in element;
}

function extractBodyComponents(elements: BodyElement[]): {
  patterns: TriplePattern[];
  filters: { expression: import('../srl/ast').Expression }[];
  bindings: { variable: string; expression: import('../srl/ast').Expression }[];
  negations: NegationElement[];
} {
  const patterns: TriplePattern[] = [];
  const filters: { expression: import('../srl/ast').Expression }[] = [];
  const bindings: { variable: string; expression: import('../srl/ast').Expression }[] = [];
  const negations: NegationElement[] = [];
  
  for (const element of elements) {
    if (isTriplePattern(element)) {
      patterns.push(element);
    } else if (element.type === 'filter') {
      filters.push({ expression: element.expression });
    } else if (element.type === 'bind') {
      bindings.push({ variable: element.variable, expression: element.expression });
    } else if (element.type === 'negation') {
      negations.push(element);
    }
  }
  
  return { patterns, filters, bindings, negations };
}

function evaluateRuleBody(
  rule: Rule,
  store: Store
): SolutionMapping[] {
  const { patterns, filters, bindings, negations } = extractBodyComponents(rule.body.elements);
  
  let solutions = joinSolutions([{}], patterns, store);
  
  for (const filter of filters) {
    solutions = solutions.filter(sol => evaluateFilter(filter.expression, sol));
  }
  
  for (const binding of bindings) {
    solutions = solutions.map(sol => {
      const result = evaluateExpression(binding.expression, sol);
      const term = resultToTerm(result);
      if (term) {
        return { ...sol, [binding.variable]: term };
      }
      return sol;
    }).filter(sol => binding.variable in sol);
  }
  
  for (const negation of negations) {
    solutions = solutions.filter(sol => {
      // Evaluate the negation block as a mini rule body
      const negElements = negation.patterns;
      const { patterns: negPatterns, filters: negFilters, bindings: negBindings } = extractBodyComponents(negElements);
      
      // Start with the current solution and substitute variables
      const substituted = negPatterns.map(p => substitutePattern(p, sol));
      
      // Find matches for the patterns
      let negSolutions = joinSolutions([{}], substituted, store);
      
      // Apply filters inside the negation
      for (const filter of negFilters) {
        negSolutions = negSolutions.filter(negSol => {
          // Merge the outer solution with the inner solution for filter evaluation
          const mergedSol = { ...sol, ...negSol };
          return evaluateFilter(filter.expression, mergedSol);
        });
      }
      
      // Apply bindings inside the negation
      for (const binding of negBindings) {
        negSolutions = negSolutions.map(negSol => {
          const mergedSol = { ...sol, ...negSol };
          const result = evaluateExpression(binding.expression, mergedSol);
          const term = resultToTerm(result);
          if (term) {
            return { ...negSol, [binding.variable]: term };
          }
          return negSol;
        }).filter(negSol => binding.variable in negSol);
      }
      
      // Negation succeeds if no solutions remain after filtering
      return negSolutions.length === 0;
    });
  }
  
  return solutions;
}

function generateRuleName(rule: Rule, index: number): string {
  if (rule.name) return rule.name;
  
  const headPatterns = rule.head.patterns;
  if (headPatterns.length > 0) {
    const firstPattern = headPatterns[0];
    const pred = firstPattern.predicate;
    if (pred.termType === 'iri') {
      const localName = pred.value.split(/[#\/]/).pop() || pred.value;
      return `Rule ${index + 1}: ${localName}`;
    }
  }
  
  return `Rule ${index + 1}`;
}

export function executeRules(
  ruleSet: RuleSet,
  rdfData: string,
  options: ExecutorOptions = {}
): ExecutionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = performance.now();
  const errors: string[] = [];
  
  const store = new Store();
  const baseTriples: Quad[] = [];
  
  try {
    const parser = new N3Parser();
    const quads = parser.parse(rdfData);
    for (const quad of quads) {
      store.addQuad(quad);
      baseTriples.push(quad);
    }
  } catch (e) {
    errors.push(`Failed to parse RDF data: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  for (const dataBlock of ruleSet.dataBlocks) {
    for (const pattern of dataBlock.patterns) {
      if (!isVariable(pattern.subject) && !isVariable(pattern.predicate) && !isVariable(pattern.object)) {
        const quad = instantiateTriple(pattern, {});
        if (quad) {
          store.addQuad(quad);
          baseTriples.push(quad);
        }
      }
    }
  }
  
  const expandedRules = expandDeclarations(ruleSet.declarations, ruleSet.prefixes);
  const allRules = [...ruleSet.rules, ...expandedRules];
  
  const ruleInfos: RuleInfo[] = allRules.map((rule, index) => ({
    index,
    name: generateRuleName(rule, index),
    location: rule.location,
    head: rule.head.patterns,
    originalRule: rule,
  }));
  
  const stratified = stratifyRules(allRules);
  
  const inferredTriples: InferredTriple[] = [];
  const seenTriples = new Set<string>();
  
  for (const quad of baseTriples) {
    seenTriples.add(quadToString(quad));
  }
  
  let totalIterations = 0;
  
  for (const layer of stratified) {
    let layerIteration = 0;
    let changed = true;
    
    while (changed && layerIteration < (opts.maxIterations || 100)) {
      changed = false;
      layerIteration++;
      totalIterations++;
      
      for (const stratRule of layer) {
        const rule = stratRule.rule;
        const ruleInfo = ruleInfos[stratRule.originalIndex];
        
        try {
          const solutions = evaluateRuleBody(rule, store);
          
          for (const solution of solutions) {
            for (const headPattern of rule.head.patterns) {
              const quad = instantiateTriple(headPattern, solution);
              if (quad) {
                const quadStr = quadToString(quad);
                if (!seenTriples.has(quadStr)) {
                  seenTriples.add(quadStr);
                  store.addQuad(quad);
                  inferredTriples.push({
                    quad,
                    quadString: quadStr,
                    sourceRule: ruleInfo,
                    iteration: totalIterations,
                  });
                  changed = true;
                }
              }
            }
          }
        } catch (e) {
          errors.push(`Error evaluating rule "${ruleInfo.name}": ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }
  
  const executionTime = performance.now() - startTime;
  
  return {
    inferredTriples,
    baseTriples,
    totalTriples: store.size,
    iterations: totalIterations,
    executionTime,
    ruleInfos,
    errors,
  };
}

export function formatTripleForDisplay(quad: Quad, prefixes: Map<string, string>): {
  subject: string;
  predicate: string;
  object: string;
} {
  return {
    subject: formatTermForDisplay(quad.subject as NamedNode | BlankNode | Literal, prefixes),
    predicate: formatTermForDisplay(quad.predicate as NamedNode | BlankNode | Literal, prefixes),
    object: formatTermForDisplay(quad.object as NamedNode | BlankNode | Literal, prefixes),
  };
}

function formatTermForDisplay(term: NamedNode | BlankNode | Literal, prefixes: Map<string, string>): string {
  if (term.termType === 'NamedNode') {
    for (const [prefix, namespace] of prefixes) {
      if (term.value.startsWith(namespace)) {
        const localName = term.value.substring(namespace.length);
        return prefix ? `${prefix}:${localName}` : `:${localName}`;
      }
    }
    return `<${term.value}>`;
  } else if (term.termType === 'Literal') {
    const lit = term as Literal;
    if (lit.language) {
      return `"${lit.value}"@${lit.language}`;
    }
    if (lit.datatype) {
      const dt = lit.datatype.value;
      if (dt === 'http://www.w3.org/2001/XMLSchema#integer' ||
          dt === 'http://www.w3.org/2001/XMLSchema#decimal' ||
          dt === 'http://www.w3.org/2001/XMLSchema#double') {
        return lit.value;
      }
      if (dt === 'http://www.w3.org/2001/XMLSchema#boolean') {
        return lit.value;
      }
      return `"${lit.value}"^^<${dt}>`;
    }
    return `"${lit.value}"`;
  } else if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }
  return String((term as NamedNode).value);
}
