export interface Example {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  srlCode: string;
  rdfData?: string;
  /** SHACL shapes graph (Turtle) for FOR ?v IN <shape> examples (opt-in extension). */
  shapesGraph?: string;
}

export type ExampleCategory =
  | 'basic-inference'
  | 'transitive'
  | 'symmetric'
  | 'negation'
  | 'assignment'
  | 'path-expressions'
  | 'string-functions'
  | 'shape-targeting';

export const exampleCategories: Record<ExampleCategory, { name: string; description: string }> = {
  'basic-inference': {
    name: 'Basic Inference',
    description: 'Simple inference rules for deriving new facts',
  },
  transitive: {
    name: 'Transitive Properties',
    description: 'Rules for transitive relationships like ancestors',
  },
  symmetric: {
    name: 'Symmetric & Inverse Properties',
    description: 'Rules for symmetric and inverse relationships',
  },
  negation: {
    name: 'Negation Patterns',
    description: 'Rules using NOT for default values and closed-world assumptions',
  },
  assignment: {
    name: 'SET Assignment',
    description: 'Rules that compute new values with SET(?var := expr)',
  },
  'path-expressions': {
    name: 'Path Expressions',
    description: 'Property paths (sequence and inverse) for traversing RDF graphs',
  },
  'string-functions': {
    name: 'String & Value Functions',
    description: 'Built-in functions for string and value manipulation',
  },
  'shape-targeting': {
    name: 'Shape Targeting (FOR … IN)',
    description: "Rules tied to a SHACL shape — fire only for the shape's conforming focus nodes (opt-in extension)",
  },
};

