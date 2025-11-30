import { CstNode, IToken } from 'chevrotain';
import { parseSRL } from './parser';

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

export interface BindElement {
  type: 'bind';
  expression: Expression;
  variable: string;
  location?: SourceLocation;
}

export interface NegationElement {
  type: 'negation';
  patterns: BodyElement[];
  location?: SourceLocation;
}

export type BodyElement = TriplePattern | FilterElement | BindElement | NegationElement;

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

export interface ReflexiveDeclaration {
  type: 'reflexive';
  property: string;
  location?: SourceLocation;
}

export type Declaration = TransitiveDeclaration | SymmetricDeclaration | InverseDeclaration | ReflexiveDeclaration;

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

export interface ExistsExpression {
  type: 'exists';
  patterns: BodyElement[];
  negated: boolean;
}

// Path Expression Types
export interface PathIRI {
  pathType: 'iri';
  value: string;
}

export interface PathVariable {
  pathType: 'variable';
  name: string;
}

export interface PathSequence {
  pathType: 'sequence';
  elements: PathExpression[];
}

export interface PathAlternative {
  pathType: 'alternative';
  options: PathExpression[];
}

export interface PathInverse {
  pathType: 'inverse';
  path: PathExpression;
}

export interface PathZeroOrMore {
  pathType: 'zeroOrMore';
  path: PathExpression;
}

export interface PathOneOrMore {
  pathType: 'oneOrMore';
  path: PathExpression;
}

export interface PathZeroOrOne {
  pathType: 'zeroOrOne';
  path: PathExpression;
}

export interface PathNegatedPropertySet {
  pathType: 'negatedPropertySet';
  iris: Array<{ iri: string; inverse: boolean }>;
}

export type PathExpression = 
  | PathIRI 
  | PathVariable
  | PathSequence 
  | PathAlternative 
  | PathInverse 
  | PathZeroOrMore 
  | PathOneOrMore 
  | PathZeroOrOne
  | PathNegatedPropertySet;

