import { CstParser, IRecognitionException, IToken, ISerializedGast } from 'chevrotain';
import {
  allTokens,
  SRLLexer,
  Rule,
  Where,
  If,
  Then,
  Data,
  Prefix,
  Base,
  Filter,
  Not,
  Set,
  Transitive,
  Symmetric,
  Inverse,
  In,
  Version,
  Imports,
  RdfType,
  LBrace,
  RBrace,
  LParen,
  RParen,
  Dot,
  Comma,
  Semicolon,
  Colon,
  Assign,
  DoubleCaret,
  Caret,
  Equals,
  NotEquals,
  LessThan,
  GreaterThan,
  LessOrEqual,
  GreaterOrEqual,
  Plus,
  Minus,
  Asterisk,
  Slash,
  Ampersand,
  DoublePipe,
  Bang,
  QuestionVar,
  DollarVar,
  IRI,
  PrefixedName,
  ColonLocalName,
  BlankNode,
  StringLiteralQuote,
  StringLiteralSingleQuote,
  StringLiteralLongQuote,
  StringLiteralLongSingleQuote,
  LangTag,
  Decimal,
  Double,
  Integer,
  True,
  False,
  Identifier,
} from './tokens';

export class SRLParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
    });
    this.performSelfAnalysis();
  }

  // Entry point: RuleSet = ( Prologue ( Rule | Data ) )*
  public ruleSet = this.RULE('ruleSet', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.baseDecl) },
        { ALT: () => this.SUBRULE(this.prefixDecl) },
        { ALT: () => this.SUBRULE(this.versionDecl) },
        { ALT: () => this.SUBRULE(this.importsDecl) },
        { ALT: () => this.SUBRULE(this.rule) },
        { ALT: () => this.SUBRULE(this.dataBlock) },
        { ALT: () => this.SUBRULE(this.declaration) },
      ]);
    });
  });

  // BaseDecl = 'BASE' IRI
  private baseDecl = this.RULE('baseDecl', () => {
    this.CONSUME(Base);
    this.CONSUME(IRI);
  });

  // PrefixDecl = 'PREFIX' PNAME_NS IRI
  private prefixDecl = this.RULE('prefixDecl', () => {
    this.CONSUME(Prefix);
    this.OR([
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => {} }, // empty prefix
    ]);
    this.CONSUME(Colon);
    this.CONSUME(IRI);
  });

  // VersionDecl = 'VERSION' literal
  private versionDecl = this.RULE('versionDecl', () => {
    this.CONSUME(Version);
    this.SUBRULE(this.literal);
  });

  // ImportsDecl = 'IMPORTS' IRI
  private importsDecl = this.RULE('importsDecl', () => {
    this.CONSUME(Imports);
    this.CONSUME(IRI);
  });

  // Rule = Rule1 | Rule2   (SHACL 1.2 Rules [11] — the datalog ':-' form is gone)
  private rule = this.RULE('rule', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.rule1) },
      { ALT: () => this.SUBRULE(this.rule2) },
    ]);
  });

  // Rule1 = 'RULE' iri? HeadTemplate 'WHERE' BodyPattern  ([12] — optional naming IRI)
  private rule1 = this.RULE('rule1', () => {
    this.CONSUME(Rule);
    this.OPTION(() => this.SUBRULE(this.iriRef));
    this.SUBRULE(this.headTemplate);
    this.CONSUME(Where);
    this.SUBRULE(this.bodyPattern);
  });

  // Rule2 = 'IF' BodyPattern 'THEN' HeadTemplate  ([13])
  private rule2 = this.RULE('rule2', () => {
    this.CONSUME(If);
    this.SUBRULE(this.bodyPattern);
    this.CONSUME(Then);
    this.SUBRULE(this.headTemplate);
  });

  // Declaration = 'TRANSITIVE' '(' iri ')' | '(' iri ')' 'SYMMETRIC' | 'INVERSE' '(' iri ',' iri ')'  ([27])
  // Note: SYMMETRIC is POSTFIX (the IRI precedes the keyword); TRANSITIVE/INVERSE stay prefix.
  // There is no REFLEXIVE declaration in SHACL 1.2 Rules.
  private declaration = this.RULE('declaration', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Transitive);
          this.CONSUME(LParen);
          this.SUBRULE(this.iriRef);
          this.CONSUME(RParen);
        },
      },
      {
        // Postfix symmetric: '(' iri ')' SYMMETRIC
        ALT: () => {
          this.CONSUME2(LParen);
          this.SUBRULE2(this.iriRef);
          this.CONSUME2(RParen);
          this.CONSUME(Symmetric);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Inverse);
          this.CONSUME3(LParen);
          this.SUBRULE3(this.iriRef);
          this.CONSUME(Comma);
          this.SUBRULE4(this.iriRef);
          this.CONSUME3(RParen);
        },
      },
    ]);
  });

  // Data = 'DATA' '{' TriplesTemplate? '}'  ([14]) — template family (no paths; must be ground)
  private dataBlock = this.RULE('dataBlock', () => {
    this.CONSUME(Data);
    this.SUBRULE(this.triplesTemplateBlock);
  });

  // HeadTemplate = '{' TriplesTemplate? '}'  ([15]) — template family (no property paths)
  private headTemplate = this.RULE('headTemplate', () => {
    this.SUBRULE(this.triplesTemplateBlock);
  });

  // BodyPattern = '{' BodyPattern1 '}'  ([16])
  private bodyPattern = this.RULE('bodyPattern', () => {
    this.CONSUME(LBrace);
    this.SUBRULE(this.bodyPattern1);
    this.CONSUME(RBrace);
  });

  // BodyPattern1 = ( BodyBasic ( '.' BodyBasic? | BodyBasic )* )?  ([16])
  // The dot separates triple patterns, but is OPTIONAL around FILTER/NOT/SET
  // elements, so a not-triples element may be followed directly by more triples.
  // The two MANY alternatives have disjoint first sets (Dot vs an element start),
  // so there is no ambiguity, and every element stays in one ordered CST array.
  private bodyPattern1 = this.RULE('bodyPattern1', () => {
    this.OPTION(() => {
      this.SUBRULE(this.bodyBasic);
      this.MANY(() => {
        this.OR([
          {
            ALT: () => {
              this.CONSUME(Dot);
              this.OPTION2(() => this.SUBRULE2(this.bodyBasic));
            },
          },
          { ALT: () => this.SUBRULE3(this.bodyBasic) },
        ]);
      });
    });
  });

  // BodyBasic = BodyNotTriples | TriplesSameSubjectPattern
  private bodyBasic = this.RULE('bodyBasic', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.bodyNotTriples) },
      { ALT: () => this.SUBRULE(this.triplesSameSubjectPattern) },
    ]);
  });

  // BodyNotTriples = Filter | Negation | Assignment  ([17])
  private bodyNotTriples = this.RULE('bodyNotTriples', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.filterClause) },
      { ALT: () => this.SUBRULE(this.negation) },
      { ALT: () => this.SUBRULE(this.assignment) },
    ]);
  });

  // Filter = 'FILTER' Constraint  ([18])
  private filterClause = this.RULE('filterClause', () => {
    this.CONSUME(Filter);
    this.SUBRULE(this.constraint);
  });

  // Negation = 'NOT' '{' BodyBasicSeq '}'  ([23])
  // A negation body admits triple patterns and FILTER only — no nested NOT, no SET.
  private negation = this.RULE('negation', () => {
    this.CONSUME(Not);
    this.CONSUME(LBrace);
    this.SUBRULE(this.bodyBasicSeq);
    this.CONSUME(RBrace);
  });

  // BodyBasicSeq = ( BodyBasicElement ( '.' BodyBasicElement? )* )?  ([24])
  private bodyBasicSeq = this.RULE('bodyBasicSeq', () => {
    this.OPTION(() => {
      this.SUBRULE(this.bodyBasicElement);
      this.MANY(() => {
        this.CONSUME(Dot);
        this.OPTION2(() => {
          this.SUBRULE2(this.bodyBasicElement);
        });
      });
    });
  });

  // BodyBasicElement = Filter | TriplesSameSubjectPattern  ([25] — filters only, no NOT/SET)
  private bodyBasicElement = this.RULE('bodyBasicElement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.filterClause) },
      { ALT: () => this.SUBRULE(this.triplesSameSubjectPattern) },
    ]);
  });

  // Assignment = 'SET' '(' Var ':=' Expression ')'  ([26])
  private assignment = this.RULE('assignment', () => {
    this.CONSUME(Set);
    this.CONSUME(LParen);
    this.SUBRULE(this.variable);
    this.CONSUME(Assign);
    this.SUBRULE(this.expression);
    this.CONSUME(RParen);
  });

  // Constraint = BrackettedExpression | BuiltInCall | FunctionCall  ([19])
  private constraint = this.RULE('constraint', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.brackettedExpression) },
      { ALT: () => this.SUBRULE(this.builtInCall) },
      { ALT: () => this.SUBRULE(this.functionCall) },
    ]);
  });

  // FunctionCall = iri ArgList  ([20])
  private functionCall = this.RULE('functionCall', () => {
    this.SUBRULE(this.iriRef);
    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.expressionList));
    this.CONSUME(RParen);
  });

  // ===========================================================================
  // Template family (head templates + DATA blocks): no property paths.
  // ===========================================================================

  // TriplesTemplateBlock = '{' TriplesTemplate? '}'  ([15])
  private triplesTemplateBlock = this.RULE('triplesTemplateBlock', () => {
    this.CONSUME(LBrace);
    this.OPTION(() => {
      this.SUBRULE(this.triplesTemplate);
    });
    this.CONSUME(RBrace);
  });

  // TriplesTemplate = TriplesSameSubject ( '.' TriplesSameSubject? )*
  private triplesTemplate = this.RULE('triplesTemplate', () => {
    this.SUBRULE(this.triplesSameSubject);
    this.MANY(() => {
      this.CONSUME(Dot);
      this.OPTION(() => {
        this.SUBRULE2(this.triplesSameSubject);
      });
    });
  });

  // TriplesSameSubject = VarOrTerm PredicateObjectListTemplate
  private triplesSameSubject = this.RULE('triplesSameSubject', () => {
    this.SUBRULE(this.varOrTerm);
    this.SUBRULE(this.predicateObjectListTemplate);
  });

  // PredicateObjectListTemplate = VerbTemplate ObjectList ( ';' ( VerbTemplate ObjectList )? )*
  private predicateObjectListTemplate = this.RULE('predicateObjectListTemplate', () => {
    this.SUBRULE(this.verbTemplate);
    this.SUBRULE(this.objectList);
    this.MANY(() => {
      this.CONSUME(Semicolon);
      this.OPTION(() => {
        this.SUBRULE2(this.verbTemplate);
        this.SUBRULE2(this.objectList);
      });
    });
  });

  // VerbTemplate = 'a' | VarOrIri  ([86] — no property paths in templates)
  private verbTemplate = this.RULE('verbTemplate', () => {
    this.OR([
      { ALT: () => this.CONSUME(RdfType) },
      { ALT: () => this.SUBRULE(this.varOrIri) },
    ]);
  });

  // ===========================================================================
  // Pattern family (rule bodies): property paths and variable predicates allowed.
  // ===========================================================================

  // TriplesSameSubjectPattern = VarOrTerm PredicateObjectListPattern
  private triplesSameSubjectPattern = this.RULE('triplesSameSubjectPattern', () => {
    this.SUBRULE(this.varOrTerm);
    this.SUBRULE(this.predicateObjectListPattern);
  });

  // PredicateObjectListPattern = VerbPattern ObjectList ( ';' ( VerbPattern ObjectList )? )*  ([69])
  private predicateObjectListPattern = this.RULE('predicateObjectListPattern', () => {
    this.SUBRULE(this.verbPattern);
    this.SUBRULE(this.objectList);
    this.MANY(() => {
      this.CONSUME(Semicolon);
      this.OPTION(() => {
        this.SUBRULE2(this.verbPattern);
        this.SUBRULE2(this.objectList);
      });
    });
  });

  // VerbPattern = Path | Var  ([87] VerbPath, plus the predicate-position variable)
  private verbPattern = this.RULE('verbPattern', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.variable) },
      { ALT: () => this.SUBRULE(this.path) },
    ]);
  });

  // Path = PathSequence  ([88])
  private path = this.RULE('path', () => {
    this.SUBRULE(this.pathSequence);
  });

  // PathSequence = PathEltOrInverse ( '/' PathEltOrInverse )*  ([89])
  private pathSequence = this.RULE('pathSequence', () => {
    this.SUBRULE(this.pathEltOrInverse);
    this.MANY(() => {
      this.CONSUME(Slash);
      this.SUBRULE2(this.pathEltOrInverse);
    });
  });

  // PathEltOrInverse = PathElt | '^' PathElt  ([90])
  private pathEltOrInverse = this.RULE('pathEltOrInverse', () => {
    this.OPTION(() => this.CONSUME(Caret));
    this.SUBRULE(this.pathElt);
  });

  // PathElt = iri | 'a' | '(' Path ')'  ([91] — no *, +, ?, |, or negated property sets)
  private pathElt = this.RULE('pathElt', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(LParen);
          this.SUBRULE(this.path);
          this.CONSUME(RParen);
        },
      },
      { ALT: () => this.CONSUME(RdfType) },
      { ALT: () => this.SUBRULE(this.iriRef) },
    ]);
  });

  // ObjectList = Object ( ',' Object )*  (shared by both families)
  private objectList = this.RULE('objectList', () => {
    this.SUBRULE(this.objectTerm);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.objectTerm);
    });
  });

  // Object = VarOrTerm
  private objectTerm = this.RULE('objectTerm', () => {
    this.SUBRULE(this.varOrTerm);
  });

  // VarOrTerm = Var | GraphTerm
  private varOrTerm = this.RULE('varOrTerm', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.variable) },
      { ALT: () => this.SUBRULE(this.graphTerm) },
    ]);
  });

  // VarOrIRI = Var | IRI
  private varOrIri = this.RULE('varOrIri', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.variable) },
      { ALT: () => this.SUBRULE(this.iriRef) },
    ]);
  });

  // Var = QuestionVar | DollarVar
  private variable = this.RULE('variable', () => {
    this.OR([
      { ALT: () => this.CONSUME(QuestionVar) },
      { ALT: () => this.CONSUME(DollarVar) },
    ]);
  });

  // GraphTerm = IRI | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode
  // (RDF collections `( … )` are deferred; see the "Not Yet Implemented" backlog.)
  private graphTerm = this.RULE('graphTerm', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.iriRef) },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.CONSUME(BlankNode) },
    ]);
  });

  // IRI = IRI_REF | PrefixedName
  private iriRef = this.RULE('iriRef', () => {
    this.OR([
      { ALT: () => this.CONSUME(IRI) },
      { ALT: () => this.CONSUME(PrefixedName) },
      { ALT: () => this.CONSUME(ColonLocalName) },
    ]);
  });

  // Literal = RDFLiteral | NumericLiteral | BooleanLiteral
  private literal = this.RULE('literal', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.rdfLiteral) },
      { ALT: () => this.SUBRULE(this.numericLiteral) },
      { ALT: () => this.SUBRULE(this.booleanLiteral) },
    ]);
  });

  // RDFLiteral = String ( LANGTAG | '^^' IRI )?
  private rdfLiteral = this.RULE('rdfLiteral', () => {
    this.SUBRULE(this.string);
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(LangTag) },
        {
          ALT: () => {
            this.CONSUME(DoubleCaret);
            this.SUBRULE(this.iriRef);
          },
        },
      ]);
    });
  });

  // String = STRING_LITERAL_QUOTE | STRING_LITERAL_SINGLE_QUOTE | etc.
  private string = this.RULE('string', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteralLongQuote) },
      { ALT: () => this.CONSUME(StringLiteralLongSingleQuote) },
      { ALT: () => this.CONSUME(StringLiteralQuote) },
      { ALT: () => this.CONSUME(StringLiteralSingleQuote) },
    ]);
  });

  // NumericLiteral = Integer | Decimal | Double
  private numericLiteral = this.RULE('numericLiteral', () => {
    this.OR([
      { ALT: () => this.CONSUME(Double) },
      { ALT: () => this.CONSUME(Decimal) },
      { ALT: () => this.CONSUME(Integer) },
    ]);
  });

  // BooleanLiteral = 'true' | 'false'
  private booleanLiteral = this.RULE('booleanLiteral', () => {
    this.OR([
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ]);
  });

  // Expression = ConditionalOrExpression
  private expression = this.RULE('expression', () => {
    this.SUBRULE(this.conditionalOrExpression);
  });

  // ConditionalOrExpression = ConditionalAndExpression ( '||' ConditionalAndExpression )*
  private conditionalOrExpression = this.RULE('conditionalOrExpression', () => {
    this.SUBRULE(this.conditionalAndExpression);
    this.MANY(() => {
      this.CONSUME(DoublePipe);
      this.SUBRULE2(this.conditionalAndExpression);
    });
  });

  // ConditionalAndExpression = ValueLogical ( '&&' ValueLogical )*
  private conditionalAndExpression = this.RULE('conditionalAndExpression', () => {
    this.SUBRULE(this.valueLogical);
    this.MANY(() => {
      this.CONSUME(Ampersand);
      this.SUBRULE2(this.valueLogical);
    });
  });

  // ValueLogical = RelationalExpression
  private valueLogical = this.RULE('valueLogical', () => {
    this.SUBRULE(this.relationalExpression);
  });

  // RelationalExpression = NumericExpression ( '=' | '!=' | '<' | '>' | '<=' | '>=' ) NumericExpression )? | NumericExpression 'IN' ExpressionList | NumericExpression 'NOT' 'IN' ExpressionList
  private relationalExpression = this.RULE('relationalExpression', () => {
    this.SUBRULE(this.numericExpression);
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Equals);
            this.SUBRULE2(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(NotEquals);
            this.SUBRULE3(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(LessThan);
            this.SUBRULE4(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(GreaterThan);
            this.SUBRULE5(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(LessOrEqual);
            this.SUBRULE6(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(GreaterOrEqual);
            this.SUBRULE7(this.numericExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(In);
            this.CONSUME(LParen);
            this.OPTION2(() => this.SUBRULE(this.expressionList));
            this.CONSUME(RParen);
          },
        },
        {
          ALT: () => {
            this.CONSUME(Not);
            this.CONSUME2(In);
            this.CONSUME2(LParen);
            this.OPTION3(() => this.SUBRULE2(this.expressionList));
            this.CONSUME2(RParen);
          },
        },
      ]);
    });
  });

  // NumericExpression = AdditiveExpression
  private numericExpression = this.RULE('numericExpression', () => {
    this.SUBRULE(this.additiveExpression);
  });

  // AdditiveExpression = MultiplicativeExpression ( ('+' | '-') MultiplicativeExpression )*
  private additiveExpression = this.RULE('additiveExpression', () => {
    this.SUBRULE(this.multiplicativeExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Plus);
            this.SUBRULE2(this.multiplicativeExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(Minus);
            this.SUBRULE3(this.multiplicativeExpression);
          },
        },
      ]);
    });
  });

  // MultiplicativeExpression = UnaryExpression ( ('*' | '/') UnaryExpression )*
  private multiplicativeExpression = this.RULE('multiplicativeExpression', () => {
    this.SUBRULE(this.unaryExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Asterisk);
            this.SUBRULE2(this.unaryExpression);
          },
        },
        {
          ALT: () => {
            this.CONSUME(Slash);
            this.SUBRULE3(this.unaryExpression);
          },
        },
      ]);
    });
  });

  // UnaryExpression = '!' PrimaryExpression | '+' PrimaryExpression | '-' PrimaryExpression | PrimaryExpression
  private unaryExpression = this.RULE('unaryExpression', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Bang);
          this.SUBRULE(this.primaryExpression);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Plus);
          this.SUBRULE2(this.primaryExpression);
        },
      },
      {
        ALT: () => {
          this.CONSUME(Minus);
          this.SUBRULE3(this.primaryExpression);
        },
      },
      { ALT: () => this.SUBRULE4(this.primaryExpression) },
    ]);
  });

  // PrimaryExpression = BrackettedExpression | BuiltInCall | IRI | Literal | Var
  // (SHACL 1.2 Rules has no EXISTS / NOT EXISTS in expressions; negation is only `NOT { … }`.)
  private primaryExpression = this.RULE('primaryExpression', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.brackettedExpression) },
      { ALT: () => this.SUBRULE(this.builtInCall) },
      { ALT: () => this.SUBRULE(this.iriRef) },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.variable) },
    ]);
  });

  // BrackettedExpression = '(' Expression ')'
  private brackettedExpression = this.RULE('brackettedExpression', () => {
    this.CONSUME(LParen);
    this.SUBRULE(this.expression);
    this.CONSUME(RParen);
  });

  // BuiltInCall = Identifier '(' ExpressionList? ')'
  private builtInCall = this.RULE('builtInCall', () => {
    this.CONSUME(Identifier);
    this.CONSUME(LParen);
    this.OPTION(() => {
      this.SUBRULE(this.expressionList);
    });
    this.CONSUME(RParen);
  });

  // ExpressionList = Expression ( ',' Expression )*
  private expressionList = this.RULE('expressionList', () => {
    this.SUBRULE(this.expression);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.expression);
    });
  });
}

