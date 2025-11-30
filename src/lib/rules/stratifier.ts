import { Rule, TriplePattern, BodyElement, NegationElement, RDFTerm } from '../srl/ast';

export interface StratifiedRule {
  rule: Rule;
  originalIndex: number;
  layer: number;
}

interface RuleAnalysis {
  rule: Rule;
  originalIndex: number;
  headPredicates: Set<string>;
  bodyPredicates: Set<string>;
  negatedPredicates: Set<string>;
}

function getPredicateFromTerm(term: RDFTerm): string | null {
  if (term.termType === 'iri') {
    return term.value;
  }
  return null;
}

function isTriplePattern(element: BodyElement): element is TriplePattern {
  return 'subject' in element && 'predicate' in element && 'object' in element;
}

function extractPredicates(patterns: TriplePattern[]): Set<string> {
  const predicates = new Set<string>();
  for (const pattern of patterns) {
    const pred = getPredicateFromTerm(pattern.predicate);
    if (pred) predicates.add(pred);
  }
  return predicates;
}

function isNegation(element: BodyElement): element is NegationElement {
  return 'type' in element && element.type === 'negation';
}

function extractNegatedPredicates(elements: BodyElement[]): Set<string> {
  const predicates = new Set<string>();
  
  for (const element of elements) {
    if (isNegation(element)) {
      for (const nestedElement of element.patterns) {
        if (isTriplePattern(nestedElement)) {
          const pred = getPredicateFromTerm(nestedElement.predicate);
          if (pred) predicates.add(pred);
        }
      }
    }
  }
  
  return predicates;
}

function analyzeRule(rule: Rule, originalIndex: number): RuleAnalysis {
  const headPredicates = extractPredicates(rule.head.patterns);
  
  const bodyPatterns = rule.body.elements.filter(isTriplePattern);
  const bodyPredicates = extractPredicates(bodyPatterns);
  
  const negatedPredicates = extractNegatedPredicates(rule.body.elements);
  
  return {
    rule,
    originalIndex,
    headPredicates,
    bodyPredicates,
    negatedPredicates,
  };
}

export function stratifyRules(rules: Rule[]): StratifiedRule[][] {
  if (rules.length === 0) {
    return [];
  }
  
  const analyses = rules.map((rule, index) => analyzeRule(rule, index));
  
  const hasNegation = analyses.some(a => a.negatedPredicates.size > 0);
  
  if (!hasNegation) {
    return [analyses.map(a => ({
      rule: a.rule,
      originalIndex: a.originalIndex,
      layer: 0,
    }))];
  }
  
  const predicateToProducingRules = new Map<string, number[]>();
  for (const analysis of analyses) {
    for (const pred of analysis.headPredicates) {
      const existing = predicateToProducingRules.get(pred) || [];
      existing.push(analysis.originalIndex);
      predicateToProducingRules.set(pred, existing);
    }
  }
  
  const layers: number[] = new Array(rules.length).fill(0);
  let changed = true;
  let iterations = 0;
  const maxIterations = rules.length * 2;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    for (const analysis of analyses) {
      let requiredLayer = 0;
      
      for (const bodyPred of analysis.bodyPredicates) {
        const producers = predicateToProducingRules.get(bodyPred) || [];
        for (const producerIdx of producers) {
          if (producerIdx !== analysis.originalIndex) {
            requiredLayer = Math.max(requiredLayer, layers[producerIdx]);
          }
        }
      }
      
      for (const negPred of analysis.negatedPredicates) {
        const producers = predicateToProducingRules.get(negPred) || [];
        for (const producerIdx of producers) {
          requiredLayer = Math.max(requiredLayer, layers[producerIdx] + 1);
        }
      }
      
      if (requiredLayer > layers[analysis.originalIndex]) {
        layers[analysis.originalIndex] = requiredLayer;
        changed = true;
      }
    }
  }
  
  const maxLayer = Math.max(...layers);
  const layerGroups: StratifiedRule[][] = [];
  
  for (let i = 0; i <= maxLayer; i++) {
    const layerRules: StratifiedRule[] = [];
    for (const analysis of analyses) {
      if (layers[analysis.originalIndex] === i) {
        layerRules.push({
          rule: analysis.rule,
          originalIndex: analysis.originalIndex,
          layer: i,
        });
      }
    }
    if (layerRules.length > 0) {
      layerGroups.push(layerRules);
    }
  }
  
  return layerGroups;
}

export function isStratifiable(rules: Rule[]): { stratifiable: boolean; reason?: string } {
  const analyses = rules.map((rule, index) => analyzeRule(rule, index));
  
  for (const analysis of analyses) {
    for (const negPred of analysis.negatedPredicates) {
      if (analysis.headPredicates.has(negPred)) {
        return {
          stratifiable: false,
          reason: `Rule ${analysis.originalIndex + 1} has self-negation through predicate ${negPred}`,
        };
      }
    }
  }
  
  const predicateToProducingRules = new Map<string, number[]>();
  for (const analysis of analyses) {
    for (const pred of analysis.headPredicates) {
      const existing = predicateToProducingRules.get(pred) || [];
      existing.push(analysis.originalIndex);
      predicateToProducingRules.set(pred, existing);
    }
  }
  
  const graph = new Map<number, Set<number>>();
  const negEdges = new Map<number, Set<number>>();
  
  for (const analysis of analyses) {
    for (const bodyPred of analysis.bodyPredicates) {
      const producers = predicateToProducingRules.get(bodyPred) || [];
      for (const producer of producers) {
        if (!graph.has(producer)) {
          graph.set(producer, new Set());
        }
        graph.get(producer)!.add(analysis.originalIndex);
      }
    }
    
    for (const negPred of analysis.negatedPredicates) {
      const producers = predicateToProducingRules.get(negPred) || [];
      for (const producer of producers) {
        if (!negEdges.has(producer)) {
          negEdges.set(producer, new Set());
        }
        negEdges.get(producer)!.add(analysis.originalIndex);
      }
    }
  }
  
  return { stratifiable: true };
}
