import { Store, Quad, NamedNode, Literal, BlankNode, DefaultGraph, Term, DataFactory } from 'n3';
import { TriplePattern, RDFTerm, VariableTerm, PathExpression } from '../srl/ast';

const { namedNode, literal, blankNode } = DataFactory;

const MAX_PATH_DEPTH = 100;

export interface SolutionMapping {
  [varName: string]: Term;
}

export function termToN3(term: RDFTerm): Term | null {
  switch (term.termType) {
    case 'iri':
      return namedNode(term.value);
    case 'literal':
      if (term.language) {
        return literal(term.value, term.language);
      } else if (term.datatype) {
        return literal(term.value, namedNode(term.datatype));
      }
      return literal(term.value);
    case 'blankNode':
      return blankNode(term.value.startsWith('_:') ? term.value.substring(2) : term.value);
    case 'variable':
      return null;
    default:
      return null;
  }
}

export function n3TermToRDFTerm(term: Term): RDFTerm {
  if (term.termType === 'NamedNode') {
    return { termType: 'iri', value: term.value };
  } else if (term.termType === 'Literal') {
    const lit = term as Literal;
    return {
      termType: 'literal',
      value: lit.value,
      datatype: lit.datatype?.value,
      language: lit.language || undefined,
    };
  } else if (term.termType === 'BlankNode') {
    return { termType: 'blankNode', value: `_:${term.value}` };
  }
  throw new Error(`Unknown term type: ${term.termType}`);
}

export function isVariable(term: RDFTerm | PathExpression): term is VariableTerm {
  return 'termType' in term && term.termType === 'variable';
}

export function isRDFTerm(term: RDFTerm | PathExpression): term is RDFTerm {
  return 'termType' in term;
}

export function getPatternVariables(pattern: TriplePattern): string[] {
  const vars: string[] = [];
  if (isVariable(pattern.subject)) vars.push(pattern.subject.value);
  if (isRDFTerm(pattern.predicate) && isVariable(pattern.predicate)) vars.push(pattern.predicate.value);
  if (isVariable(pattern.object)) vars.push(pattern.object.value);
  return vars;
}

export function compatible(mu1: SolutionMapping, mu2: SolutionMapping): boolean {
  for (const varName of Object.keys(mu1)) {
    if (varName in mu2) {
      if (!termsEqual(mu1[varName], mu2[varName])) {
        return false;
      }
    }
  }
  return true;
}

export function merge(mu1: SolutionMapping, mu2: SolutionMapping): SolutionMapping {
  return { ...mu1, ...mu2 };
}

export function termsEqual(t1: Term, t2: Term): boolean {
  if (t1.termType !== t2.termType) return false;
  if (t1.termType === 'Literal' && t2.termType === 'Literal') {
    const l1 = t1 as Literal;
    const l2 = t2 as Literal;
    return l1.value === l2.value && 
           l1.datatype?.value === l2.datatype?.value &&
           l1.language === l2.language;
  }
  return t1.value === t2.value;
}

export function graphMatch(store: Store, pattern: TriplePattern): SolutionMapping[] {
  // Check if predicate is a path expression
  if ('pathType' in pattern.predicate) {
    return matchPathPattern(store, pattern);
  }
  
  const solutions: SolutionMapping[] = [];
  
  const subjectTerm = isVariable(pattern.subject) ? null : termToN3(pattern.subject);
  const predicateTerm = isVariable(pattern.predicate) ? null : termToN3(pattern.predicate as RDFTerm);
  const objectTerm = isVariable(pattern.object) ? null : termToN3(pattern.object);
  
  const quads = store.getQuads(
    subjectTerm as NamedNode | BlankNode | null,
    predicateTerm as NamedNode | null,
    objectTerm as NamedNode | BlankNode | Literal | null,
    null
  );
  
  for (const quad of quads) {
    const solution: SolutionMapping = {};
    
    if (isVariable(pattern.subject)) {
      solution[pattern.subject.value] = quad.subject;
    }
    if (isVariable(pattern.predicate)) {
      solution[(pattern.predicate as VariableTerm).value] = quad.predicate;
    }
    if (isVariable(pattern.object)) {
      solution[pattern.object.value] = quad.object;
    }
    
    solutions.push(solution);
  }
  
  return solutions;
}

