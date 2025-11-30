import { Store, Quad, NamedNode, Literal, BlankNode, DefaultGraph, Term, DataFactory } from 'n3';
import { TriplePattern, RDFTerm, VariableTerm } from '../srl/ast';

const { namedNode, literal, blankNode } = DataFactory;

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

export function isVariable(term: RDFTerm): term is VariableTerm {
  return term.termType === 'variable';
}

export function getPatternVariables(pattern: TriplePattern): string[] {
  const vars: string[] = [];
  if (isVariable(pattern.subject)) vars.push(pattern.subject.value);
  if (isVariable(pattern.predicate)) vars.push(pattern.predicate.value);
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
  const solutions: SolutionMapping[] = [];
  
  const subjectTerm = isVariable(pattern.subject) ? null : termToN3(pattern.subject);
  const predicateTerm = isVariable(pattern.predicate) ? null : termToN3(pattern.predicate);
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
      solution[pattern.predicate.value] = quad.predicate;
    }
    if (isVariable(pattern.object)) {
      solution[pattern.object.value] = quad.object;
    }
    
    solutions.push(solution);
  }
  
  return solutions;
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
    predicate: substituteTerm(pattern.predicate, solution),
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

export function instantiateTriple(
  pattern: TriplePattern,
  solution: SolutionMapping
): Quad | null {
  const subject = substituteTerm(pattern.subject, solution);
  const predicate = substituteTerm(pattern.predicate, solution);
  const object = substituteTerm(pattern.object, solution);
  
  if (isVariable(subject) || isVariable(predicate) || isVariable(object)) {
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
  const p = pattern.predicate.termType === 'variable' ? `?${pattern.predicate.value}` :
            pattern.predicate.termType === 'iri' ? `<${pattern.predicate.value}>` : pattern.predicate.value;
  const o = pattern.object.termType === 'variable' ? `?${pattern.object.value}` :
            pattern.object.termType === 'iri' ? `<${pattern.object.value}>` :
            pattern.object.termType === 'literal' ? `"${pattern.object.value}"` : pattern.object.value;
  return `${s} ${p} ${o}`;
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
