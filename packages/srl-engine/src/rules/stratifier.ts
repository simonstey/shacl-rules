import { Store, DataFactory } from 'n3';
import { Rule, TargetedRule, TriplePattern, BodyElement, NegationElement, RDFTerm, PathExpression } from '../srl/ast';
import { isRDFTerm, isVariable, isTriplePattern } from './pattern-matcher';
import { NodeShape, loadShape } from '../shapes/model';

/**
 * Dependency graph and stratification for SHACL 1.2 Rules.
 *
 * Implements the spec's #rule-dependency, #dependency-graph, #stratification,
 * #stratification-condition and #stratification-algorithm sections (mirroring
 * the py-srl reference `engine/stratification.py`).
 *
 * The dependency graph has one vertex per rule and edges labeled "open" or
 * "closed". A dependency of R1 on R2 is *closed* if:
 *   (a) a triple pattern inside a negation element of R1 matches R2's head; or
 *   (b) R1 has an assignment element; or
 *   (c) R1's head contains a blank node.
 * Otherwise it is *open*.
 *
 * Stratification partitions the rules into ordered layers; each layer is a pair
 * (once, general). Run-once rules (assignment element or blank node in the head)
 * are evaluated exactly once before the general rules iterate to a fixpoint. The
 * stratification condition forbids any cycle containing a closed edge.
 */

const OPEN = 'open';
const CLOSED = 'closed';
type EdgeLabel = typeof OPEN | typeof CLOSED;

export interface StratifiedRule {
  rule: Rule;
  originalIndex: number;
}

export interface StratifiedTargetedRule {
  targetedRule: TargetedRule;
  originalIndex: number;
}

/** A stratification layer: disjoint sets of run-once, general, and targeted rules. */
export interface StratificationLayer {
  once: StratifiedRule[];
  general: StratifiedRule[];
  targeted: StratifiedTargetedRule[];
}