export type Expression = 
  | BinaryExpression 
  | UnaryExpression 
  | FunctionCall 
  | VariableExpression 
  | LiteralExpression
  | IRIExpression
  | InExpression
  | ExistsExpression;

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

  public buildRuleSet(code: string): RuleSet {
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
        rules.push(this.visitRule(ruleNode as CstNode));
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

  private visitRule(node: CstNode): Rule {
    const children = node.children as CSTChildren;
    
    if (children.rule1) {
      return this.visitRule1(children.rule1[0] as CstNode);
    } else if (children.rule2) {
      return this.visitRule2(children.rule2[0] as CstNode);
    } else if (children.rule3) {
      return this.visitRule3(children.rule3[0] as CstNode);
    }
    
    throw new Error('Unknown rule type');
  }

  private visitRule1(node: CstNode): Rule {
    const children = node.children as CSTChildren;
    const headNode = children.headTemplate?.[0] as CstNode;
    const bodyNode = children.bodyPattern?.[0] as CstNode;
    
    return {
      type: 'rule',
      head: this.visitHeadTemplate(headNode),
      body: this.visitBodyPattern(bodyNode),
      location: getLocationFromNode(node),
    };
  }

  private visitRule2(node: CstNode): Rule {
    const children = node.children as CSTChildren;
    const bodyNode = children.bodyPattern?.[0] as CstNode;
    const headNode = children.headTemplate?.[0] as CstNode;
    
    return {
      type: 'rule',
      head: this.visitHeadTemplate(headNode),
      body: this.visitBodyPattern(bodyNode),
      location: getLocationFromNode(node),
    };
  }

  private visitRule3(node: CstNode): Rule {
    const children = node.children as CSTChildren;
    const headNode = children.headTemplate?.[0] as CstNode;
    const bodyNode = children.bodyPattern?.[0] as CstNode;
    
    return {
      type: 'rule',
      head: this.visitHeadTemplate(headNode),
      body: this.visitBodyPattern(bodyNode),
      location: getLocationFromNode(node),
    };
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
    } else if (children.Reflexive) {
      const iriNode = children.iriRef?.[0] as CstNode;
      return {
        type: 'reflexive',
        property: this.visitIriRef(iriNode),
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

  private visitTriplesSameSubject(node: CstNode): TriplePattern[] {
    const children = node.children as CSTChildren;
    const patterns: TriplePattern[] = [];
    
    const varOrTermNode = children.varOrTerm?.[0] as CstNode | undefined;
    const predicateObjectListNode = children.predicateObjectList?.[0] as CstNode | undefined;
    
    if (varOrTermNode && predicateObjectListNode) {
      const subject = this.visitVarOrTerm(varOrTermNode);
      const predicateObjects = this.visitPredicateObjectList(predicateObjectListNode);
      
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

  private visitPredicateObjectList(node: CstNode): Array<{ predicate: RDFTerm | PathExpression; objects: RDFTerm[] }> {
    const children = node.children as CSTChildren;
    const result: Array<{ predicate: RDFTerm | PathExpression; objects: RDFTerm[] }> = [];
    
    const verbNodes = children.verb as CstNode[] | undefined;
    const objectListNodes = children.objectList as CstNode[] | undefined;
    
    if (verbNodes && objectListNodes) {
      for (let i = 0; i < verbNodes.length && i < objectListNodes.length; i++) {
        const predicate = this.visitVerb(verbNodes[i]);
        const objects = this.visitObjectList(objectListNodes[i]);
        result.push({ predicate, objects });
      }
    }
    
    return result;
  }

  private visitVerb(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    
    if (children.RdfType) {
      return {
        termType: 'iri',
        value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      };
    } else if (children.pathExpression) {
      return this.visitPathExpression(children.pathExpression[0] as CstNode);
    }
    
    throw new Error('Unknown verb type');
  }

  private visitPathExpression(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const pathAltNode = children.pathAlternative?.[0] as CstNode;
    return this.visitPathAlternative(pathAltNode);
  }

  private visitPathAlternative(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const seqNodes = children.pathSequence as CstNode[];
    
    if (seqNodes.length === 1) {
      return this.visitPathSequence(seqNodes[0]);
    }
    
    const options = seqNodes.map(n => this.visitPathSequence(n));
    // If all options are simple paths (single elements), check if they can be simplified
    const allPaths = options.map(o => this.toPathExpression(o));
    
    return {
      pathType: 'alternative',
      options: allPaths,
    };
  }

  private visitPathSequence(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const eltNodes = children.pathEltOrInverse as CstNode[];
    
    if (eltNodes.length === 1) {
      return this.visitPathEltOrInverse(eltNodes[0]);
    }
    
    const elements = eltNodes.map(n => this.visitPathEltOrInverse(n));
    const allPaths = elements.map(e => this.toPathExpression(e));
    
    return {
      pathType: 'sequence',
      elements: allPaths,
    };
  }

  private visitPathEltOrInverse(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const isInverse = !!children.Caret;
    const pathEltNode = children.pathElt?.[0] as CstNode;
    const elt = this.visitPathElt(pathEltNode);
    
    if (isInverse) {
      return {
        pathType: 'inverse',
        path: this.toPathExpression(elt),
      };
    }
    
    return elt;
  }

  private visitPathElt(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    const primaryNode = children.pathPrimary?.[0] as CstNode;
    const modNode = children.pathMod?.[0] as CstNode | undefined;
    
    let primary = this.visitPathPrimary(primaryNode);
    
    if (modNode) {
      const mod = this.visitPathMod(modNode);
      const path = this.toPathExpression(primary);
      
      switch (mod) {
        case '?':
          return { pathType: 'zeroOrOne', path };
        case '*':
          return { pathType: 'zeroOrMore', path };
        case '+':
          return { pathType: 'oneOrMore', path };
      }
    }
    
    return primary;
  }

  private visitPathMod(node: CstNode): '?' | '*' | '+' {
    const children = node.children as CSTChildren;
    if (children.QuestionMark) return '?';
    if (children.Asterisk) return '*';
    if (children.Plus) return '+';
    throw new Error('Unknown path modifier');
  }

  private visitPathPrimary(node: CstNode): RDFTerm | PathExpression {
    const children = node.children as CSTChildren;
    
    if (children.pathExpression) {
      return this.visitPathExpression(children.pathExpression[0] as CstNode);
    } else if (children.Bang && children.pathNegatedPropertySet) {
      return this.visitPathNegatedPropertySet(children.pathNegatedPropertySet[0] as CstNode);
    } else if (children.varOrIri) {
      return this.visitVarOrIri(children.varOrIri[0] as CstNode);
    }
    
    throw new Error('Unknown path primary type');
  }

  private visitPathNegatedPropertySet(node: CstNode): PathExpression {
    const children = node.children as CSTChildren;
    const iris: Array<{ iri: string; inverse: boolean }> = [];
    
    if (children.pathOneInPropertySet) {
      for (const propNode of children.pathOneInPropertySet as CstNode[]) {
        const propChildren = propNode.children as CSTChildren;
        const isInverse = !!propChildren.Caret;
        const iriNode = propChildren.iriRef?.[0] as CstNode;
        if (iriNode) {
          iris.push({ iri: this.visitIriRef(iriNode), inverse: isInverse });
        }
      }
    }
    
    return {
      pathType: 'negatedPropertySet',
      iris,
    };
  }

  private toPathExpression(term: RDFTerm | PathExpression): PathExpression {
    if ('pathType' in term) {
      return term;
    }
    if (term.termType === 'iri') {
      return { pathType: 'iri', value: term.value };
    }
    if (term.termType === 'variable') {
      return { pathType: 'variable', name: term.value };
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
    
    throw new Error('Reified triples not yet supported');
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
    } else if (children.triplesTemplate) {
      return this.visitTriplesTemplate(children.triplesTemplate[0] as CstNode);
    } else if (children.triplesSameSubjectWithContinuation) {
      return this.visitTriplesSameSubject(children.triplesSameSubjectWithContinuation[0] as CstNode);
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
    const bodyPattern1Node = children.bodyPattern1?.[0] as CstNode;
    
    return {
      type: 'negation',
      patterns: this.visitBodyPattern1(bodyPattern1Node),
      location: getLocationFromNode(node),
    };
  }

  private visitAssignment(node: CstNode): BindElement {
    const children = node.children as CSTChildren;
    const expressionNode = children.expression?.[0] as CstNode;
    const variableNode = children.variable?.[0] as CstNode;
    
    const variable = this.visitVariable(variableNode);
    
    return {
      type: 'bind',
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
    }
    
    throw new Error('Unknown constraint type');
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

  private visitAdditiveExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const multNodes = children.multiplicativeExpression as CstNode[];
    const plusTokens = children.Plus as IToken[] | undefined;
    const minusTokens = children.Minus as IToken[] | undefined;
    
    if (multNodes.length === 1) {
      return this.visitMultiplicativeExpression(multNodes[0]);
    }
    
    let left = this.visitMultiplicativeExpression(multNodes[0]);
    
    for (let i = 1; i < multNodes.length; i++) {
      const right = this.visitMultiplicativeExpression(multNodes[i]);
      const isPlus = plusTokens?.some(t => this.isTokenBeforeNode(t, multNodes[i]));
      left = {
        type: 'binary',
        operator: isPlus ? '+' : '-',
        left,
        right,
      };
    }
    
    return left;
  }

  private visitMultiplicativeExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const unaryNodes = children.unaryExpression as CstNode[];
    const asteriskTokens = children.Asterisk as IToken[] | undefined;
    
    if (unaryNodes.length === 1) {
      return this.visitUnaryExpression(unaryNodes[0]);
    }
    
    let left = this.visitUnaryExpression(unaryNodes[0]);
    
    for (let i = 1; i < unaryNodes.length; i++) {
      const right = this.visitUnaryExpression(unaryNodes[i]);
      const isMult = asteriskTokens?.some(t => this.isTokenBeforeNode(t, unaryNodes[i]));
      left = {
        type: 'binary',
        operator: isMult ? '*' : '/',
        left,
        right,
      };
    }
    
    return left;
  }

  private visitUnaryExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    const primaryNode = children.primaryExpression?.[0] as CstNode;
    
    if (children.Bang) {
      return {
        type: 'unary',
        operator: '!',
        operand: this.visitPrimaryExpression(primaryNode),
      };
    } else if (children.Plus && !primaryNode) {
      return {
        type: 'unary',
        operator: '+',
        operand: this.visitPrimaryExpression(children.primaryExpression?.[0] as CstNode),
      };
    } else if (children.Minus && !children.primaryExpression) {
      return {
        type: 'unary',
        operator: '-',
        operand: this.visitPrimaryExpression(children.primaryExpression?.[0] as CstNode),
      };
    }
    
    return this.visitPrimaryExpression(primaryNode);
  }

  private visitPrimaryExpression(node: CstNode): Expression {
    const children = node.children as CSTChildren;
    
    if (children.existsFunc) {
      return this.visitExistsFunc(children.existsFunc[0] as CstNode);
    } else if (children.notExistsFunc) {
      return this.visitNotExistsFunc(children.notExistsFunc[0] as CstNode);
    } else if (children.brackettedExpression) {
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

  private visitExistsFunc(node: CstNode): ExistsExpression {
    const children = node.children as CSTChildren;
    const bodyPattern1Node = children.bodyPattern1?.[0] as CstNode;
    
    return {
      type: 'exists',
      patterns: this.visitBodyPattern1(bodyPattern1Node),
      negated: false,
    };
  }

  private visitNotExistsFunc(node: CstNode): ExistsExpression {
    const children = node.children as CSTChildren;
    const bodyPattern1Node = children.bodyPattern1?.[0] as CstNode;
    
    return {
      type: 'exists',
      patterns: this.visitBodyPattern1(bodyPattern1Node),
      negated: true,
    };
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

  private isTokenBeforeNode(token: IToken, node: CstNode): boolean {
    const loc = getLocationFromNode(node);
    if (!loc) return false;
    const tokenEnd = token.endOffset ?? token.startOffset;
    const nodeStart = this.getNodeStartOffset(node);
    return tokenEnd < nodeStart;
  }

  private getNodeStartOffset(node: CstNode): number {
    const children = node.children as CSTChildren;
    for (const key of Object.keys(children)) {
      const items = children[key];
      if (items?.length > 0) {
        const first = items[0];
        if ('startOffset' in first) {
          return first.startOffset;
        } else if ('children' in first) {
          return this.getNodeStartOffset(first);
        }
      }
    }
    return 0;
  }
}

export function buildAST(code: string): RuleSet {
  const builder = new ASTBuilder();
  return builder.buildRuleSet(code);
}