// Singleton parser instance
const parserInstance = new SRLParser();

export interface ParseResult {
  cst: unknown;
  errors: IRecognitionException[];
  tokens: IToken[];
}

export function parseSRL(text: string): ParseResult {
  const lexResult = SRLLexer.tokenize(text);
  
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.ruleSet();
  
  return {
    cst,
    errors: [...lexResult.errors.map((e) => ({
      message: e.message,
      token: {
        image: '',
        startOffset: e.offset,
        startLine: e.line ?? 1,
        startColumn: e.column ?? 1,
        endOffset: e.offset,
        endLine: e.line ?? 1,
        endColumn: e.column ?? 1,
      },
    })), ...parserInstance.errors] as IRecognitionException[],
    tokens: lexResult.tokens,
  };
}

export interface GrammarRuleInfo {
  name: string;
  category: 'entry' | 'prologue' | 'rules' | 'patterns' | 'terms' | 'expressions' | 'literals';
}

const RULE_CATEGORIES: Record<string, GrammarRuleInfo['category']> = {
  ruleSet: 'entry',
  baseDecl: 'prologue',
  prefixDecl: 'prologue',
  versionDecl: 'prologue',
  importsDecl: 'prologue',
  rule: 'rules',
  rule1: 'rules',
  rule2: 'rules',
  declaration: 'rules',
  dataBlock: 'rules',
  headTemplate: 'patterns',
  bodyPattern: 'patterns',
  bodyPattern1: 'patterns',
  bodyBasic: 'patterns',
  bodyNotTriples: 'patterns',
  filterClause: 'patterns',
  negation: 'patterns',
  bodyBasicSeq: 'patterns',
  bodyBasicElement: 'patterns',
  assignment: 'patterns',
  constraint: 'patterns',
  functionCall: 'patterns',
  triplesTemplateBlock: 'terms',
  triplesTemplate: 'terms',
  triplesSameSubject: 'terms',
  predicateObjectListTemplate: 'terms',
  verbTemplate: 'terms',
  triplesSameSubjectPattern: 'terms',
  predicateObjectListPattern: 'terms',
  verbPattern: 'terms',
  path: 'terms',
  pathSequence: 'terms',
  pathEltOrInverse: 'terms',
  pathElt: 'terms',
  objectList: 'terms',
  objectTerm: 'terms',
  varOrTerm: 'terms',
  varOrIri: 'terms',
  variable: 'terms',
  graphTerm: 'terms',
  iriRef: 'terms',
  literal: 'literals',
  rdfLiteral: 'literals',
  string: 'literals',
  numericLiteral: 'literals',
  booleanLiteral: 'literals',
  expression: 'expressions',
  conditionalOrExpression: 'expressions',
  conditionalAndExpression: 'expressions',
  valueLogical: 'expressions',
  relationalExpression: 'expressions',
  numericExpression: 'expressions',
  additiveExpression: 'expressions',
  multiplicativeExpression: 'expressions',
  unaryExpression: 'expressions',
  primaryExpression: 'expressions',
  brackettedExpression: 'expressions',
  builtInCall: 'expressions',
  expressionList: 'expressions',
};

export function getSerializedGrammar(): ISerializedGast[] {
  return parserInstance.getSerializedGastProductions();
}

export function getGrammarRuleNames(): GrammarRuleInfo[] {
  const productions = parserInstance.getGAstProductions();
  return Object.keys(productions).map(name => ({
    name,
    category: RULE_CATEGORIES[name] || 'patterns',
  }));
}

export function getParserInstance(): SRLParser {
  return parserInstance;
}
