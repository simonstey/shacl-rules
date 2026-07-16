import { Store, Term, NamedNode, BlankNode } from 'n3';
import { SH, RDF_TYPE, localName } from './rdf-helpers';

export class UnsupportedShapeFeatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedShapeFeatureError';
  }
}

export interface Constraint {
  kind: string;
  value: Term;
}

export interface PropertyShape {
  path: Term | null;
  constraints: Constraint[];
}

export interface NodeShape {
  iri: Term;
  targets: Array<[string, Term]>;
  constraints: Constraint[];
  propertyShapes: PropertyShape[];
}

export const TARGET_PREDS = new Set([
  'targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf', 'targetWhere', 'shape',
]);

export const NODE_CONSTRAINTS = new Set([
  'class', 'datatype', 'nodeKind', 'hasValue', 'in', 'node',
  'and', 'or', 'not', 'xone', 'rootClass', 'someValue', 'subsetOf',
]);

export const PROP_CONSTRAINTS = new Set([
  ...NODE_CONSTRAINTS,
  'minCount', 'maxCount', 'pattern', 'flags',
  'minInclusive', 'maxInclusive', 'minExclusive', 'maxExclusive',
  'minLength', 'maxLength', 'languageIn', 'uniqueLang',
  'memberShape', 'minListLength', 'maxListLength', 'uniqueMembers',
  'reifierShape', 'reificationRequired',
]);

const IGNORED = new Set(['path']); // structural, handled explicitly

function predicateObjects(store: Store, subject: Term): Array<[Term, Term]> {
  return store.getQuads(subject as NamedNode | BlankNode, null, null, null).map(q => [q.predicate, q.object]);
}

function value(store: Store, subject: Term, predicate: string): Term | null {
  const q = store.getQuads(subject as NamedNode | BlankNode, predicate, null, null);
  return q.length ? q[0].object : null;
}

function loadProperty(store: Store, node: Term): PropertyShape {
  const path = value(store, node, `${SH}path`);
  const constraints: Constraint[] = [];
  for (const [pred, obj] of predicateObjects(store, node)) {
    const name = localName(pred.value);
    if (name === null) continue;
    if (IGNORED.has(name)) continue;
    if (!PROP_CONSTRAINTS.has(name)) {
      throw new UnsupportedShapeFeatureError(`sh:${name} on a property shape is not supported`);
    }
    constraints.push({ kind: name, value: obj });
  }
  return { path, constraints };
}

export function loadShape(store: Store, shapeIri: Term): NodeShape {
  const targets: Array<[string, Term]> = [];
  const constraints: Constraint[] = [];
  const propertyShapes: PropertyShape[] = [];

  for (const [pred, obj] of predicateObjects(store, shapeIri)) {
    if (pred.value === RDF_TYPE) continue;
    const name = localName(pred.value);
    if (name === null) continue;
    if (TARGET_PREDS.has(name)) {
      targets.push([name, obj]);
    } else if (name === 'property') {
      propertyShapes.push(loadProperty(store, obj));
    } else if (NODE_CONSTRAINTS.has(name)) {
      constraints.push({ kind: name, value: obj });
    } else {
      throw new UnsupportedShapeFeatureError(`sh:${name} on a node shape is not supported`);
    }
  }

  return { iri: shapeIri, targets, constraints, propertyShapes };
}