function matchPathPattern(store: Store, pattern: TriplePattern): SolutionMapping[] {
  const path = pattern.predicate as PathExpression;
  const solutions: SolutionMapping[] = [];
  
  // Get all possible subjects
  const subjects: Term[] = [];
  if (isVariable(pattern.subject)) {
    const allQuads = store.getQuads(null, null, null, null);
    const seen = new Set<string>();
    for (const quad of allQuads) {
      if (!seen.has(quad.subject.value)) {
        seen.add(quad.subject.value);
        subjects.push(quad.subject);
      }
    }
  } else {
    const term = termToN3(pattern.subject);
    if (term) subjects.push(term);
  }
  
  // For each subject, find reachable objects via path
  for (const subject of subjects) {
    const reachable = evaluatePath(store, subject, path, 0);
    
    for (const obj of reachable) {
      // Check if object matches pattern.object constraint
      if (!isVariable(pattern.object)) {
        const expectedObj = termToN3(pattern.object);
        if (!expectedObj || !termsEqual(obj, expectedObj)) continue;
      }
      
      const solution: SolutionMapping = {};
      if (isVariable(pattern.subject)) {
        solution[pattern.subject.value] = subject;
      }
      if (isVariable(pattern.object)) {
        solution[pattern.object.value] = obj;
      }
      solutions.push(solution);
    }
  }
  
  return solutions;
}

function evaluatePath(store: Store, start: Term, path: PathExpression, depth: number): Term[] {
  if (depth > MAX_PATH_DEPTH) return [];
  
  switch (path.pathType) {
    case 'iri': {
      const pred = namedNode(path.value);
      const quads = store.getQuads(start as NamedNode | BlankNode, pred, null, null);
      return quads.map(q => q.object);
    }
    
    case 'variable': {
      // Variable in path position - match any predicate
      const quads = store.getQuads(start as NamedNode | BlankNode, null, null, null);
      return quads.map(q => q.object);
    }
    
    case 'sequence': {
      let current: Term[] = [start];
      for (const element of path.elements) {
        const next: Term[] = [];
        for (const term of current) {
          next.push(...evaluatePath(store, term, element, depth + 1));
        }
        current = next;
      }
      return current;
    }
    
    case 'alternative': {
      const results: Term[] = [];
      const seen = new Set<string>();
      for (const option of path.options) {
        for (const term of evaluatePath(store, start, option, depth + 1)) {
          if (!seen.has(term.value)) {
            seen.add(term.value);
            results.push(term);
          }
        }
      }
      return results;
    }
    
    case 'inverse': {
      // Find all subjects where the start node is the object
      return evaluateInversePath(store, start, path.path, depth + 1);
    }
    
    case 'zeroOrMore': {
      return evaluateZeroOrMore(store, start, path.path, depth);
    }
    
    case 'oneOrMore': {
      return evaluateOneOrMore(store, start, path.path, depth);
    }
    
    case 'zeroOrOne': {
      const result = [start];
      result.push(...evaluatePath(store, start, path.path, depth + 1));
      return [...new Set(result.map(t => t.value))].map(v => 
        result.find(t => t.value === v)!
      );
    }
    
    case 'negatedPropertySet': {
      const excluded = new Set(path.iris.filter(i => !i.inverse).map(i => i.iri));
      const excludedInverse = new Set(path.iris.filter(i => i.inverse).map(i => i.iri));
      
      const results: Term[] = [];
      const quads = store.getQuads(start as NamedNode | BlankNode, null, null, null);
      
      for (const quad of quads) {
        if (!excluded.has(quad.predicate.value)) {
          results.push(quad.object);
        }
      }
      
      // Also get inverse matches (where start is object and predicate is NOT in excludedInverse)
      if (excludedInverse.size > 0) {
        const inverseQuads = store.getQuads(null, null, start, null);
        for (const quad of inverseQuads) {
          if (!excludedInverse.has(quad.predicate.value)) {
            results.push(quad.subject);
          }
        }
      }
      
      return results;
    }
    
    default:
      return [];
  }
}

