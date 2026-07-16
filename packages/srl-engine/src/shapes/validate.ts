import { Store, Term, Literal } from 'n3';
import { NodeShape, PropertyShape, UnsupportedShapeFeatureError } from './model';
import { pyValue, rdfList, termKey, RDF_TYPE, RDFS_SUBCLASSOF, SH, XSD } from './rdf-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function subclassOf(sub: Term, sup: Term, store: Store): boolean {
  if (termKey(sub) === termKey(sup)) return true;
  const seen = new Set<string>();
  const frontier: Term[] = [sub];
  while (frontier.length) {
    const cur = frontier.pop() as Term;
    if (seen.has(termKey(cur))) continue;
    seen.add(termKey(cur));
    for (const q of store.getQuads(cur as never, RDFS_SUBCLASSOF as never, null, null)) {
      if (termKey(q.object) === termKey(sup)) return true;
      frontier.push(q.object);
    }
  }
  return false;
}

function isInstance(node: Term, cls: Term, store: Store): boolean {
  return store.getQuads(node as never, RDF_TYPE as never, null, null)
    .some(q => subclassOf(q.object, cls, store));
}

const NODEKINDS: Record<string, (t: Term) => boolean> = {
  [`${SH}IRI`]: t => t.termType === 'NamedNode',
  [`${SH}BlankNode`]: t => t.termType === 'BlankNode',
  [`${SH}Literal`]: t => t.termType === 'Literal',
  [`${SH}BlankNodeOrIRI`]: t => t.termType === 'BlankNode' || t.termType === 'NamedNode',
  [`${SH}BlankNodeOrLiteral`]: t => t.termType === 'BlankNode' || t.termType === 'Literal',
  [`${SH}IRIOrLiteral`]: t => t.termType === 'NamedNode' || t.termType === 'Literal',
};

/**
 * Maps SHACL regex flags to JS regex flags.
 * The 'x' (verbose/extended) flag has no JS equivalent and is silently dropped.
 * 'i', 's', 'm' are mapped 1-to-1.
 */
function regexFlags(flags?: string): string {
  let out = '';
  if (!flags) return out;
  const map: Record<string, string> = { i: 'i', s: 's', m: 'm', x: '' };
  for (const ch of flags) if (map[ch] !== undefined) out += map[ch];
  return out;
}

// ---------------------------------------------------------------------------
// Core constraint evaluator
// ---------------------------------------------------------------------------

export function checkConstraint(
  kind: string,
  value: Term,
  focusNode: Term,
  valueNodes: Term[],
  dataStore: Store,
  shapesStore: Store,
  flags?: string,
): boolean {
  // Cardinality
  if (kind === 'minCount') return valueNodes.length >= Number(pyValue(value));
  if (kind === 'maxCount') return valueNodes.length <= Number(pyValue(value));

  // Value type
  if (kind === 'class') return valueNodes.every(vn => isInstance(vn, value, dataStore));
  if (kind === 'datatype') {
    return valueNodes.every(vn => {
      if (vn.termType !== 'Literal') return false;
      const lit = vn as Literal;
      let dt = lit.datatype?.value;
      // py-srl: no datatype + no language → defaults to xsd:string
      if (!dt && !lit.language) dt = `${XSD}string`;
      return dt === value.value;
    });
  }
  if (kind === 'nodeKind') {
    const pred = NODEKINDS[value.value];
    if (!pred) throw new UnsupportedShapeFeatureError(`sh:nodeKind ${value.value} is not supported`);
    return valueNodes.every(pred);
  }

  // Value
  if (kind === 'hasValue') return valueNodes.some(vn => termKey(vn) === termKey(value));
  if (kind === 'in') {
    // sh:in list lives in the shapes graph; check both stores to be safe (py-srl merges graphs)
    const allowed = new Set([
      ...rdfList(dataStore, value).map(termKey),
      ...rdfList(shapesStore, value).map(termKey),
    ]);
    return valueNodes.every(vn => allowed.has(termKey(vn)));
  }

  // Range (numeric) — non-numeric values return false (match py-srl, no crash)
  if (kind === 'minInclusive' || kind === 'maxInclusive' || kind === 'minExclusive' || kind === 'maxExclusive') {
    const bound = pyValue(value);
    return valueNodes.every(vn => {
      const v = pyValue(vn);
      if (typeof v !== 'number' || typeof bound !== 'number') return false;
      if (kind === 'minInclusive') return v >= bound;
      if (kind === 'maxInclusive') return v <= bound;
      if (kind === 'minExclusive') return v > bound;
      return v < bound; // maxExclusive
    });
  }

  // String — blank nodes are rejected (py-srl behavior)
  if (kind === 'minLength' || kind === 'maxLength') {
    const bound = Number(pyValue(value));
    return valueNodes.every(vn => {
      if (vn.termType === 'BlankNode') return false;
      const len = vn.value.length;
      return kind === 'minLength' ? len >= bound : len <= bound;
    });
  }
  if (kind === 'pattern') {
    const re = new RegExp(value.value, regexFlags(flags));
    return valueNodes.every(vn => vn.termType !== 'BlankNode' && re.test(vn.value));
  }

  // Unhandled kinds (logical/shape-based/list — Tasks 3-4)
  throw new UnsupportedShapeFeatureError(`sh:${kind} is not yet evaluable`);
}

function checkProperty(focusNode: Term, prop: PropertyShape, dataStore: Store, shapesStore: Store): boolean {
  const valueNodes = valueNodesOf(focusNode, prop.path, dataStore);
  const flags = prop.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of prop.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, focusNode, valueNodes, dataStore, shapesStore, flags)) {
      return false;
    }
  }
  return true;
}

// Placeholder until path evaluation lands in Phase 3. Simple IRI path only.
export function valueNodesOf(node: Term, path: Term | null, dataStore: Store): Term[] {
  if (path === null) return [];
  if (path.termType === 'NamedNode') {
    return dataStore.getQuads(node as never, path as never, null, null).map(q => q.object);
  }
  throw new UnsupportedShapeFeatureError('Complex SHACL property paths are not yet supported');
}

export function conforms(node: Term, shape: NodeShape, dataStore: Store, shapesStore: Store): boolean {
  const nodeValues: Term[] = [node];
  const nodeFlags = shape.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of shape.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, node, nodeValues, dataStore, shapesStore, nodeFlags)) {
      return false;
    }
  }
  for (const prop of shape.propertyShapes) {
    if (!checkProperty(node, prop, dataStore, shapesStore)) return false;
  }
  return true;
}
