import { CstNode, IToken } from 'chevrotain';
import { parseSRL } from './parser';

// The IRI that the Turtle `a` shorthand expands to.
const RDF_TYPE_IRI = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type RDFTerm = IRITerm | LiteralTerm | BlankNodeTerm | VariableTerm;

export interface IRITerm {
  termType: 'iri';
  value: string;
}

export interface LiteralTerm {
  termType: 'literal';
  value: string;
  datatype?: string;
  language?: string;
}

export interface BlankNodeTerm {
  termType: 'blankNode';
  value: string;
}

export interface VariableTerm {
  termType: 'variable';
  value: string;
}

export interface TriplePattern {
  subject: RDFTerm;
  predicate: RDFTerm | PathExpression;
  object: RDFTerm;
  location?: SourceLocation;
}

export interface FilterElement {
  type: 'filter';
  expression: Expression;
  location?: SourceLocation;
}

export interface AssignmentElement {
  type: 'assignment';
  expression: Expression;
  variable: string;
  location?: SourceLocation;
}

export interface NegationElement {
  type: 'negation';
  patterns: BodyElement[];
  location?: SourceLocation;
}

export type BodyElement = TriplePattern | FilterElement | AssignmentElement | NegationElement;

export interface RuleHead {
  patterns: TriplePattern[];
}

export interface RuleBody {
  elements: BodyElement[];
}

export interface Rule {
  type: 'rule';
  name?: string;
  head: RuleHead;
  body: RuleBody;
  location?: SourceLocation;
}

/**
 * A rule tied to a SHACL shape by a `FOR ?v IN <shape>` clause (opt-in extension).
 * Wraps a Rule — all existing rule machinery runs on `.rule`.
 */
export interface TargetedRule {
  type: 'targetedRule';
  rule: Rule;
  focusVar: string;
  shape: string;
  direction: 'rule-to-shape';
  location?: SourceLocation;
}

/** Thrown when an opt-in extension construct is used with extensions disabled. */
export class ExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export interface TransitiveDeclaration {
  type: 'transitive';
  property: string;
  location?: SourceLocation;
}

export interface SymmetricDeclaration {
  type: 'symmetric';
  property: string;
  location?: SourceLocation;
}

export interface InverseDeclaration {
  type: 'inverse';
  property1: string;
  property2: string;
  location?: SourceLocation;
}

export type Declaration = TransitiveDeclaration | SymmetricDeclaration | InverseDeclaration;

export interface DataBlock {
  type: 'data';
  patterns: TriplePattern[];
  location?: SourceLocation;
}

export interface PrefixDeclaration {
  prefix: string;
  iri: string;
}

export interface BaseDeclaration {
  iri: string;
}

export interface RuleSet {
  base?: string;
  prefixes: Map<string, string>;
  rules: Rule[];
  targetedRules: TargetedRule[];
  declarations: Declaration[];
  dataBlocks: DataBlock[];
}

export type BinaryOperator = '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '>' | '<=' | '>=' | '&&' | '||';
export type UnaryOperator = '!' | '+' | '-';

export interface BinaryExpression {
  type: 'binary';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: 'unary';
  operator: UnaryOperator;
  operand: Expression;
}

export interface FunctionCall {
  type: 'function';
  name: string;
  args: Expression[];
}

export interface VariableExpression {
  type: 'variable';
  name: string;
}

export interface LiteralExpression {
  type: 'literal';
  value: string | number | boolean;
  datatype?: string;
  language?: string;
}

export interface IRIExpression {
  type: 'iri';
  value: string;
}

export interface InExpression {
  type: 'in';
  value: Expression;
  list: Expression[];
  negated: boolean;
}

// Path Expression Types
// SHACL 1.2 Rules paths cover only sequence (`/`) and inverse (`^`) — the ones
// that expand into triple patterns. There is no `*`/`+`/`?`, no alternative,
// and no negated property set.
export interface PathIRI {
  pathType: 'iri';
  value: string;
}

export interface PathSequence {
  pathType: 'sequence';
  elements: PathExpression[];
}

export interface PathInverse {
  pathType: 'inverse';
  path: PathExpression;
}

export type PathExpression =
  | PathIRI
  | PathSequence
  | PathInverse;

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | FunctionCall
  | VariableExpression
  | LiteralExpression
  | IRIExpression
  | InExpression;

interface CSTChildren {
  [key: string]: (CstNode | IToken)[];
}

function getLocation(token: IToken): SourceLocation {
  return {
    startLine: token.startLine ?? 1,
    startColumn: token.startColumn ?? 1,
    endLine: token.endLine ?? token.startLine ?? 1,
    endColumn: token.endColumn ?? token.startColumn ?? 1,
  };
}

