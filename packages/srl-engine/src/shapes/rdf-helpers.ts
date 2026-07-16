import { Store, Term, Literal, NamedNode, BlankNode, DataFactory } from 'n3';

const { namedNode } = DataFactory;

export const SH = 'http://www.w3.org/ns/shacl#';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD = 'http://www.w3.org/2001/XMLSchema#';
export const RDF_TYPE = `${RDF}type`;
export const RDFS_SUBCLASSOF = `${RDFS}subClassOf`;
export const RDF_FIRST = `${RDF}first`;
export const RDF_REST = `${RDF}rest`;
export const RDF_NIL = `${RDF}nil`;

/** Value-based identity key for an n3 Term (terms are not reference-unique). */
export function termKey(term: Term): string {
  if (term.termType === 'Literal') {
    const lit = term as Literal;
    return `L:${lit.value}${lit.datatype?.value ?? ''}${lit.language ?? ''}`;
  }
  if (term.termType === 'NamedNode') return `N:${term.value}`;
  if (term.termType === 'BlankNode') return `B:${term.value}`;
  return `${term.termType}:${term.value}`;
}

/** Members of an RDF list starting at `node`, or [] if `node` is not a list head. */
export function rdfList(store: Store, node: Term): Term[] {
  if (node.termType === 'NamedNode' && node.value === RDF_NIL) return [];
  if (node.termType !== 'BlankNode' && node.termType !== 'NamedNode') return [];
  const members: Term[] = [];
  const seen = new Set<string>();
  let cur: Term = node;
  while (!(cur.termType === 'NamedNode' && cur.value === RDF_NIL)) {
    if (seen.has(termKey(cur))) break; // cycle guard
    seen.add(termKey(cur));
    const first = store.getQuads(cur as NamedNode | BlankNode, namedNode(RDF_FIRST), null, null);
    if (first.length === 0) return members.length ? members : [];
    members.push(first[0].object);
    const rest = store.getQuads(cur as NamedNode | BlankNode, namedNode(RDF_REST), null, null);
    if (rest.length === 0) break;
    cur = rest[0].object;
  }
  return members;
}

/** Comparable JS value for a literal (number/boolean/string); other terms pass through. */
export function pyValue(term: Term): number | string | boolean | Term {
  if (term.termType !== 'Literal') return term;
  const lit = term as Literal;
  const dt = lit.datatype?.value ?? '';
  if (
    dt === `${XSD}integer` ||
    dt === `${XSD}decimal` ||
    dt === `${XSD}double` ||
    dt === `${XSD}float` ||
    dt === `${XSD}long` ||
    dt === `${XSD}int`
  ) {
    const n = Number(lit.value);
    return Number.isNaN(n) ? lit.value : n;
  }
  if (dt === `${XSD}boolean`) return lit.value === 'true' || lit.value === '1';
  return lit.value;
}

/** SHACL local name for an IRI in the sh: namespace, else null. */
export function localName(iri: string): string | null {
  return iri.startsWith(SH) ? iri.slice(SH.length) : null;
}