export const examples: Example[] = [
  // Basic Inference Examples
  {
    id: 'child-of',
    title: 'Child-Of Relationship',
    description: 'Derive childOf from fatherOf and motherOf relationships',
    category: 'basic-inference',
    srlCode: `PREFIX : <http://example.org/>

# A person is a child of their father
RULE { ?x :childOf ?y } WHERE { ?y :fatherOf ?x }

# A person is a child of their mother
RULE { ?x :childOf ?y } WHERE { ?y :motherOf ?x }`,
    rdfData: `@prefix : <http://example.org/> .

:john :fatherOf :mary .
:jane :motherOf :mary .
:mary :fatherOf :tom .`,
  },
  {
    id: 'named-rule',
    title: 'Named Rule',
    description: 'A rule carrying an identifying IRI (RULE iri? { … } WHERE { … })',
    category: 'basic-inference',
    srlCode: `PREFIX : <http://example.org/>

# The optional IRI right after RULE names the rule
RULE :largeTownRule { ?x :type :LargeTown } WHERE {
    ?x :population ?p .
    FILTER(?p > 1500)
}`,
    rdfData: `@prefix : <http://example.org/> .

:springfield :population 3000 .
:smallville :population 900 .`,
  },
  {
    id: 'sibling',
    title: 'Sibling Inference',
    description: 'Derive sibling relationships from shared parents',
    category: 'basic-inference',
    srlCode: `PREFIX : <http://example.org/>

# Two people are siblings if they share a parent
RULE { ?x :siblingOf ?y } WHERE {
    ?x :childOf ?parent .
    ?y :childOf ?parent .
    FILTER(?x != ?y)
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :childOf :bob .
:jane :childOf :bob .
:mike :childOf :alice .`,
  },
  {
    id: 'type-inference',
    title: 'Type Inference',
    description: 'Infer types based on property usage (IF … THEN form)',
    category: 'basic-inference',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# If something has a name, it's a Person
IF { ?x :name ?n } THEN { ?x rdf:type :Person }

# If something teaches, it's a Teacher
IF { ?x :teaches ?course } THEN { ?x rdf:type :Teacher }`,
    rdfData: `@prefix : <http://example.org/> .

:john :name "John Doe" .
:jane :teaches :Math101 .`,
  },

  // Transitive Examples
  {
    id: 'ancestor',
    title: 'Ancestor Transitive Closure',
    description: 'Compute ancestor relationships transitively',
    category: 'transitive',
    srlCode: `PREFIX : <http://example.org/>

# Direct ancestor (parent)
RULE { ?x :ancestorOf ?y } WHERE { ?x :parentOf ?y }

# Transitive ancestor
RULE { ?x :ancestorOf ?z } WHERE {
    ?x :ancestorOf ?y .
    ?y :ancestorOf ?z
}

# Shorthand declaration
TRANSITIVE(:ancestorOf)`,
    rdfData: `@prefix : <http://example.org/> .

:greatgrandpa :parentOf :grandpa .
:grandpa :parentOf :dad .
:dad :parentOf :me .`,
  },
  {
    id: 'part-of',
    title: 'Part-Of Hierarchy',
    description: 'Transitive part-whole relationships',
    category: 'transitive',
    srlCode: `PREFIX : <http://example.org/>

TRANSITIVE(:partOf)

RULE { ?x :containedIn ?y } WHERE { ?x :partOf ?y }`,
    rdfData: `@prefix : <http://example.org/> .

:engine :partOf :car .
:piston :partOf :engine .
:car :partOf :garage .`,
  },

  // Symmetric & Inverse Examples
  {
    id: 'friend-of',
    title: 'Friendship (Symmetric)',
    description: 'Symmetric friendship relationship — note the postfix (:p) SYMMETRIC syntax',
    category: 'symmetric',
    srlCode: `PREFIX : <http://example.org/>

# The IRI precedes the SYMMETRIC keyword
(:friendOf) SYMMETRIC

# If someone is your friend, you are their friend
RULE { ?y :friendOf ?x } WHERE { ?x :friendOf ?y }`,
    rdfData: `@prefix : <http://example.org/> .

:alice :friendOf :bob .
:carol :friendOf :dave .`,
  },
  {
    id: 'married-to',
    title: 'Marriage (Symmetric)',
    description: 'Symmetric marriage relationship',
    category: 'symmetric',
    srlCode: `PREFIX : <http://example.org/>

(:marriedTo) SYMMETRIC

# Also derive spouse relationship
RULE { ?x :spouseOf ?y } WHERE { ?x :marriedTo ?y }`,
    rdfData: `@prefix : <http://example.org/> .

:john :marriedTo :jane .`,
  },
  {
    id: 'inverse-properties',
    title: 'Inverse Properties',
    description: 'Declare inverse property relationships',
    category: 'symmetric',
    srlCode: `PREFIX : <http://example.org/>

INVERSE(:parentOf, :childOf)
INVERSE(:employs, :worksFor)
INVERSE(:contains, :containedIn)

# Derive childOf from parentOf
RULE { ?y :childOf ?x } WHERE { ?x :parentOf ?y }`,
    rdfData: `@prefix : <http://example.org/> .

:company :employs :john .
:john :parentOf :mary .`,
  },

  // Negation Examples
  {
    id: 'default-value',
    title: 'Default Value with Negation',
    description: 'Assign a default full name only when none is specified',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Default name from given name + family name when no fullName exists
RULE { ?x :fullName ?FN } WHERE {
    ?x rdf:type :Person .
    NOT { ?x :fullName ?existingName } .
    ?x :givenName ?gn ;
       :familyName ?fn .
    SET(?FN := CONCAT(?gn, " ", ?fn))
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:john rdf:type :Person ;
    :givenName "John" ;
    :familyName "Doe" .

:jane rdf:type :Person ;
    :givenName "Jane" ;
    :familyName "Smith" ;
    :fullName "Dr. Jane Smith" .`,
  },
  {
    id: 'closed-world',
    title: 'Closed World Assumption',
    description: 'Mark entities as inactive if not explicitly active',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# If an account doesn't have an active status, mark as inactive
RULE { ?account :status "inactive" } WHERE {
    ?account rdf:type :Account .
    NOT { ?account :status "active" }
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:acc1 rdf:type :Account ;
    :status "active" .

:acc2 rdf:type :Account .
:acc3 rdf:type :Account .`,
  },
  {
    id: 'unique-constraint',
    title: 'Unique Value Detection',
    description: 'Detect when a person has exactly one email (NOT with an inner FILTER)',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Mark as having a unique email if no second email exists
RULE { ?x :hasUniqueEmail true } WHERE {
    ?x rdf:type :Person ;
       :email ?e .
    NOT {
        ?x :email ?e2 .
        FILTER(?e != ?e2)
    }
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:john rdf:type :Person ;
    :email "john@example.org" .

:jane rdf:type :Person ;
    :email "jane@work.com" ;
    :email "jane@home.com" .`,
  },
  {
    id: 'childless',
    title: 'People Without Children',
    description: 'Use NOT to find people who have no children',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

RULE { ?person :isChildless true } WHERE {
    ?person rdf:type :Person .
    NOT { ?person :parentOf ?child }
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:alice rdf:type :Person ; :parentOf :bob .
:carol rdf:type :Person .
:dave rdf:type :Person .`,
  },

  // SET Assignment Examples
  {
    id: 'concat-names',
    title: 'String Concatenation',
    description: 'Combine first and last names with SET',
    category: 'assignment',
    srlCode: `PREFIX : <http://example.org/>

RULE { ?x :displayName ?name } WHERE {
    ?x :firstName ?first ;
       :lastName ?last .
    SET(?name := CONCAT(?first, " ", ?last))
}`,
    rdfData: `@prefix : <http://example.org/> .

:p1 :firstName "John" ; :lastName "Doe" .
:p2 :firstName "Jane" ; :lastName "Smith" .`,
  },
  {
    id: 'age-calculation',
    title: 'Age Calculation',
    description: 'Calculate age from birth year with SET',
    category: 'assignment',
    srlCode: `PREFIX : <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

RULE { ?x :age ?age } WHERE {
    ?x :birthYear ?year .
    SET(?age := (2024 - ?year))
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:john :birthYear 1990 .
:jane :birthYear 1985 .`,
  },
  {
    id: 'unit-conversion',
    title: 'Unit Conversion',
    description: 'Convert miles to kilometres',
    category: 'assignment',
    srlCode: `PREFIX : <http://example.org/>

RULE { ?x :calculatedDistanceKm ?kilometers } WHERE {
    ?x :distanceMiles ?miles .
    SET(?kilometers := ?miles * 1.60934)
}`,
    rdfData: `@prefix : <http://example.org/> .

:route1 :distanceMiles 10 .
:route2 :distanceMiles 26 .`,
  },

  // Path Expression Examples
  {
    id: 'path-sequence',
    title: 'Path Sequence',
    description: 'Navigate through multiple properties with a path sequence (/)',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find grandparents using path sequence (parentOf/parentOf)
RULE { ?grandparent :grandchildOf ?grandchild } WHERE {
    ?grandchild :parentOf/:parentOf ?grandparent
}

# Find great-grandparents
RULE { ?person :greatGrandparent ?ggp } WHERE {
    ?person :parentOf/:parentOf/:parentOf ?ggp
}`,
    rdfData: `@prefix : <http://example.org/> .

:alice :parentOf :bob .
:bob :parentOf :carol .
:carol :parentOf :dave .`,
  },
  {
    id: 'path-inverse',
    title: 'Inverse Paths',
    description: 'Traverse properties in reverse direction with ^',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find children using the inverse of parentOf
RULE { ?parent :child ?child } WHERE {
    ?parent ^:parentOf ?child
}

# Find employees using the inverse of worksFor
RULE { ?company :employee ?person } WHERE {
    ?company ^:worksFor ?person
}`,
    rdfData: `@prefix : <http://example.org/> .

:alice :parentOf :bob .
:alice :parentOf :carol .
:john :worksFor :acme .
:jane :worksFor :acme .`,
  },
  {
    id: 'path-inverse-sequence',
    title: 'Inverse + Sequence',
    description: 'Combine inverse and sequence to find co-workers',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Two people are colleagues if they work for the same company:
# ?a worksFor ?company, then inverse worksFor back to ?b
RULE { ?a :colleagueOf ?b } WHERE {
    ?a :worksFor/^:worksFor ?b .
    FILTER(?a != ?b)
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :worksFor :acme .
:jane :worksFor :acme .
:bob :worksFor :globex .`,
  },

  // String & Value Function Examples
  {
    id: 'string-before-after',
    title: 'STRBEFORE / STRAFTER',
    description: 'Extract substrings before or after a separator',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Extract username from email
RULE { ?person :username ?user } WHERE {
    ?person :email ?email .
    SET(?user := STRBEFORE(?email, "@"))
}

# Extract domain from email
RULE { ?person :emailDomain ?domain } WHERE {
    ?person :email ?email .
    SET(?domain := STRAFTER(?email, "@"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :email "john.doe@example.org" .
:jane :email "jane@company.com" .
:bob :email "bob123@mail.net" .`,
  },
  {
    id: 'regex-matching',
    title: 'REGEX Pattern Matching',
    description: 'Use regular expressions in FILTER',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find valid email addresses
RULE { ?person :hasValidEmail true } WHERE {
    ?person :email ?email .
    FILTER(REGEX(?email, "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"))
}

# Case-insensitive search
RULE { ?doc :mentionsJava true } WHERE {
    ?doc :content ?text .
    FILTER(REGEX(?text, "java", "i"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :email "john@example.org" .
:jane :email "invalid-email" .
:doc1 :content "Learning Java programming" .
:doc2 :content "Python is great" .`,
  },
  {
    id: 'in-expression',
    title: 'IN / NOT IN',
    description: 'Test membership of a value in a list',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find people in specific departments
RULE { ?person :inCoreDept true } WHERE {
    ?person :department ?dept .
    FILTER(?dept IN ("Engineering", "Product", "Design"))
}

# Find active accounts (status not in a blocked set)
RULE { ?account :isActive true } WHERE {
    ?account :status ?s .
    FILTER(?s NOT IN ("terminated", "suspended", "closed"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :department "Engineering" .
:jane :department "Marketing" .
:acc1 :status "active" .
:acc2 :status "terminated" .`,
  },
  {
    id: 'lang-matching',
    title: 'Language Tag Matching',
    description: 'Match language tags with LANGMATCHES and LANG',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find English labels
RULE { ?item :englishLabel ?label } WHERE {
    ?item :label ?label .
    FILTER(LANGMATCHES(LANG(?label), "en"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :label "Hello"@en ; :label "Hallo"@de .
:item2 :label "Bonjour"@fr .`,
  },
  {
    id: 'typed-literals',
    title: 'Typed Literals (STRDT / STRLANG)',
    description: 'Create typed literals and language-tagged strings',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# Create a typed integer from a string
RULE { ?item :quantityInt ?qty } WHERE {
    ?item :quantityStr ?qStr .
    SET(?qty := STRDT(?qStr, xsd:integer))
}

# Add a language tag to a label
RULE { ?item :labelEn ?label } WHERE {
    ?item :rawLabel ?raw .
    SET(?label := STRLANG(?raw, "en"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :quantityStr "42" .
:product1 :rawLabel "Widget" .`,
  },

  // Shape Targeting Examples (opt-in FOR ?v IN <shape> extension)
  {
    id: 'adult-gate',
    title: 'Adult Status Gate',
    description: 'Fire only for ex:Person nodes conforming to AdultShape (age ≥ 18)',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires once per conforming focus node, with ?this pre-bound.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Alice rdf:type ex:Person ; ex:age 30 .
ex:Bob   rdf:type ex:Person ; ex:age 10 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Alice (30) conforms; Bob (10) fails sh:minInclusive.
ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
  {
    id: 'target-kinds',
    title: 'Target: SubjectsOf',
    description: 'sh:targetSubjectsOf selects the subjects of a given predicate',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# ex:AuthorShape targets subjects of ex:wrote — everyone who wrote something.
RULE ex:markAuthor FOR ?p IN ex:AuthorShape
  { ?p ex:role ex:author }
WHERE
  { ?p ex:wrote ?work }`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:Ada ex:wrote ex:Notes .
ex:Grace ex:wrote ex:Compiler .
ex:Reader ex:read ex:Notes .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Focus nodes = subjects of any ex:wrote triple.
ex:AuthorShape a sh:NodeShape ;
  sh:targetSubjectsOf ex:wrote .`,
  },
  {
    id: 'datatype-nodekind-gate',
    title: 'Datatype & NodeKind Gate',
    description: 'Conform only when a property has the required datatype / node kind',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires only for products whose ex:sku is an IRI and ex:name is a string.
RULE ex:validProduct FOR ?p IN ex:ProductShape
  { ?p ex:status ex:valid }
WHERE
  { ?p ex:name ?n }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Widget rdf:type ex:Product ; ex:name "Widget" ; ex:sku ex:SKU-1 .
ex:Gadget rdf:type ex:Product ; ex:name 42 ; ex:sku ex:SKU-2 .`,
    shapesGraph: `@prefix sh:  <http://www.w3.org/ns/shacl#> .
@prefix ex:  <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Widget conforms; Gadget fails (ex:name 42 is not a string).
ex:ProductShape a sh:NodeShape ;
  sh:targetClass ex:Product ;
  sh:property [ sh:path ex:name ; sh:datatype xsd:string ] ;
  sh:property [ sh:path ex:sku ; sh:nodeKind sh:IRI ] .`,
  },
  {
    id: 'pattern-in-hasvalue',
    title: 'Pattern / IN Gate',
    description: 'Conform via sh:pattern (regex) and sh:in (enumerated values)',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

RULE ex:approve FOR ?o IN ex:OrderShape
  { ?o ex:approved true }
WHERE
  { ?o ex:code ?c }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:o1 rdf:type ex:Order ; ex:code "AB-123" ; ex:region ex:EU .
ex:o2 rdf:type ex:Order ; ex:code "bad" ; ex:region ex:EU .
ex:o3 rdf:type ex:Order ; ex:code "CD-456" ; ex:region ex:XX .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# o1 conforms; o2 fails the pattern; o3 fails the region set.
ex:OrderShape a sh:NodeShape ;
  sh:targetClass ex:Order ;
  sh:property [ sh:path ex:code ; sh:pattern "^[A-Z]{2}-[0-9]+$" ] ;
  sh:property [ sh:path ex:region ; sh:in ( ex:EU ex:US ) ] .`,
  },
  {
    id: 'cardinality-gate',
    title: 'Cardinality Gate',
    description: 'Conform only when a property occurs the required number of times',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Fires only for teams with 2–3 members.
RULE ex:validTeam FOR ?t IN ex:TeamShape
  { ?t ex:status ex:staffed }
WHERE
  { ?t ex:member ?m }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:t1 rdf:type ex:Team ; ex:member ex:a , ex:b .
ex:t2 rdf:type ex:Team ; ex:member ex:c .
ex:t3 rdf:type ex:Team ; ex:member ex:d , ex:e , ex:f , ex:g .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# t1 (2 members) conforms; t2 (1) and t3 (4) fail.
ex:TeamShape a sh:NodeShape ;
  sh:targetClass ex:Team ;
  sh:property [ sh:path ex:member ; sh:minCount 2 ; sh:maxCount 3 ] .`,
  },
  {
    id: 'logical-shapes',
    title: 'Logical Shapes (or / not)',
    description: 'Conform via sh:or branches while sh:not excludes a sub-shape',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Contactable = has an email OR a phone, and is NOT opted out.
RULE ex:contactable FOR ?p IN ex:ContactableShape
  { ?p ex:status ex:contactable }
WHERE
  { ?p ex:name ?n }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Ann rdf:type ex:Person ; ex:name "Ann" ; ex:email "ann@x.org" .
ex:Ben rdf:type ex:Person ; ex:name "Ben" ; ex:phone "555-0100" ; ex:optOut true .
ex:Cat rdf:type ex:Person ; ex:name "Cat" .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Ann conforms; Ben is opted out (sh:not); Cat has neither email nor phone.
# Logical operands are node shapes (each wraps a sh:property), since sh:or/sh:not
# evaluate their operands as node shapes against the focus node.
ex:ContactableShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:or (
    [ sh:property [ sh:path ex:email ; sh:minCount 1 ] ]
    [ sh:property [ sh:path ex:phone ; sh:minCount 1 ] ]
  ) ;
  sh:not [ sh:property [ sh:path ex:optOut ; sh:hasValue true ] ] .`,
  },
  {
    id: 'inferred-membership',
    title: 'Sees Inferred Membership',
    description: 'A plain rule infers ex:age; the FOR gate reads it in a higher stratum',
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# Plain rule: derive age from birth year.
RULE { ?x ex:age 40 } WHERE { ?x ex:bornYear ?y }

# Targeted rule: gated on AdultShape, which reads ex:age. The stratifier places
# this ABOVE the plain rule, so the gate sees the inferred age.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

# Dana has no age in the data — it is inferred by the plain rule.
ex:Dana rdf:type ex:Person ; ex:bornYear 1980 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
  {
    id: 'if-then-chained',
    title: 'IF..THEN + Chained Gates',
    description: "IF/THEN FOR form; one targeted rule feeds another shape's predicate",
    category: 'shape-targeting',
    srlCode: `PREFIX ex: <http://example.org/>

# IF..THEN surface form with a naming IRI + FOR clause.
IF { ?this ex:bornYear ?y }
THEN ex:setAge FOR ?this IN ex:PersonShape { ?this ex:age 40 }

# Gated on AdultShape (reads ex:age) — runs after setAge in a higher stratum.
RULE ex:adultStatus FOR ?this IN ex:AdultShape
  { ?this ex:status ex:adult }
WHERE
  { ?this ex:age ?a }`,
    rdfData: `@prefix ex:  <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Erin rdf:type ex:Person ; ex:bornYear 1980 .`,
    shapesGraph: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:PersonShape a sh:NodeShape ; sh:targetClass ex:Person .

ex:AdultShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [ sh:path ex:age ; sh:minCount 1 ; sh:minInclusive 18 ] .`,
  },
];

export function getExamplesByCategory(category: ExampleCategory): Example[] {
  return examples.filter((e) => e.category === category);
}

export function getExampleById(id: string): Example | undefined {
  return examples.find((e) => e.id === id);
}

export function searchExamples(query: string): Example[] {
  const lowerQuery = query.toLowerCase();
  return examples.filter(
    (e) =>
      e.title.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery) ||
      e.srlCode.toLowerCase().includes(lowerQuery)
  );
}
