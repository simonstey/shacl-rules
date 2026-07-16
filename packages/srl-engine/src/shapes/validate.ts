import { Store, Term } from 'n3';
import { NodeShape, PropertyShape, UnsupportedShapeFeatureError } from './model';

export function checkConstraint(
  kind: string,
  _value: Term,
  _focusNode: Term,
  _valueNodes: Term[],
  _dataStore: Store,
  _shapesStore: Store,
  _flags?: string,
): boolean {
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
