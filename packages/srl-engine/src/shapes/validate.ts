import { Store, Term, Literal } from 'n3';
import { NodeShape, PropertyShape, UnsupportedShapeFeatureError, loadShape } from './model';
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
// Shape-ref recursion + path evaluation
// ---------------------------------------------------------------------------

const MAX_CONFORMS_DEPTH = 50;

function conformsShapeRef(node: Term, ref: Term, dataStore: Store, shapesStore: Store, depth = 0): boolean {
  if (depth > MAX_CONFORMS_DEPTH) {
    throw new UnsupportedShapeFeatureError('shape reference recursion too deep (possible cyclic shapes graph)');
  }
  return conforms(node, loadShape(shapesStore, ref), dataStore, shapesStore, depth + 1);
}

// SHACL RDF path → value nodes reachable from `node` (IRI / sh:inversePath / list-sequence).
function valueNodesViaPath(node: Term, path: Term, dataStore: Store, shapesStore: Store): Term[] {
  if (path.termType === 'NamedNode') {
    return dataStore.getQuads(node as never, path as never, null, null).map(q => q.object);
  }
  // sh:inversePath
  const inv = shapesStore.getQuads(path as never, `${SH}inversePath` as never, null, null);
  if (inv.length) {
    const innerPath = inv[0].object;
    if (innerPath.termType === 'NamedNode') {
      return dataStore.getQuads(null, innerPath as never, node as never, null).map(q => q.subject);
    }
    // Nested inverse/sequence: support IRI inverse only for now.
    throw new UnsupportedShapeFeatureError('Nested inverse SHACL paths are not supported');
  }
  // RDF-list sequence path
  const members = rdfList(shapesStore, path);
  if (members.length) {
    let current: Term[] = [node];
    for (const step of members) {
      const next: Term[] = [];
      for (const t of current) next.push(...valueNodesViaPath(t, step, dataStore, shapesStore));
      current = next;
    }
    return current;
  }
  throw new UnsupportedShapeFeatureError(`Unsupported SHACL property path: ${path.value}`);
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
  depth = 0,
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

  // Shape-based
  if (kind === 'node') return valueNodes.every(vn => conformsShapeRef(vn, value, dataStore, shapesStore, depth));
  if (kind === 'someValue') return valueNodes.some(vn => conformsShapeRef(vn, value, dataStore, shapesStore, depth));

  // Logical
  if (kind === 'and') {
    const andShapes = rdfList(shapesStore, value);
    return valueNodes.every(vn => andShapes.every(s => conformsShapeRef(vn, s, dataStore, shapesStore, depth)));
  }
  if (kind === 'or') {
    const orShapes = rdfList(shapesStore, value);
    return valueNodes.every(vn => orShapes.some(s => conformsShapeRef(vn, s, dataStore, shapesStore, depth)));
  }
  if (kind === 'xone') {
    const xoneShapes = rdfList(shapesStore, value);
    return valueNodes.every(vn => xoneShapes.filter(s => conformsShapeRef(vn, s, dataStore, shapesStore, depth)).length === 1);
  }
  if (kind === 'not') {
    return valueNodes.every(vn => !conformsShapeRef(vn, value, dataStore, shapesStore, depth));
  }

  // 1.2 additions
  if (kind === 'rootClass') {
    return valueNodes.every(vn => subclassOf(vn, value, dataStore));
  }
  if (kind === 'subsetOf') {
    const superset = new Set(valueNodesViaPath(focusNode, value, dataStore, shapesStore).map(termKey));
    return valueNodes.every(vn => superset.has(termKey(vn)));
  }

  // String (language)
  if (kind === 'languageIn') {
    const langs = rdfList(shapesStore, value).map(t => t.value.toLowerCase());
    const matches = (tag: string | undefined) => {
      if (!tag) return false;
      const t = tag.toLowerCase();
      return langs.some(p => t === p || t.startsWith(p + '-'));
    };
    return valueNodes.every(vn => vn.termType === 'Literal' && matches((vn as Literal).language));
  }
  if (kind === 'uniqueLang') {
    if (pyValue(value) !== true) return true;
    const seen = new Set<string>();
    for (const vn of valueNodes) {
      if (vn.termType === 'Literal') {
        const lang = (vn as Literal).language;
        if (lang) { if (seen.has(lang)) return false; seen.add(lang); }
      }
    }
    return true;
  }

  // List family
  if (kind === 'memberShape') {
    return valueNodes.every(vn =>
      rdfList(dataStore, vn).every(m => conformsShapeRef(m, value, dataStore, shapesStore, depth)));
  }
  if (kind === 'minListLength' || kind === 'maxListLength') {
    const bound = Number(pyValue(value));
    return valueNodes.every(vn => {
      const count = rdfList(dataStore, vn).length;
      return kind === 'minListLength' ? count >= bound : count <= bound;
    });
  }
  if (kind === 'uniqueMembers') {
    if (pyValue(value) !== true) return true;
    return valueNodes.every(vn => {
      const members = rdfList(dataStore, vn).map(termKey);
      return members.length === new Set(members).size;
    });
  }

  // Reification (best-effort; n3 lacks first-class triple terms — vacuously true)
  if (kind === 'reifierShape' || kind === 'reificationRequired') return true;

  // Unhandled kinds (genuinely unknown)
  throw new UnsupportedShapeFeatureError(`sh:${kind} is not yet evaluable`);
}

function checkProperty(focusNode: Term, prop: PropertyShape, dataStore: Store, shapesStore: Store, depth = 0): boolean {
  const valueNodes = valueNodesOf(focusNode, prop.path, dataStore, shapesStore);
  const flags = prop.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of prop.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, focusNode, valueNodes, dataStore, shapesStore, flags, depth)) {
      return false;
    }
  }
  return true;
}

export function valueNodesOf(node: Term, path: Term | null, dataStore: Store, shapesStore: Store): Term[] {
  if (path === null) return [];
  return valueNodesViaPath(node, path, dataStore, shapesStore);
}

export function conforms(node: Term, shape: NodeShape, dataStore: Store, shapesStore: Store, depth = 0): boolean {
  const nodeValues: Term[] = [node];
  const nodeFlags = shape.constraints.find(c => c.kind === 'flags')?.value.value;
  for (const c of shape.constraints) {
    if (c.kind === 'flags') continue;
    if (!checkConstraint(c.kind, c.value, node, nodeValues, dataStore, shapesStore, nodeFlags, depth)) {
      return false;
    }
  }
  for (const prop of shape.propertyShapes) {
    if (!checkProperty(node, prop, dataStore, shapesStore, depth)) return false;
  }
  return true;
}