function getLocationFromNode(node: CstNode): SourceLocation | undefined {
  const children = node.children as CSTChildren;
  for (const key of Object.keys(children)) {
    const items = children[key];
    if (items?.length > 0) {
      const first = items[0];
      if ('image' in first) {
        return getLocation(first);
      } else if ('children' in first) {
        return getLocationFromNode(first);
      }
    }
  }
  return undefined;
}

export class ASTBuilder {
  private prefixes: Map<string, string> = new Map();
  private base?: string;
  private extensions = false;

  public buildRuleSet(code: string, options?: { extensions?: boolean }): RuleSet {
    this.extensions = options?.extensions ?? false;
    const parseResult = parseSRL(code);

    if (parseResult.errors.length > 0) {
      throw new Error(`Parse errors: ${parseResult.errors.map(e => e.message).join(', ')}`);
    }

    const cst = parseResult.cst as CstNode;
    return this.visitRuleSet(cst);
  }

  private visitRuleSet(node: CstNode): RuleSet {
    const children = node.children as CSTChildren;
    const rules: Rule[] = [];
    const targetedRules: TargetedRule[] = [];
    const declarations: Declaration[] = [];
    const dataBlocks: DataBlock[] = [];

    if (children.baseDecl) {
      for (const baseNode of children.baseDecl) {
        this.visitBaseDecl(baseNode as CstNode);
      }
    }

    if (children.prefixDecl) {
      for (const prefixNode of children.prefixDecl) {
        this.visitPrefixDecl(prefixNode as CstNode);
      }
    }

    if (children.rule) {
      for (const ruleNode of children.rule) {
        const built = this.visitRule(ruleNode as CstNode);
        if (built.type === 'targetedRule') {
          targetedRules.push(built);
        } else {
          rules.push(built);
        }
      }
    }

    if (children.declaration) {
      for (const declNode of children.declaration) {
        declarations.push(this.visitDeclaration(declNode as CstNode));
      }
    }

    if (children.dataBlock) {
      for (const dataNode of children.dataBlock) {
        dataBlocks.push(this.visitDataBlock(dataNode as CstNode));
      }
    }

    return {
      base: this.base,
      prefixes: new Map(this.prefixes),
      rules,
      targetedRules,
      declarations,
      dataBlocks,
    };
  }

  private visitBaseDecl(node: CstNode): void {
    const children = node.children as CSTChildren;
    const iriToken = children.IRI?.[0] as IToken | undefined;
    if (iriToken) {
      this.base = this.extractIRI(iriToken.image);
    }
  }

  private visitPrefixDecl(node: CstNode): void {
    const children = node.children as CSTChildren;
    const identToken = children.Identifier?.[0] as IToken | undefined;
    const iriToken = children.IRI?.[0] as IToken | undefined;
    
    const prefix = identToken?.image ?? '';
    if (iriToken) {
      const iri = this.extractIRI(iriToken.image);
      this.prefixes.set(prefix, iri);
    }
  }

  private visitRule(node: CstNode): Rule | TargetedRule {
    const children = node.children as CSTChildren;

    if (children.rule1) {
      return this.visitRule1(children.rule1[0] as CstNode);
    } else if (children.rule2) {
      return this.visitRule2(children.rule2[0] as CstNode);
    }

    throw new Error('Unknown rule type');
  }

  // Rule1 (`RULE iri? ForClause? { head } WHERE { body }`) and Rule2
  // (`IF { body } THEN iri? ForClause? { head }`) both delegate to buildRule.
  // Rule1's CST carries the `Rule` token child; rule2's does not — that
  // distinction is used by buildRule to detect the rule2-naming-IRI extension.
  private visitRule1(node: CstNode): Rule | TargetedRule {
    return this.buildRule(node);
  }

  private visitRule2(node: CstNode): Rule | TargetedRule {
    return this.buildRule(node);
  }

