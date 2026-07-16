import { Store, Quad, Parser as N3Parser, NamedNode, Literal, BlankNode, DataFactory } from 'n3';
import {
  RuleSet,
  Rule,
  TargetedRule,
  TriplePattern,
  BodyElement,
  Declaration,
  SourceLocation,
  RDFTerm
} from '../srl/ast';
import {
  SolutionMapping,
  instantiateTriple,
  quadToString,
  substitutePattern,
  joinSolutions,
  isVariable,
  isRDFTerm
} from './pattern-matcher';
import { evaluateFilter, evaluateExpression, resultToTerm, setCurrentStore, setCurrentNow } from './expression-evaluator';
import { stratifyRules, StratificationLayer, StratifiedRule, isRunOnce } from './stratifier';
import { focusNodes } from '../shapes/targets';
import { conforms } from '../shapes/validate';
import { loadShape } from '../shapes/model';

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
  extensions?: boolean;
  shapesGraph?: string;
  shapesStore?: Store;
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

// Evaluate a body element sequence left-to-right (spec §6.4), folding each
// element into the running solution set. Order matters: a FILTER or SET only
// sees variables bound by strictly-earlier elements, so grouping by kind would
// mis-evaluate e.g. `SET(?x := …) FILTER(?x > 0)`.
function evaluateElements(
  elements: BodyElement[],
  initial: SolutionMapping[],
  store: Store
): SolutionMapping[] {
  let solutions = initial;

  for (const element of elements) {
    if (isTriplePattern(element)) {
      // Join this pattern against the current solutions (substituting bound vars).
      const next: SolutionMapping[] = [];
      for (const sol of solutions) {
        const substituted = substitutePattern(element, sol);
        for (const match of joinSolutions([{}], [substituted], store)) {
          next.push({ ...sol, ...match });
        }
      }
      solutions = next;
    } else if (element.type === 'filter') {
      solutions = solutions.filter(sol => evaluateFilter(element.expression, sol));
    } else if (element.type === 'assignment') {
      const { variable, expression } = element;
      solutions = solutions
        .map(sol => {
          const term = resultToTerm(evaluateExpression(expression, sol));
          return term ? { ...sol, [variable]: term } : sol;
        })
        // SET drops the solution when the expression errors (spec §3.9).
        .filter(sol => variable in sol);
    } else if (element.type === 'negation') {
      // Negation-as-failure: keep μ iff seeding the negation body with {μ}
      // yields no solutions.
      solutions = solutions.filter(
        sol => evaluateElements(element.patterns, [sol], store).length === 0
      );
    }
  }

  return solutions;
}

function evaluateRuleBody(rule: Rule, store: Store): SolutionMapping[] {
  return evaluateElements(rule.body.elements, [{}], store);
}