export interface StratificationCheck {
  stratifiable: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Shape predicate helpers
// ---------------------------------------------------------------------------

const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Returns the set of predicate IRIs a shape reads when evaluating conformance.
 * Port of py-srl `shape_referenced_predicates`.
 */
export function shapeReferencedPredicates(shape: NodeShape): Set<string> {
  const preds = new Set<string>();
  for (const [name, obj] of shape.targets) {
    if (name === 'targetClass') {
      preds.add(RDF_TYPE_IRI);
    } else if (name === 'targetSubjectsOf' || name === 'targetObjectsOf') {
      if (obj.termType === 'NamedNode') preds.add(obj.value);
    }
  }
  for (const c of shape.constraints) {
    if (c.kind === 'class') preds.add(RDF_TYPE_IRI);
  }
  for (const ps of shape.propertyShapes) {
    if (ps.path && ps.path.termType === 'NamedNode') preds.add(ps.path.value);
    for (const c of ps.constraints) {
      if (c.kind === 'class') preds.add(RDF_TYPE_IRI);
    }
  }
  return preds;
}

/** Extracts predicate IRIs asserted by a rule's head. */
function headPredicateIris(rule: Rule): { iris: Set<string>; hasVar: boolean } {
  const iris = new Set<string>();
  let hasVar = false;
  for (const p of rule.head.patterns) {
    const pred = p.predicate;
    if (isRDFTerm(pred)) {
      if (pred.termType === 'iri') iris.add(pred.value);
      else if (pred.termType === 'variable') hasVar = true;
    } else {
      // path in head is not valid in template family; treat as var-like
      hasVar = true;
    }
  }
  return { iris, hasVar };
}

function termForShape(iri: string) {
  return DataFactory.namedNode(iri);
}

// ---------------------------------------------------------------------------
// Term / path helpers
// ---------------------------------------------------------------------------

/** IRIs a property path could traverse (for matching purposes). */
function pathPredicateIris(path: PathExpression): Set<string> {
  switch (path.pathType) {
    case 'iri':
      return new Set([path.value]);
    case 'inverse':
      return pathPredicateIris(path.path);
    case 'sequence': {
      const iris = new Set<string>();
      for (const e of path.elements) {
        for (const iri of pathPredicateIris(e)) iris.add(iri);
      }
      return iris;
    }
    default:
      return new Set();
  }
}

function termsEqual(a: RDFTerm, b: RDFTerm): boolean {
  if (a.termType !== b.termType) return false;
  if (a.termType === 'literal' && b.termType === 'literal') {
    return a.value === b.value && a.datatype === b.datatype && a.language === b.language;
  }
  return a.value === b.value;
}

/**
 * A template term can possibly generate a pattern term if either is a variable,
 * both are the same RDF term, or a pattern property path shares an IRI with an
 * IRI template predicate.
 */
function termsCanMatch(patTerm: RDFTerm | PathExpression, tmplTerm: RDFTerm | PathExpression): boolean {
  if (isVariable(patTerm) || isVariable(tmplTerm)) return true;

  // Property path in the pattern predicate position: compare via its IRIs.
  if (!isRDFTerm(patTerm)) {
    const iris = pathPredicateIris(patTerm);
    if (isRDFTerm(tmplTerm) && tmplTerm.termType === 'iri') {
      return iris.has(tmplTerm.value);
    }
    return true; // variable/other template predicate could match
  }

  // Pattern term is an RDF term; template term must be too to compare.
  if (!isRDFTerm(tmplTerm)) return false;
  return termsEqual(patTerm, tmplTerm);
}

/** Two path/term predicates are the same variable. */
function sameVariable(a: RDFTerm | PathExpression, b: RDFTerm | PathExpression): boolean {
  return isVariable(a) && isVariable(b) && a.value === b.value;
}

/**
 * True if a triple template could possibly generate a triple matching a triple
 * pattern. All three positions must be compatible, and if two template positions
 * carry the same variable, the corresponding pattern positions must agree.
 */
function possiblyMatches(pattern: TriplePattern, template: TriplePattern): boolean {
  const pPos: Array<RDFTerm | PathExpression> = [pattern.subject, pattern.predicate, pattern.object];
  const tPos: Array<RDFTerm | PathExpression> = [template.subject, template.predicate, template.object];

  for (let i = 0; i < 3; i++) {
    if (!termsCanMatch(pPos[i], tPos[i])) return false;
  }

  // Repeated-variable constraint on the template side: when two template
  // positions share a variable, the pattern positions must agree — either share
  // a variable, or be the same RDF term.
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (sameVariable(tPos[i], tPos[j])) {
        const a = pPos[i];
        const b = pPos[j];
        if (isVariable(a) || isVariable(b)) continue;
        if (!(isRDFTerm(a) && isRDFTerm(b) && termsEqual(a, b))) return false;
      }
    }
  }
  return true;
}

function isNegation(element: BodyElement): element is NegationElement {
  return 'type' in element && element.type === 'negation';
}

// ---------------------------------------------------------------------------
// Run-once classification (spec #run-once-rule)
// ---------------------------------------------------------------------------

export function hasAssignment(rule: Rule): boolean {
  return rule.body.elements.some(e => 'type' in e && e.type === 'assignment');
}

function termHasBlankNode(term: RDFTerm | PathExpression): boolean {
  return isRDFTerm(term) && term.termType === 'blankNode';
}

export function headHasBlankNode(rule: Rule): boolean {
  return rule.head.patterns.some(
    p => termHasBlankNode(p.subject) || termHasBlankNode(p.predicate) || termHasBlankNode(p.object)
  );
}

/** A run-once rule uses an assignment element OR produces a blank node in the head. */
export function isRunOnce(rule: Rule): boolean {
  return hasAssignment(rule) || headHasBlankNode(rule);
}

// ---------------------------------------------------------------------------
// Dependency graph construction (#dependency-graph-construction-algorithm)
// ---------------------------------------------------------------------------

function mergeLabel(oldLabel: EdgeLabel, newLabel: EdgeLabel): EdgeLabel {
  return oldLabel === OPEN && newLabel === OPEN ? OPEN : CLOSED;
}

/**
 * Classify each body triple pattern as requiring an "open" or "closed"
 * dependency: patterns inside a negation element are "closed"; plain
 * triple-pattern elements are "open".
 */