function evaluateInversePath(store: Store, end: Term, path: PathExpression, depth: number): Term[] {
  if (depth > MAX_PATH_DEPTH) return [];
  
  switch (path.pathType) {
    case 'iri': {
      const pred = namedNode(path.value);
      const quads = store.getQuads(null, pred, end, null);
      return quads.map(q => q.subject);
    }
    
    case 'variable': {
      const quads = store.getQuads(null, null, end, null);
      return quads.map(q => q.subject);
    }
    
    case 'sequence': {
      // Reverse the sequence and evaluate
      let current: Term[] = [end];
      for (let i = path.elements.length - 1; i >= 0; i--) {
        const next: Term[] = [];
        for (const term of current) {
          next.push(...evaluateInversePath(store, term, path.elements[i], depth + 1));
        }
        current = next;
      }
      return current;
    }
    
    case 'alternative': {
      const results: Term[] = [];
      const seen = new Set<string>();
      for (const option of path.options) {
        for (const term of evaluateInversePath(store, end, option, depth + 1)) {
          if (!seen.has(term.value)) {
            seen.add(term.value);
            results.push(term);
          }
        }
      }
      return results;
    }
    
    case 'inverse': {
      // Double inverse = forward
      return evaluatePath(store, end, path.path, depth + 1);
    }
    
    default:
      return [];
  }
}

function evaluateZeroOrMore(store: Store, start: Term, path: PathExpression, depth: number): Term[] {
  const results: Term[] = [start];
  const seen = new Set<string>([start.value]);
  const queue: Term[] = [start];
  let iterations = 0;
  
  while (queue.length > 0 && iterations < MAX_PATH_DEPTH) {
    iterations++;
    const current = queue.shift()!;
    const next = evaluatePath(store, current, path, depth + 1);
    
    for (const term of next) {
      if (!seen.has(term.value)) {
        seen.add(term.value);
        results.push(term);
        queue.push(term);
      }
    }
  }
  
  return results;
}

function evaluateOneOrMore(store: Store, start: Term, path: PathExpression, depth: number): Term[] {
  const initial = evaluatePath(store, start, path, depth + 1);
  const results: Term[] = [...initial];
  const seen = new Set<string>(initial.map(t => t.value));
  const queue: Term[] = [...initial];
  let iterations = 0;
  
  while (queue.length > 0 && iterations < MAX_PATH_DEPTH) {
    iterations++;
    const current = queue.shift()!;
    const next = evaluatePath(store, current, path, depth + 1);
    
    for (const term of next) {
      if (!seen.has(term.value)) {
        seen.add(term.value);
        results.push(term);
        queue.push(term);
      }
    }
  }
  
  return results;
}

export function joinSolutions(
  existing: SolutionMapping[],
  patterns: TriplePattern[],
  store: Store
): SolutionMapping[] {
  let solutions = existing;
  
  for (const pattern of patterns) {
    const newSolutions: SolutionMapping[] = [];
    const matches = graphMatch(store, substitutePattern(pattern, {}));
    
    if (solutions.length === 0) {
      newSolutions.push(...matches);
    } else {
      for (const mu1 of solutions) {
        const substitutedPattern = substitutePattern(pattern, mu1);
        const patternMatches = graphMatch(store, substitutedPattern);
        
        for (const mu2 of patternMatches) {
          if (compatible(mu1, mu2)) {
            newSolutions.push(merge(mu1, mu2));
          }
        }
      }
    }
    
    solutions = newSolutions;
  }
  
  return solutions;
}

export function substitutePattern(pattern: TriplePattern, solution: SolutionMapping): TriplePattern {
  return {
    subject: substituteTerm(pattern.subject, solution),
    predicate: substitutePredicateTerm(pattern.predicate, solution),
    object: substituteTerm(pattern.object, solution),
    location: pattern.location,
  };
}

export function substituteTerm(term: RDFTerm, solution: SolutionMapping): RDFTerm {
  if (isVariable(term) && term.value in solution) {
    return n3TermToRDFTerm(solution[term.value]);
  }
  return term;
}

function substitutePredicateTerm(term: RDFTerm | PathExpression, solution: SolutionMapping): RDFTerm | PathExpression {
  if (isRDFTerm(term) && isVariable(term) && term.value in solution) {
    return n3TermToRDFTerm(solution[term.value]);
  }
  return term;
}

