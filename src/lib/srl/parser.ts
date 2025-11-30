import { CstParser, IRecognitionException, IToken, ISerializedGast } from 'chevrotain';
import {
  allTokens,
  Rule,
  Where,
  If,
  Then,
  Data,
  Prefix,
  Base,
  Filter,
  Bind,
  As,
  Not,
  Transitive,
  Symmetric,
  Inverse,
  Version,
  Imports,
  RdfType,
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  LAngle,
  RAngle,
  DoubleLeftAngle,
  DoubleRightAngle,
  Dot,
  Comma,
  Semicolon,
  Colon,
  ColonMinus,
  DoubleCaret,
  Caret,
  Pipe,
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
  Percent,
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

  // Rule = Rule1 | Rule2 | Rule3
  private rule = this.RULE('rule', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.rule1) },
      { ALT: () => this.SUBRULE(this.rule2) },
      { ALT: () => this.SUBRULE(this.rule3) },
    ]);
  });

  // Rule1 = 'RULE' HeadTemplate 'WHERE' BodyPattern
  private rule1 = this.RULE('rule1', () => {
    this.CONSUME(Rule);
    this.SUBRULE(this.headTemplate);
    this.CONSUME(Where);
    this.SUBRULE(this.bodyPattern);
  });

  // Rule2 = 'IF' BodyPattern 'THEN' HeadTemplate
  private rule2 = this.RULE('rule2', () => {
    this.CONSUME(If);
    this.SUBRULE(this.bodyPattern);
    this.CONSUME(Then);
    this.SUBRULE(this.headTemplate);
  });

  // Rule3 = HeadTemplate ':-' BodyPattern
  private rule3 = this.RULE('rule3', () => {
    this.SUBRULE(this.headTemplate);
    this.CONSUME(ColonMinus);
    this.SUBRULE(this.bodyPattern);
  });

  // Declaration = 'TRANSITIVE' '(' iri ')' | 'SYMMETRIC' '(' iri ')' | 'INVERSE' '(' iri ',' iri ')'
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
        ALT: () => {
          this.CONSUME(Symmetric);
          this.CONSUME2(LParen);
          this.SUBRULE2(this.iriRef);
          this.CONSUME2(RParen);
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

  // Data = 'DATA' TriplesTemplateBlock
  private dataBlock = this.RULE('dataBlock', () => {
    this.CONSUME(Data);
    this.SUBRULE(this.triplesTemplateBlock);
  });

  // HeadTemplate = TriplesTemplateBlock
  private headTemplate = this.RULE('headTemplate', () => {
    this.SUBRULE(this.triplesTemplateBlock);
  });

  // BodyPattern = '{' BodyPattern1 '}'
  private bodyPattern = this.RULE('bodyPattern', () => {
    this.CONSUME(LBrace);
    this.SUBRULE(this.bodyPattern1);
    this.CONSUME(RBrace);
  });

  // BodyPattern1 = BodyBasic ( '.' BodyPattern1 )?
  private bodyPattern1 = this.RULE('bodyPattern1', () => {
    this.OPTION(() => {
      this.SUBRULE(this.bodyBasic);
      this.MANY(() => {
        this.CONSUME(Dot);
        this.OPTION2(() => {
          this.SUBRULE2(this.bodyBasic);
        });
      });
    });
  });

  // BodyBasic = TriplesTemplate | BodyNotTriples
  private bodyBasic = this.RULE('bodyBasic', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.bodyNotTriples) },
      { ALT: () => this.SUBRULE(this.triplesSameSubjectWithContinuation) },
    ]);
  });

  // TriplesSameSubjectWithContinuation handles the subject and predicate-object list
  // but NOT the trailing dot (which is handled by bodyPattern1)
  private triplesSameSubjectWithContinuation = this.RULE('triplesSameSubjectWithContinuation', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.varOrTerm);
          this.SUBRULE(this.predicateObjectList);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.reifiedTriple);
          this.OPTION(() => {
            this.SUBRULE2(this.predicateObjectList);
          });
        },
      },
    ]);
  });

  // BodyNotTriples = Filter | Negation | Assignment
  private bodyNotTriples = this.RULE('bodyNotTriples', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.filterClause) },
      { ALT: () => this.SUBRULE(this.negation) },
      { ALT: () => this.SUBRULE(this.assignment) },
    ]);
  });

  // Filter = 'FILTER' Constraint
  private filterClause = this.RULE('filterClause', () => {
    this.CONSUME(Filter);
    this.SUBRULE(this.constraint);
  });

  // Negation = 'NOT' '{' BodyBasic '}'
  private negation = this.RULE('negation', () => {
    this.CONSUME(Not);
    this.CONSUME(LBrace);
    this.SUBRULE(this.bodyPattern1);
    this.CONSUME(RBrace);
  });

  // Assignment = 'BIND' '(' Expression 'AS' Var ')'
  private assignment = this.RULE('assignment', () => {
    this.CONSUME(Bind);
    this.CONSUME(LParen);
    this.SUBRULE(this.expression);
    this.CONSUME(As);
    this.SUBRULE(this.variable);
    this.CONSUME(RParen);
  });

  // Constraint = BrackettedExpression | BuiltInCall
  private constraint = this.RULE('constraint', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.brackettedExpression) },
      { ALT: () => this.SUBRULE(this.builtInCall) },
    ]);
  });

  // TriplesTemplateBlock = '{' TriplesTemplate? '}'
  private triplesTemplateBlock = this.RULE('triplesTemplateBlock', () => {
    this.CONSUME(LBrace);
    this.OPTION(() => {
      this.SUBRULE(this.triplesTemplate);
    });
    this.CONSUME(RBrace);
  });

  // TriplesTemplate = TriplesSameSubject ( '.' TriplesTemplate? )?
  private triplesTemplate = this.RULE('triplesTemplate', () => {
    this.SUBRULE(this.triplesSameSubject);
    this.MANY(() => {
      this.CONSUME(Dot);
      this.OPTION(() => {
        this.SUBRULE2(this.triplesSameSubject);
      });
    });
  });

  // TriplesSameSubject = VarOrTerm PredicateObjectList
  private triplesSameSubject = this.RULE('triplesSameSubject', () => {
    this.OR([
      {
        ALT: () => {
          this.SUBRULE(this.varOrTerm);
          this.SUBRULE(this.predicateObjectList);
        },
      },
      {
        ALT: () => {
          this.SUBRULE(this.reifiedTriple);
          this.OPTION(() => {
            this.SUBRULE2(this.predicateObjectList);
          });
        },
      },
    ]);
  });

  // PredicateObjectList = Verb ObjectList ( ';' ( Verb ObjectList )? )*
  private predicateObjectList = this.RULE('predicateObjectList', () => {
    this.SUBRULE(this.verb);
    this.SUBRULE(this.objectList);
    this.MANY(() => {
      this.CONSUME(Semicolon);
      this.OPTION(() => {
        this.SUBRULE2(this.verb);
        this.SUBRULE2(this.objectList);
      });
    });
  });

  // Verb = VarOrIRI | 'a'
  private verb = this.RULE('verb', () => {
    this.OR([
      { ALT: () => this.CONSUME(RdfType) },
      { ALT: () => this.SUBRULE(this.varOrIri) },
    ]);
  });

  // ObjectList = Object ( ',' Object )*
  private objectList = this.RULE('objectList', () => {
    this.SUBRULE(this.objectTerm);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.objectTerm);
    });
  });

  // Object = VarOrTerm | ReifiedTriple
  private objectTerm = this.RULE('objectTerm', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.reifiedTriple) },
      { ALT: () => this.SUBRULE(this.varOrTerm) },
    ]);
  });

  // ReifiedTriple = '<<' Subject Verb Object '>>'
  private reifiedTriple = this.RULE('reifiedTriple', () => {
    this.CONSUME(DoubleLeftAngle);
    this.SUBRULE(this.varOrTerm);
    this.SUBRULE(this.verb);
    this.SUBRULE(this.objectTerm);
    this.CONSUME(DoubleRightAngle);
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

  // GraphTerm = IRI | RDFLiteral | NumericLiteral | BooleanLiteral | BlankNode | Collection
  private graphTerm = this.RULE('graphTerm', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.iriRef) },
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.CONSUME(BlankNode) },
      { ALT: () => this.SUBRULE(this.collection) },
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

  // Collection = '(' GraphTerm* ')'
  private collection = this.RULE('collection', () => {
    this.CONSUME(LParen);
    this.MANY(() => {
      this.SUBRULE(this.graphTerm);
    });
    this.CONSUME(RParen);
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

  // RelationalExpression = NumericExpression ( '=' | '!=' | '<' | '>' | '<=' | '>=' ) NumericExpression )?
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
  const { SRLLexer } = require('./tokens');
  const lexResult = SRLLexer.tokenize(text);
  
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.ruleSet();
  
  return {
    cst,
    errors: [...lexResult.errors.map((e: { message: string; offset: number; line: number; column: number }) => ({
      message: e.message,
      token: {
        image: '',
        startOffset: e.offset,
        startLine: e.line,
        startColumn: e.column,
        endOffset: e.offset,
        endLine: e.line,
        endColumn: e.column,
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
  rule3: 'rules',
  declaration: 'rules',
  dataBlock: 'rules',
  headTemplate: 'patterns',
  bodyPattern: 'patterns',
  bodyPattern1: 'patterns',
  bodyBasic: 'patterns',
  bodyNotTriples: 'patterns',
  filterClause: 'patterns',
  negation: 'patterns',
  assignment: 'patterns',
  constraint: 'patterns',
  triplesTemplateBlock: 'terms',
  triplesTemplate: 'terms',
  triplesSameSubject: 'terms',
  predicateObjectList: 'terms',
  verb: 'terms',
  objectList: 'terms',
  objectTerm: 'terms',
  reifiedTriple: 'terms',
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
  collection: 'terms',
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