  private buildRule(node: CstNode): Rule | TargetedRule {
    const children = node.children as CSTChildren;
    const headNode = children.headTemplate?.[0] as CstNode;
    const bodyNode = children.bodyPattern?.[0] as CstNode;
    const nameNode = children.iriRef?.[0] as CstNode | undefined;
    const forNode = children.forClause?.[0] as CstNode | undefined;

    const rule: Rule = {
      type: 'rule',
      name: nameNode ? this.visitIriRef(nameNode) : undefined,
      head: this.visitHeadTemplate(headNode),
      body: this.visitBodyPattern(bodyNode),
      location: getLocationFromNode(node),
    };

    if (forNode) {
      if (!this.extensions) {
        throw new ExtensionError(
          "The 'FOR ?v IN <shape>' clause is an opt-in extension; enable it with { extensions: true }."
        );
      }
      const forChildren = forNode.children as CSTChildren;
      const focusVar = this.visitVariable(forChildren.variable[0] as CstNode).value;
      const shape = this.visitIriRef(forChildren.iriRef[0] as CstNode);
      return {
        type: 'targetedRule',
        rule,
        focusVar,
        shape,
        direction: 'rule-to-shape',
        location: getLocationFromNode(node),
      };
    }

    // A rule2 naming IRI without a FOR clause is extension-only surface.
    // rule1 CST nodes always have a 'Rule' token child (from CONSUME(Rule) in
    // the grammar); rule2 nodes do not (they start with 'If'). This key check
    // reliably distinguishes the two forms inside buildRule.
    const isRule2 = !('Rule' in children) && !!nameNode;
    if (isRule2 && !this.extensions) {
      throw new ExtensionError(
        "A naming IRI on an 'IF..THEN' rule requires extensions: { extensions: true }."
      );
    }

    return rule;
  }

  private visitDeclaration(node: CstNode): Declaration {
    const children = node.children as CSTChildren;

    if (children.Transitive) {
      const iriNode = children.iriRef?.[0] as CstNode;
      return {
        type: 'transitive',
        property: this.visitIriRef(iriNode),
        location: getLocationFromNode(node),
      };
    } else if (children.Symmetric) {
      // Postfix form: '(' iri ')' SYMMETRIC
      const iriNode = children.iriRef?.[0] as CstNode;
      return {
        type: 'symmetric',
        property: this.visitIriRef(iriNode),
        location: getLocationFromNode(node),
      };
    } else if (children.Inverse) {
      const iriNodes = children.iriRef as CstNode[];
      return {
        type: 'inverse',
        property1: this.visitIriRef(iriNodes[0]),
        property2: this.visitIriRef(iriNodes[1]),
        location: getLocationFromNode(node),
      };
    }

    throw new Error('Unknown declaration type');
  }

  private visitDataBlock(node: CstNode): DataBlock {
    const children = node.children as CSTChildren;
    const triplesBlockNode = children.triplesTemplateBlock?.[0] as CstNode;
    
    return {
      type: 'data',
      patterns: this.visitTriplesTemplateBlock(triplesBlockNode),
      location: getLocationFromNode(node),
    };
  }

  private visitHeadTemplate(node: CstNode): RuleHead {
    const children = node.children as CSTChildren;
    const triplesBlockNode = children.triplesTemplateBlock?.[0] as CstNode;
    
    return {
      patterns: this.visitTriplesTemplateBlock(triplesBlockNode),
    };
  }

  private visitTriplesTemplateBlock(node: CstNode): TriplePattern[] {
    const children = node.children as CSTChildren;
    const triplesTemplateNode = children.triplesTemplate?.[0] as CstNode | undefined;
    
    if (!triplesTemplateNode) {
      return [];
    }
    
    return this.visitTriplesTemplate(triplesTemplateNode);
  }

  private visitTriplesTemplate(node: CstNode): TriplePattern[] {
    const children = node.children as CSTChildren;
    const patterns: TriplePattern[] = [];
    
    if (children.triplesSameSubject) {
      for (const tripleNode of children.triplesSameSubject) {
        patterns.push(...this.visitTriplesSameSubject(tripleNode as CstNode));
      }
    }
    
    return patterns;
  }

  // Template family (head + DATA): predicate is a term (IRI, variable, or `a`).
  private visitTriplesSameSubject(node: CstNode): TriplePattern[] {
    return this.buildTriples(node, 'template');
  }

  // Pattern family (rule bodies): predicate may be a property path or a variable.
  private visitTriplesSameSubjectPattern(node: CstNode): TriplePattern[] {
    return this.buildTriples(node, 'pattern');
  }

  private buildTriples(node: CstNode, family: 'template' | 'pattern'): TriplePattern[] {
    const children = node.children as CSTChildren;
    const patterns: TriplePattern[] = [];

    const varOrTermNode = children.varOrTerm?.[0] as CstNode | undefined;
    const podKey = family === 'template' ? 'predicateObjectListTemplate' : 'predicateObjectListPattern';
    const podListNode = children[podKey]?.[0] as CstNode | undefined;

    if (varOrTermNode && podListNode) {
      const subject = this.visitVarOrTerm(varOrTermNode);
      const predicateObjects = this.visitPredicateObjectList(podListNode, family);

      for (const { predicate, objects } of predicateObjects) {
        for (const object of objects) {
          patterns.push({
            subject,
            predicate,
            object,
            location: getLocationFromNode(node),
          });
        }
      }
    }

    return patterns;
  }