export function instantiateTriple(
  pattern: TriplePattern,
  solution: SolutionMapping
): Quad | null {
  const subject = substituteTerm(pattern.subject, solution);
  const predicate = substitutePredicateTerm(pattern.predicate, solution);
  const object = substituteTerm(pattern.object, solution);
  
  // Cannot instantiate if we still have variables or path expressions
  if (isVariable(subject) || isVariable(object)) {
    return null;
  }
  
  // For predicate, we need an RDF term (IRI), not a path expression
  if (!isRDFTerm(predicate) || isVariable(predicate)) {
    return null;
  }
  
  const subjectN3 = termToN3(subject);
  const predicateN3 = termToN3(predicate);
  const objectN3 = termToN3(object);
  
  if (!subjectN3 || !predicateN3 || !objectN3) {
    return null;
  }
  
  return new Quad(
    subjectN3 as NamedNode | BlankNode,
    predicateN3 as NamedNode,
    objectN3 as NamedNode | BlankNode | Literal,
    new DefaultGraph()
  );
}

export function quadToString(quad: Quad): string {
  return `${termToString(quad.subject)} ${termToString(quad.predicate)} ${termToString(quad.object)}`;
}

export function termToString(term: Term): string {
  if (term.termType === 'NamedNode') {
    return `<${term.value}>`;
  } else if (term.termType === 'Literal') {
    const lit = term as Literal;
    if (lit.language) {
      return `"${lit.value}"@${lit.language}`;
    } else if (lit.datatype && lit.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
      return `"${lit.value}"^^<${lit.datatype.value}>`;
    }
    return `"${lit.value}"`;
  } else if (term.termType === 'BlankNode') {
    return `_:${term.value}`;
  }
  return term.value;
}

export function triplePatternToString(pattern: TriplePattern): string {
  const s = pattern.subject.termType === 'variable' ? `?${pattern.subject.value}` : 
            pattern.subject.termType === 'iri' ? `<${pattern.subject.value}>` : pattern.subject.value;
  
  let p: string;
  if (isRDFTerm(pattern.predicate)) {
    p = pattern.predicate.termType === 'variable' ? `?${pattern.predicate.value}` :
        pattern.predicate.termType === 'iri' ? `<${pattern.predicate.value}>` : pattern.predicate.value;
  } else {
    // Path expression - format based on type
    p = formatPathExpression(pattern.predicate);
  }
  
  const o = pattern.object.termType === 'variable' ? `?${pattern.object.value}` :
            pattern.object.termType === 'iri' ? `<${pattern.object.value}>` :
            pattern.object.termType === 'literal' ? `"${pattern.object.value}"` : pattern.object.value;
  return `${s} ${p} ${o}`;
}

function formatPathExpression(path: PathExpression): string {
  switch (path.pathType) {
    case 'iri':
      return `<${path.value}>`;
    case 'variable':
      return `?${path.name}`;
    case 'sequence':
      return path.elements.map(formatPathExpression).join('/');
    case 'alternative':
      return `(${path.options.map(formatPathExpression).join('|')})`;
    case 'inverse':
      return `^${formatPathExpression(path.path)}`;
    case 'zeroOrMore':
      return `${formatPathExpression(path.path)}*`;
    case 'oneOrMore':
      return `${formatPathExpression(path.path)}+`;
    case 'zeroOrOne':
      return `${formatPathExpression(path.path)}?`;
    case 'negatedPropertySet':
      return `!(${path.iris.map(i => i.inverse ? `^<${i.iri}>` : `<${i.iri}>`).join('|')})`;
    default:
      return '[path]';
  }
}

export class PatternMatcher {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  match(patterns: TriplePattern[]): SolutionMapping[] {
    return joinSolutions([{}], patterns, this.store);
  }

  matchWithNegation(
    positivePatterns: TriplePattern[],
    negativePatterns: TriplePattern[][]
  ): SolutionMapping[] {
    let solutions = this.match(positivePatterns);
    
    for (const negPatterns of negativePatterns) {
      solutions = solutions.filter(solution => {
        const negSubstituted = negPatterns.map(p => substitutePattern(p, solution));
        const negMatches = joinSolutions([{}], negSubstituted, this.store);
        return negMatches.length === 0;
      });
    }
    
    return solutions;
  }

  hasMatch(patterns: TriplePattern[], solution: SolutionMapping): boolean {
    const substituted = patterns.map(p => substitutePattern(p, solution));
    const matches = joinSolutions([{}], substituted, this.store);
    return matches.length > 0;
  }
}
