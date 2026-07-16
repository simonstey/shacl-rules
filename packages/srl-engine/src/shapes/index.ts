export type { NodeShape, PropertyShape, Constraint } from './model';
export {
  UnsupportedShapeFeatureError,
  loadShape, TARGET_PREDS, NODE_CONSTRAINTS, PROP_CONSTRAINTS,
} from './model';
export { focusNodes } from './targets';
export { conforms, checkConstraint, valueNodesOf } from './validate';
export { SH } from './rdf-helpers';