  private visitPredicateObjectList(
    node: CstNode,
    family: 'template' | 'pattern'
  ): Array<{ predicate: RDFTerm | PathExpression; objects: RDFTerm[] }> {
    const children = node.children as CSTChildren;
    const result: Array<{ predicate: RDFTerm | PathExpression; objects: RDFTerm[] }> = [];

    const verbNodes = (family === 'template' ? children.verbTemplate : children.verbPattern) as
      | CstNode[]
      | undefined;
    const objectListNodes = children.objectList as CstNode[] | undefined;

    if (verbNodes && objectListNodes) {
      for (let i = 0; i < verbNodes.length && i < objectListNodes.length; i++) {
        const predicate =
          family === 'template' ? this.visitVerbTemplate(verbNodes[i]) : this.visitVerbPattern(verbNodes[i]);
        const objects = this.visitObjectList(objectListNodes[i]);
        result.push({ predicate, objects });
      }
    }

    return result;
  }

  // VerbTemplate = 'a' | VarOrIri
  private visitVerbTemplate(node: CstNode): RDFTerm {
    const children = node.children as CSTChildren;

    if (children.RdfType) {
      return { termType: 'iri', value: RDF_TYPE_IRI };
    } else if (children.varOrIri) {
      return this.visitVarOrIri(children.varOrIri[0] as CstNode);
    }

    throw new Error('Unknown verb template type');
  }

  // VerbPattern = Var | Path
  private visitVerbPattern(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;

    if (children.variable) {
      return this.visitVariable(children.variable[0] as CstNode);
    } else if (children.path) {
      return this.visitPath(children.path[0] as CstNode);
    }

    throw new Error('Unknown verb pattern type');
  }

  // Path = PathSequence. Returns a plain IRI term when the path is a single IRI
  // (so simple predicates flow through the ordinary triple-matching path).
  private visitPath(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    return this.visitPathSequence(children.pathSequence[0] as CstNode);
  }

  private visitPathSequence(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const eltNodes = children.pathEltOrInverse as CstNode[];

    if (eltNodes.length === 1) {
      return this.visitPathEltOrInverse(eltNodes[0]);
    }

    const elements = eltNodes.map(n => this.toPathExpression(this.visitPathEltOrInverse(n)));

    return {
      pathType: 'sequence',
      elements,
    };
  }

  private visitPathEltOrInverse(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const isInverse = !!children.Caret;
    const elt = this.visitPathElt(children.pathElt?.[0] as CstNode);

    if (isInverse) {
      return {
        pathType: 'inverse',
        path: this.toPathExpression(elt),
      };
    }

    return elt;
  }

  // PathElt = iri | 'a' | '(' Path ')'
  private visitPathElt(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;

    if (children.path) {
      return this.visitPath(children.path[0] as CstNode);
    } else if (children.RdfType) {
      return { termType: 'iri', value: RDF_TYPE_IRI };
    } else if (children.iriRef) {
      return {
        termType: 'iri',
        value: this.visitIriRef(children.iriRef[0] as CstNode),
      };
    }

    throw new Error('Unknown path element type');
  }

  private toPathExpression(term: RDFTerm | PathExpression): PathExpression {
    if ('pathType' in term) {
      return term;
    }
    if (term.termType === 'iri') {
      return { pathType: 'iri', value: term.value };
    }
    throw new Error(`Cannot convert ${term.termType} to path expression`);
  }

  private visitVarOrIri(node: CstNode): RDFTerm {
    const children = node.children as CSTChildren;
    
    if (children.variable) {
      return this.visitVariable(children.variable[0] as CstNode);
    } else if (children.iriRef) {
      return {
        termType: 'iri',
        value: this.visitIriRef(children.iriRef[0] as CstNode),
      };
    }
    
    throw new Error('Unknown varOrIri type');
  }

  private visitObjectList(node: CstNode): RDFTerm[] {
    const children = node.children as CSTChildren;
    const objects: RDFTerm[] = [];
    
    if (children.objectTerm) {
      for (const objNode of children.objectTerm) {
        objects.push(this.visitObjectTerm(objNode as CstNode));
      }
    }
    
    return objects;
  }

  private visitObjectTerm(node: CstNode): RDFTerm {
    const children = node.children as CSTChildren;

    if (children.varOrTerm) {
      return this.visitVarOrTerm(children.varOrTerm[0] as CstNode);
    }

    throw new Error('Unknown object term type');
  }