function bodyPatternDependencies(rule: Rule): Array<{ pattern: TriplePattern; label: EdgeLabel }> {
  const deps: Array<{ pattern: TriplePattern; label: EdgeLabel }> = [];
  for (const element of rule.body.elements) {
    if (isNegation(element)) {
      for (const pat of element.patterns) {
        if (isTriplePattern(pat)) deps.push({ pattern: pat, label: CLOSED });
      }
    } else if (isTriplePattern(element)) {
      deps.push({ pattern: element, label: OPEN });
    }
  }
  return deps;
}

function patternDependsOnRule(pattern: TriplePattern, rule: Rule): boolean {
  return rule.head.patterns.some(t => possiblyMatches(pattern, t));
}

interface Edge {
  from: number;
  to: number;
  label: EdgeLabel;
}

function buildDependencyGraph(rules: Rule[]): Edge[] {
  // Dedup edges (from,to) into a single record, merging labels (closed wins).
  const labels = new Map<number, EdgeLabel>(); // key = from * n + to

  for (let i = 0; i < rules.length; i++) {
    const r1 = rules[i];
    const bodyDeps = bodyPatternDependencies(r1);

    // A rule with an assignment element, or a blank node in its head, forces
    // every one of its dependencies to be closed.
    const forceClosed = hasAssignment(r1) || headHasBlankNode(r1);

    for (const { pattern, label: depLabel } of bodyDeps) {
      const label: EdgeLabel = forceClosed ? CLOSED : depLabel;
      for (let j = 0; j < rules.length; j++) {
        if (patternDependsOnRule(pattern, rules[j])) {
          const key = i * rules.length + j;
          const existing = labels.get(key);
          labels.set(key, existing ? mergeLabel(existing, label) : label);
        }
      }
    }
  }

  const edges: Edge[] = [];
  for (const [key, label] of labels) {
    edges.push({ from: Math.floor(key / rules.length), to: key % rules.length, label });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Stratification algorithm (#stratification-algorithm)
//
// The stratum-number relaxation is also the stratification-condition check: a
// closed edge on a cycle forces its stratum strictly upward without bound, so
// the fixpoint blows past `limit = n + 1` and throws. No separate cycle scan.
// ---------------------------------------------------------------------------

class StratificationError extends Error {}

function assignStratumNumbers(n: number, edges: Edge[]): number[] {
  const stratum = new Array(n).fill(0);
  const limit = n + 1;

  let changed = true;
  while (changed) {
    changed = false;
    for (const { from: p, to: q, label } of edges) {
      if (label === OPEN) {
        if (stratum[p] < stratum[q]) {
          stratum[p] = stratum[q];
          changed = true;
        }
      } else {
        // CLOSED: stratum(p) > stratum(q)
        if (stratum[p] <= stratum[q]) {
          const next = stratum[q] + 1;
          if (next > limit) {
            throw new StratificationError(
              'Stratification condition violated: a recursive dependency involves a closed ' +
                'dependency (negation, assignment, or blank-node head in a cycle).'
            );
          }
          stratum[p] = next;
          changed = true;
        }
      }
    }
  }

  return stratum;
}

/**
 * Stratify rules into an ordered sequence of (once, general, targeted) layers.
 *
 * When targetedRules and shapesStore are supplied, targeted rules occupy
 * additional vertices in the dependency graph. A CLOSED gate edge is added
 * from each targeted rule vertex to any plain-rule vertex whose head can
 * assert a predicate the shape reads, ensuring the targeted rule fires in a
 * strictly higher stratum than any rule that feeds its shape.
 *
 * Throws if the stratification condition is violated (a cycle containing a
 * closed edge — negation, assignment, blank-node head, or gate edge in a cycle).
 */
export function stratifyRules(
  rules: Rule[],
  targetedRules: TargetedRule[] = [],
  shapesStore?: Store,
): StratificationLayer[] {
  const n = rules.length;
  const m = targetedRules.length;
  if (n === 0 && m === 0) return [];

  const edges = buildDependencyGraph(rules);

  // Targeted rules occupy vertices n..n+m-1 (extension: rule-to-shape targeting).
  if (m > 0) {
    // (vertex id, wrapped Rule) for every vertex — plain and targeted.
    const allVertices: Array<{ vertex: number; rule: Rule }> = [];
    for (let i = 0; i < n; i++) allVertices.push({ vertex: i, rule: rules[i] });
    for (let t = 0; t < m; t++) allVertices.push({ vertex: n + t, rule: targetedRules[t].rule });

    // Add body-pattern dependency edges from srcVertex to every OTHER vertex
    // whose head the pattern could match (open/closed as usual).
    const addBodyDeps = (srcVertex: number, srcRule: Rule): void => {
      const bodyDeps = bodyPatternDependencies(srcRule);
      const forceClosed = hasAssignment(srcRule) || headHasBlankNode(srcRule);
      for (const { pattern, label } of bodyDeps) {
        const lbl: EdgeLabel = forceClosed ? CLOSED : label;
        for (const { vertex: vj, rule: rj } of allVertices) {
          if (vj === srcVertex) continue;
          if (patternDependsOnRule(pattern, rj)) {
            edges.push({ from: srcVertex, to: vj, label: lbl });
          }
        }
      }
    };

    // (1) Targeted rules' bodies may depend on any (plain or targeted) head.
    for (let t = 0; t < m; t++) addBodyDeps(n + t, targetedRules[t].rule);

    // (2) Plain rules' bodies may depend on targeted-rule heads (the plain-only
    // buildDependencyGraph above did not see targeted vertices).
    for (let i = 0; i < n; i++) {
      const bodyDeps = bodyPatternDependencies(rules[i]);
      const forceClosed = hasAssignment(rules[i]) || headHasBlankNode(rules[i]);
      for (const { pattern, label } of bodyDeps) {
        const lbl: EdgeLabel = forceClosed ? CLOSED : label;
        for (let t = 0; t < m; t++) {
          if (patternDependsOnRule(pattern, targetedRules[t].rule)) {
            edges.push({ from: i, to: n + t, label: lbl });
          }
        }
      }
    }

    // (3) Gate: CLOSED edge from each targeted rule to any vertex whose head can
    // assert a predicate its shape reads (places the targeted rule strictly above
    // any rule that could change its shape's conformance verdict).
    if (shapesStore) {
      for (let t = 0; t < m; t++) {
        let refs: Set<string>;
        try {
          const shape = loadShape(shapesStore, termForShape(targetedRules[t].shape));
          refs = shapeReferencedPredicates(shape);
        } catch {
          // Shape failed to load (e.g. unsupported SHACL feature). Skip this
          // targeted rule's gate edges so valid plain-rule stratification still
          // proceeds; the executor's applyTargetedRule will surface the load
          // error per-rule into ExecutionResult.errors at evaluation time.
          continue;
        }
        if (!refs.size) continue;
        for (const { vertex: vj, rule: rj } of allVertices) {
          if (vj === n + t) continue;
          const { iris, hasVar } = headPredicateIris(rj);
          if (hasVar || [...iris].some(iri => refs.has(iri))) {
            edges.push({ from: n + t, to: vj, label: CLOSED });
          }
        }
      }
    }
  }

  const total = n + m;
  const stratum = assignStratumNumbers(total, edges);
  const maxStratum = stratum.length > 0 ? Math.max(...stratum) : 0;

  const layers: StratificationLayer[] = Array.from({ length: maxStratum + 1 }, () => ({
    once: [],
    general: [],
    targeted: [],
  }));

  for (let i = 0; i < n; i++) {
    const entry: StratifiedRule = { rule: rules[i], originalIndex: i };
    if (isRunOnce(rules[i])) {
      layers[stratum[i]].once.push(entry);
    } else {
      layers[stratum[i]].general.push(entry);
    }
  }
  for (let t = 0; t < m; t++) {
    layers[stratum[n + t]].targeted.push({ targetedRule: targetedRules[t], originalIndex: t });
  }

  return layers;
}

/**
 * Check whether a rule set is stratifiable without throwing. Returns a reason
 * when the stratification condition is violated (used by the validator).
 */
export function isStratifiable(rules: Rule[]): StratificationCheck {
  try {
    stratifyRules(rules);
    return { stratifiable: true };
  } catch (e) {
    return {
      stratifiable: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