function generateRuleName(rule: Rule, index: number): string {
  if (rule.name) return rule.name;
  
  const headPatterns = rule.head.patterns;
  if (headPatterns.length > 0) {
    const firstPattern = headPatterns[0];
    const pred = firstPattern.predicate;
    if (isRDFTerm(pred) && pred.termType === 'iri') {
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

  // G0 — the base graph from the RDF editor.
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

  const expandedRules = expandDeclarations(ruleSet.declarations, ruleSet.prefixes);
  const allRules = [...ruleSet.rules, ...expandedRules];

  const ruleInfos: RuleInfo[] = allRules.map((rule, index) => ({
    index,
    name: generateRuleName(rule, index),
    location: rule.location,
    head: rule.head.patterns,
    originalRule: rule,
  }));

  // Resolve the shapes graph (opt-in targeting). shapesStore wins if both given.
  let shapesStore: Store | undefined = opts.shapesStore;
  if (!shapesStore && opts.shapesGraph) {
    try {
      shapesStore = new Store();
      shapesStore.addQuads(new N3Parser().parse(opts.shapesGraph));
    } catch (e) {
      errors.push(`Failed to parse shapes graph: ${e instanceof Error ? e.message : String(e)}`);
      shapesStore = undefined;
    }
  }
  const targetedRules = ruleSet.targetedRules ?? [];
  if (targetedRules.length > 0 && !shapesStore) {
    errors.push('Targeted rules (FOR ?v IN <shape>) require a shapes graph; pass options.shapesGraph or options.shapesStore.');
  }

  const targetedRuleInfos = new Map<TargetedRule, RuleInfo>();
  targetedRules.forEach((tr, t) => {
    targetedRuleInfos.set(tr, {
      index: allRules.length + 1 + t,
      name: tr.rule.name ?? `Targeted rule ${t + 1} (FOR ?${tr.focusVar})`,
      location: tr.location,
      head: tr.rule.head.patterns,
      originalRule: tr.rule,
    });
  });

  let stratified: StratificationLayer[] = [];
  try {
    stratified = stratifyRules(allRules, shapesStore ? targetedRules : [], shapesStore);
  } catch (e) {
    errors.push(`Stratification failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const inferredTriples: InferredTriple[] = [];
  const seenTriples = new Set<string>();

  for (const quad of baseTriples) {
    seenTriples.add(quadToString(quad));
  }

  // DATA blocks seed the inference graph GI = { t ∈ D | t ∉ G0 } (spec §6.5):
  // ground DATA triples not already in the base graph count as inferred output.
  // They are attributed to a synthetic "DATA" pseudo-rule so the results panel
  // can group them.
  if (ruleSet.dataBlocks.length > 0) {
    const firstBlock = ruleSet.dataBlocks[0];
    const dataRuleInfo: RuleInfo = {
      index: allRules.length,
      name: 'DATA block',
      location: firstBlock.location,
      head: [],
      originalRule: { type: 'rule', head: { patterns: [] }, body: { elements: [] } },
    };
    let hasDataTriple = false;

    for (const dataBlock of ruleSet.dataBlocks) {
      for (const pattern of dataBlock.patterns) {
        // DATA must be ground: no variables, no property paths.
        const pred = pattern.predicate;
        if (!isVariable(pattern.subject) && isRDFTerm(pred) && !isVariable(pred) && !isVariable(pattern.object)) {
          const quad = instantiateTriple(pattern, {});
          if (quad) {
            store.addQuad(quad);
            const quadStr = quadToString(quad);
            if (!seenTriples.has(quadStr)) {
              seenTriples.add(quadStr);
              hasDataTriple = true;
              inferredTriples.push({
                quad,
                quadString: quadStr,
                sourceRule: dataRuleInfo,
                iteration: 0,
              });
            }
          }
        }
      }
    }

    if (hasDataTriple) {
      ruleInfos.push(dataRuleInfo);
    }
  }

  // Set the current store for pattern evaluation, and pin NOW() to a single
  // instant for the whole rule-set evaluation (spec: NOW is constant per run).
  setCurrentStore(store);
  setCurrentNow(new Date());

  let totalIterations = 0;

  // Instantiate a rule's head for every solution; record any genuinely new
  // inferred triple. Returns true if at least one new triple was produced.
  const applyRule = (stratRule: StratifiedRule): boolean => {
    const rule = stratRule.rule;
    const ruleInfo = ruleInfos[stratRule.originalIndex];
    let produced = false;

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
              produced = true;
            }
          }
        }
      }
    } catch (e) {
      errors.push(`Error evaluating rule "${ruleInfo.name}": ${e instanceof Error ? e.message : String(e)}`);
    }

    return produced;
  };

  const applyTargetedRule = (tr: TargetedRule): boolean => {
    if (!shapesStore) return false;
    const ruleInfo = targetedRuleInfos.get(tr)!;
    let produced = false;
    try {
      const shape = loadShape(shapesStore, DataFactory.namedNode(tr.shape));
      const candidates = focusNodes(shape, store, shapesStore);
      for (const node of candidates) {
        if (!conforms(node, shape, store, shapesStore)) continue;
        const seed: SolutionMapping = { [tr.focusVar]: node };
        const solutions = evaluateElements(tr.rule.body.elements, [seed], store);
        for (const solution of solutions) {
          for (const headPattern of tr.rule.head.patterns) {
            const quad = instantiateTriple(headPattern, solution);
            if (quad) {
              const quadStr = quadToString(quad);
              if (!seenTriples.has(quadStr)) {
                seenTriples.add(quadStr);
                store.addQuad(quad);
                inferredTriples.push({ quad, quadString: quadStr, sourceRule: ruleInfo, iteration: totalIterations });
                produced = true;
              }
            }
          }
        }
      }
    } catch (e) {
      errors.push(`Error evaluating targeted rule "${ruleInfo?.name ?? tr.shape}": ${e instanceof Error ? e.message : String(e)}`);
    }
    return produced;
  };

  for (const layer of stratified) {
    // Run-once rules (assignment or blank-node head) fire exactly once, before
    // the general rules of the same stratum iterate to a fixpoint.
    totalIterations++;
    for (const stratRule of layer.once) {
      applyRule(stratRule);
    }
    for (const st of layer.targeted) {
      if (isRunOnce(st.targetedRule.rule)) applyTargetedRule(st.targetedRule);
    }

    const generalTargeted = layer.targeted.filter(st => !isRunOnce(st.targetedRule.rule));
    let layerIteration = 0;
    let changed = layer.general.length > 0 || generalTargeted.length > 0;

    while (changed && layerIteration < (opts.maxIterations || 100)) {
      changed = false;
      layerIteration++;
      totalIterations++;

      for (const stratRule of layer.general) {
        if (applyRule(stratRule)) {
          changed = true;
        }
      }
      for (const st of generalTargeted) {
        if (applyTargetedRule(st.targetedRule)) changed = true;
      }
    }
  }

  // Include targeted-rule provenance entries in the returned rule list so
  // consumers grouping inferred triples by rule can resolve targeted rules too.
  for (const info of targetedRuleInfos.values()) {
    ruleInfos.push(info);
  }

  const executionTime = performance.now() - startTime;

  // Clear the module-level execution state.
  setCurrentStore(null);
  setCurrentNow(null);

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