  private visitVarOrTerm(node: CstNode): RDFTerm {
    const children = node.children as CSTChildren;
    
    if (children.variable) {
      return this.visitVariable(children.variable[0] as CstNode);
    } else if (children.graphTerm) {
      return this.visitGraphTerm(children.graphTerm[0] as CstNode);
    }
    
    throw new Error('Unknown varOrTerm type');
  }

  private visitVariable(node: CstNode): VariableTerm {
    const children = node.children as CSTChildren;
    
    const varToken = (children.QuestionVar?.[0] ?? children.DollarVar?.[0]) as IToken;
    return {
      termType: 'variable',
      value: varToken.image.substring(1),
    };
  }

  private visitGraphTerm(node: CstNode): RDFTerm {
    const children = node.children as CSTChildren;
    
    if (children.iriRef) {
      return {
        termType: 'iri',
        value: this.visitIriRef(children.iriRef[0] as CstNode),
      };
    } else if (children.literal) {
      return this.visitLiteral(children.literal[0] as CstNode);
    } else if (children.BlankNode) {
      const token = children.BlankNode[0] as IToken;
      return {
        termType: 'blankNode',
        value: token.image,
      };
    }
    
    throw new Error('Unknown graphTerm type');
  }

  private visitIriRef(node: CstNode): string {
    const children = node.children as CSTChildren;
    
    if (children.IRI) {
      const token = children.IRI[0] as IToken;
      return this.resolveIRI(this.extractIRI(token.image));
    } else if (children.PrefixedName) {
      const token = children.PrefixedName[0] as IToken;
      return this.resolvePrefixedName(token.image);
    } else if (children.ColonLocalName) {
      const token = children.ColonLocalName[0] as IToken;
      return this.resolvePrefixedName(token.image);
    }
    
    throw new Error('Unknown iriRef type');
  }

  private visitLiteral(node: CstNode): LiteralTerm {
    const children = node.children as CSTChildren;
    
    if (children.rdfLiteral) {
      return this.visitRdfLiteral(children.rdfLiteral[0] as CstNode);
    } else if (children.numericLiteral) {
      return this.visitNumericLiteral(children.numericLiteral[0] as CstNode);
    } else if (children.booleanLiteral) {
      return this.visitBooleanLiteral(children.booleanLiteral[0] as CstNode);
    }
    
    throw new Error('Unknown literal type');
  }

  private visitRdfLiteral(node: CstNode): LiteralTerm {
    const children = node.children as CSTChildren;
    const stringNode = children.string?.[0] as CstNode;
    const stringValue = this.visitString(stringNode);
    
    let datatype: string | undefined;
    let language: string | undefined;
    
    if (children.LangTag) {
      const langToken = children.LangTag[0] as IToken;
      language = langToken.image.substring(1);
    } else if (children.iriRef) {
      datatype = this.visitIriRef(children.iriRef[0] as CstNode);
    }
    
    return {
      termType: 'literal',
      value: stringValue,
      datatype,
      language,
    };
  }

  private visitString(node: CstNode): string {
    const children = node.children as CSTChildren;
    let token: IToken | undefined;
    
    if (children.StringLiteralQuote) {
      token = children.StringLiteralQuote[0] as IToken;
    } else if (children.StringLiteralSingleQuote) {
      token = children.StringLiteralSingleQuote[0] as IToken;
    } else if (children.StringLiteralLongQuote) {
      token = children.StringLiteralLongQuote[0] as IToken;
    } else if (children.StringLiteralLongSingleQuote) {
      token = children.StringLiteralLongSingleQuote[0] as IToken;
    }
    
    if (!token) {
      throw new Error('Unknown string type');
    }
    
    const raw = token.image;
    if (raw.startsWith('"""') || raw.startsWith("'''")) {
      return this.unescapeString(raw.slice(3, -3));
    } else {
      return this.unescapeString(raw.slice(1, -1));
    }
  }

  private visitNumericLiteral(node: CstNode): LiteralTerm {
    const children = node.children as CSTChildren;
    
    if (children.Integer) {
      const token = children.Integer[0] as IToken;
      return {
        termType: 'literal',
        value: token.image,
        datatype: 'http://www.w3.org/2001/XMLSchema#integer',
      };
    } else if (children.Decimal) {
      const token = children.Decimal[0] as IToken;
      return {
        termType: 'literal',
        value: token.image,
        datatype: 'http://www.w3.org/2001/XMLSchema#decimal',
      };
    } else if (children.Double) {
      const token = children.Double[0] as IToken;
      return {
        termType: 'literal',
        value: token.image,
        datatype: 'http://www.w3.org/2001/XMLSchema#double',
      };
    }
    
    throw new Error('Unknown numeric literal type');
  }

