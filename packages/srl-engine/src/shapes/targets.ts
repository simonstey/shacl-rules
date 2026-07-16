import { Store, Term } from 'n3';
import { RDF_TYPE, RDFS_SUBCLASSOF, SH, termKey } from './rdf-helpers';
import { NodeShape, loadShape } from './model';
import { conforms } from './validate';

// Subjects of (?, predicate, obj) — used for the class-hierarchy walk.
function subjectsWithObject(store: Store, predicate: string, obj: Term): Term[] {
  return store.getQuads(null, predicate as never, obj as never, null).map(q => q.subject);
}

function subclassInstances(cls: Term, store: Store): Term[] {
  const classes = new Set<string>();
  const classTerms: Term[] = [];
  const frontier: Term[] = [cls];
  while (frontier.length) {
    const cur = frontier.pop() as Term;
    if (classes.has(termKey(cur))) continue;
    classes.add(termKey(cur));
    classTerms.push(cur);
    for (const sub of subjectsWithObject(store, RDFS_SUBCLASSOF, cur)) frontier.push(sub);
  }
  const out: Term[] = [];
  const seen = new Set<string>();
  for (const c of classTerms) {
    for (const inst of subjectsWithObject(store, RDF_TYPE, c)) {
      if (!seen.has(termKey(inst))) { seen.add(termKey(inst)); out.push(inst); }
    }
  }
  return out;
}

function dataNodes(store: Store): Term[] {
  const out: Term[] = [];
  const seen = new Set<string>();
  for (const q of store.getQuads(null, null, null, null)) {
    for (const t of [q.subject, q.object]) {
      if (!seen.has(termKey(t))) { seen.add(termKey(t)); out.push(t); }
    }
  }
  return out;
}

export function focusNodes(shape: NodeShape, dataStore: Store, shapesStore: Store): Term[] {
  const result: Term[] = [];
  const seen = new Set<string>();
  const add = (t: Term) => { if (!seen.has(termKey(t))) { seen.add(termKey(t)); result.push(t); } };

  for (const [name, obj] of shape.targets) {
    if (name === 'targetClass') {
      subclassInstances(obj, dataStore).forEach(add);
    } else if (name === 'targetNode') {
      add(obj);
    } else if (name === 'targetSubjectsOf') {
      // Subjects of any triple whose PREDICATE is `obj`.
      for (const q of dataStore.getQuads(null, obj as never, null, null)) add(q.subject);
    } else if (name === 'targetObjectsOf') {
      // Objects of any triple whose PREDICATE is `obj`.
      for (const q of dataStore.getQuads(null, obj as never, null, null)) add(q.object);
    } else if (name === 'targetWhere') {
      const inline = loadShape(shapesStore, obj);
      for (const candidate of dataNodes(dataStore)) {
        if (conforms(candidate, inline, dataStore, shapesStore)) add(candidate);
      }
    }
  }
  // sh:shape is an implicit target: any data node n with `n sh:shape <shapeIri>`.
  for (const n of subjectsWithObject(dataStore, `${SH}shape`, shape.iri)) add(n);
  return result;
}