  private visitBooleanLiteral(node: CstNode): LiteralTerm {
    const children = node.children as CSTChildren;
    
    if (children.True) {
      return {
        termType: 'literal',
        value: 'true',
        datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
      };
    } else if (children.False) {
      return {
        termType: 'literal',
        value: 'false',
        datatype: 'http://www.w3.org/2001/XMLSchema#boolean',
      };
    }
    
    throw new Error('Unknown boolean literal');
  }

  private visitBodyPattern(node: CstNode): RuleBody {
    const children = node.children as CSTChildren;
    const bodyPattern1Node = children.bodyPattern1?.[0] as CstNode | undefined;
    
    if (!bodyPattern1Node) {
      return { elements: [] };
    }
    
    return { elements: this.visitBodyPattern1(bodyPattern1Node) };
  }

  private visitBodyPattern1(node: CstNode): BodyElement[] {
    const children = node.children as CSTChildren;
    const elements: BodyElement[] = [];
    
    if (children.bodyBasic) {
      for (const basicNode of children.bodyBasic) {
        elements.push(...this.visitBodyBasic(basicNode as CstNode));
      }
    }
    
    return elements;
  }

  private visitBodyBasic(node: CstNode): BodyElement[] {
    const children = node.children as CSTChildren;

    if (children.bodyNotTriples) {
      return [this.visitBodyNotTriples(children.bodyNotTriples[0] as CstNode)];
    } else if (children.triplesSameSubjectPattern) {
      return this.visitTriplesSameSubjectPattern(children.triplesSameSubjectPattern[0] as CstNode);
    }

    return [];
  }

  private visitBodyNotTriples(node: CstNode): BodyElement {
    const children = node.children as CSTChildren;

    if (children.filterClause) {
      return this.visitFilterClause(children.filterClause[0] as CstNode);
    } else if (children.negation) {
      return this.visitNegation(children.negation[0] as CstNode);
    } else if (children.assignment) {
      return this.visitAssignment(children.assignment[0] as CstNode);
    }

    throw new Error('Unknown bodyNotTriples type');
  }

  // A negation body: BodyBasicSeq of triple patterns + FILTERs only.
  private visitBodyBasicSeq(node: CstNode): BodyElement[] {
    const children = node.children as CSTChildren;
    const elements: BodyElement[] = [];

    if (children.bodyBasicElement) {
      for (const elNode of children.bodyBasicElement) {
        elements.push(...this.visitBodyBasicElement(elNode as CstNode));
      }
    }

    return elements;
  }

  private visitBodyBasicElement(node: CstNode): BodyElement[] {
    const children = node.children as CSTChildren;

    if (children.filterClause) {
      return [this.visitFilterClause(children.filterClause[0] as CstNode)];
    } else if (children.triplesSameSubjectPattern) {
      return this.visitTriplesSameSubjectPattern(children.triplesSameSubjectPattern[0] as CstNode);
    }

    return [];
  }

  private visitFilterClause(node: CstNode): FilterElement {
    const children = node.children as CSTChildren;
    const constraintNode = children.constraint?.[0] as CstNode;

    return {
      type: 'filter',
      expression: this.visitConstraint(constraintNode),
      location: getLocationFromNode(node),
    };
  }

  private visitNegation(node: CstNode): NegationElement {
    const children = node.children as CSTChildren;
    const seqNode = children.bodyBasicSeq?.[0] as CstNode | undefined;

    return {
      type: 'negation',
      patterns: seqNode ? this.visitBodyBasicSeq(seqNode) : [],
      location: getLocationFromNode(node),
    };
  }

  private visitAssignment(node: CstNode): AssignmentElement {
    const children = node.children as CSTChildren;
    const expressionNode = children.expression?.[0] as CstNode;
    const variableNode = children.variable?.[0] as CstNode;

    const variable = this.visitVariable(variableNode);

    return {
      type: 'assignment',
      expression: this.visitExpression(expressionNode),
      variable: variable.value,
      location: getLocationFromNode(node),
    };
  }

  private visitConstraint(node: CstNode): Expression {
    const children = node.children as CSTChildren;

    if (children.brackettedExpression) {
      return this.visitBrackettedExpression(children.brackettedExpression[0] as CstNode);
    } else if (children.builtInCall) {
      return this.visitBuiltInCall(children.builtInCall[0] as CstNode);
    } else if (children.functionCall) {
      return this.visitFunctionCall(children.functionCall[0] as CstNode);
    }

    throw new Error('Unknown constraint type');
  }

  // FunctionCall = iri ArgList — a filter/expression call by full IRI.
  private visitFunctionCall(node: CstNode): FunctionCall {
    const children = node.children as CSTChildren;
    const name = this.visitIriRef(children.iriRef[0] as CstNode);
    const args: Expression[] = [];

    const exprListNode = children.expressionList?.[0] as CstNode | undefined;
    if (exprListNode) {
      const exprListChildren = exprListNode.children as CSTChildren;
      if (exprListChildren.expression) {
        for (const exprNode of exprListChildren.expression) {
          args.push(this.visitExpression(exprNode as CstNode));
        }
      }
    }

    return { type: 'function', name, args };
  }

  private visitExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const condOrNode = children.conditionalOrExpression?.[0] as CstNode;
    return this.visitConditionalOrExpression(condOrNode);
  }

  private visitConditionalOrExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const andNodes = children.conditionalAndExpression as CstNode[];
    
    if (andNodes.length === 1) {
      return this.visitConditionalAndExpression(andNodes[0]);
    }
    
    let left = this.visitConditionalAndExpression(andNodes[0]);
    for (let i = 1; i < andNodes.length; i++) {
      const right = this.visitConditionalAndExpression(andNodes[i]);
      left = {
        type: 'binary',
        operator: '||',
        left,
        right,
      };
    }
    
    return left;
  }

  private visitConditionalAndExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const valueNodes = children.valueLogical as CstNode[];
    
    if (valueNodes.length === 1) {
      return this.visitValueLogical(valueNodes[0]);
    }
    
    let left = this.visitValueLogical(valueNodes[0]);
    for (let i = 1; i < valueNodes.length; i++) {
      const right = this.visitValueLogical(valueNodes[i]);
      left = {
        type: 'binary',
        operator: '&&',
        left,
        right,
      };
    }
    
    return left;
  }

  private visitValueLogical(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    return this.visitRelationalExpression(children.relationalExpression[0] as CstNode);
  }

  private visitRelationalExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const numericNodes = children.numericExpression as CstNode[];
    
    if (numericNodes.length === 1) {
      // Check for IN / NOT IN
      if (children.In) {
        const left = this.visitNumericExpression(numericNodes[0]);
        const exprListNode = children.expressionList?.[0] as CstNode | undefined;
        const list = exprListNode ? this.visitExpressionList(exprListNode) : [];
        return {
          type: 'in',
          value: left,
          list,
          negated: !!children.Not,
        };
      }
      return this.visitNumericExpression(numericNodes[0]);
    }
    
    const left = this.visitNumericExpression(numericNodes[0]);
    const right = this.visitNumericExpression(numericNodes[1]);
    
    let operator: BinaryOperator;
    if (children.Equals) {
      operator = '=';
    } else if (children.NotEquals) {
      operator = '!=';
    } else if (children.LessThan) {
      operator = '<';
    } else if (children.GreaterThan) {
      operator = '>';
    } else if (children.LessOrEqual) {
      operator = '<=';
    } else if (children.GreaterOrEqual) {
      operator = '>=';
    } else {
      throw new Error('Unknown relational operator');
    }
    
    return {
      type: 'binary',
      operator,
      left,
      right,
    };
  }

  private visitExpressionList(node: CstNode): Expression[] {
    const children = node.children as CSTChildren;
    const expressions: Expression[] = [];
    
    if (children.expression) {
      for (const exprNode of children.expression) {
        expressions.push(this.visitExpression(exprNode as CstNode));
      }
    }
    
    return expressions;
  }

  private visitNumericExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    return this.visitAdditiveExpression(children.additiveExpression[0] as CstNode);
  }

  // Merge the two operator-token arrays into a single list ordered by source
  // position, so the i-th operator can be paired with the i-th right operand.
  // (Chevrotain groups tokens by type, losing interleaving order; pairing an
  // operator to an operand by "is any token of this type before the operand"
  // is wrong once both operators appear, e.g. `a + b - c`.)
  private orderedOperators(
    tokensA: IToken[] | undefined,
    opA: BinaryOperator,
    tokensB: IToken[] | undefined,
    opB: BinaryOperator
  ): BinaryOperator[] {
    const tagged = [
      ...(tokensA ?? []).map(t => ({ offset: t.startOffset, op: opA })),
      ...(tokensB ?? []).map(t => ({ offset: t.startOffset, op: opB })),
    ];
    tagged.sort((x, y) => x.offset - y.offset);
    return tagged.map(t => t.op);
  }

  private visitAdditiveExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const multNodes = children.multiplicativeExpression as CstNode[];

    if (multNodes.length === 1) {
      return this.visitMultiplicativeExpression(multNodes[0]);
    }

    const operators = this.orderedOperators(
      children.Plus as IToken[] | undefined, '+',
      children.Minus as IToken[] | undefined, '-'
    );

    let left = this.visitMultiplicativeExpression(multNodes[0]);
    for (let i = 1; i < multNodes.length; i++) {
      const right = this.visitMultiplicativeExpression(multNodes[i]);
      left = {
        type: 'binary',
        operator: operators[i - 1] ?? '+',
        left,
        right,
      };
    }

    return left;
  }

  private visitMultiplicativeExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const unaryNodes = children.unaryExpression as CstNode[];

    if (unaryNodes.length === 1) {
      return this.visitUnaryExpression(unaryNodes[0]);
    }

    const operators = this.orderedOperators(
      children.Asterisk as IToken[] | undefined, '*',
      children.Slash as IToken[] | undefined, '/'
    );

    let left = this.visitUnaryExpression(unaryNodes[0]);
    for (let i = 1; i < unaryNodes.length; i++) {
      const right = this.visitUnaryExpression(unaryNodes[i]);
      left = {
        type: 'binary',
        operator: operators[i - 1] ?? '*',
        left,
        right,
      };
    }

    return left;
  }

  private visitUnaryExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const primaryNode = children.primaryExpression?.[0] as CstNode;
    const operand = this.visitPrimaryExpression(primaryNode);

    // A unary expression always has a primary operand; the prefix token (if any)
    // determines the operator. (The earlier `!primaryNode` guards were never
    // true — a unary node always carries its primary — so signs were dropped.)
    if (children.Bang) {
      return { type: 'unary', operator: '!', operand };
    } else if (children.Plus) {
      return { type: 'unary', operator: '+', operand };
    } else if (children.Minus) {
      return { type: 'unary', operator: '-', operand };
    }

    return operand;
  }

  private visitPrimaryExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;

    if (children.brackettedExpression) {
      return this.visitBrackettedExpression(children.brackettedExpression[0] as CstNode);
    } else if (children.builtInCall) {
      return this.visitBuiltInCall(children.builtInCall[0] as CstNode);
    } else if (children.iriRef) {
      return {
        type: 'iri',
        value: this.visitIriRef(children.iriRef[0] as CstNode),
      };
    } else if (children.literal) {
      const lit = this.visitLiteral(children.literal[0] as CstNode);
      return {
        type: 'literal',
        value: lit.value,
        datatype: lit.datatype,
        language: lit.language,
      };
    } else if (children.variable) {
      const variable = this.visitVariable(children.variable[0] as CstNode);
      return {
        type: 'variable',
        name: variable.value,
      };
    }
    
    throw new Error('Unknown primaryExpression type');
  }

  private visitBrackettedExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    return this.visitExpression(children.expression[0] as CstNode);
  }

  private visitBuiltInCall(node: CstNode): FunctionCall {
    const children = node.children as CSTChildren;
    const identToken = children.Identifier?.[0] as IToken;
    const args: Expression[] = [];
    
    if (children.expressionList) {
      const exprListNode = children.expressionList[0] as CstNode;
      const exprListChildren = exprListNode.children as CSTChildren;
      
      if (exprListChildren.expression) {
        for (const exprNode of exprListChildren.expression) {
          args.push(this.visitExpression(exprNode as CstNode));
        }
      }
    }
    
    return {
      type: 'function',
      name: identToken.image.toUpperCase(),
      args,
    };
  }

  private extractIRI(iriWithBrackets: string): string {
    return iriWithBrackets.slice(1, -1);
  }

  private resolveIRI(iri: string): string {
    if (this.base && !iri.includes('://')) {
      return this.base + iri;
    }
    return iri;
  }

  private resolvePrefixedName(prefixedName: string): string {
    const colonIndex = prefixedName.indexOf(':');
    const prefix = prefixedName.substring(0, colonIndex);
    const localName = prefixedName.substring(colonIndex + 1);
    
    const namespace = this.prefixes.get(prefix);
    if (!namespace) {
      return prefixedName;
    }
    
    return namespace + localName;
  }

  private unescapeString(str: string): string {
    return str
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }
}

export function buildAST(code: string, options?: { extensions?: boolean }): RuleSet {
  const builder = new ASTBuilder();
  return builder.buildRuleSet(code, options);
}
