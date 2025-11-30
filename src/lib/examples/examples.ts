export interface Example {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  srlCode: string;
  rdfData?: string;
}

export type ExampleCategory =
  | 'basic-inference'
  | 'transitive'
  | 'symmetric'
  | 'negation'
  | 'aggregation'
  | 'validation'
  | 'path-expressions'
  | 'exists-patterns'
  | 'string-functions'
  | 'hash-functions';

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
    name: 'Symmetric Properties',
    description: 'Rules for symmetric relationships like siblings',
  },
  negation: {
    name: 'Negation Patterns',
    description: 'Rules using negation for default values and closed-world assumptions',
  },
  aggregation: {
    name: 'Aggregation',
    description: 'Rules with aggregate functions and computations',
  },
  validation: {
    name: 'Data Validation',
    description: 'SHACL shapes for validating RDF data',
  },
  'path-expressions': {
    name: 'Path Expressions',
    description: 'SPARQL-style property paths for traversing RDF graphs',
  },
  'exists-patterns': {
    name: 'EXISTS Patterns',
    description: 'Using EXISTS and NOT EXISTS for pattern matching',
  },
  'string-functions': {
    name: 'String Functions',
    description: 'Advanced string manipulation functions',
  },
  'hash-functions': {
    name: 'Hash Functions',
    description: 'Cryptographic hash and UUID generation functions',
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
    description: 'Infer types based on property usage',
    category: 'basic-inference',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# If something has a name, it's a Person
RULE { ?x rdf:type :Person } WHERE { ?x :name ?n }

# If something teaches, it's a Teacher
RULE { ?x rdf:type :Teacher } WHERE { ?x :teaches ?course }`,
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

  // Symmetric Examples
  {
    id: 'friend-of',
    title: 'Friendship (Symmetric)',
    description: 'Symmetric friendship relationship',
    category: 'symmetric',
    srlCode: `PREFIX : <http://example.org/>

SYMMETRIC(:friendOf)

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

SYMMETRIC(:marriedTo)

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
    description: 'Assign default full name when not specified',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Default name from given name + family name
RULE { ?x :fullName ?FN } WHERE {
    ?x rdf:type :Person .
    NOT { ?x :fullName ?existingName } .
    ?x :givenName ?gn ;
       :familyName ?fn .
    BIND(CONCAT(?gn, " ", ?fn) AS ?FN)
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
    description: 'Detect when a person has exactly one email',
    category: 'negation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Mark as having unique email if no second email exists
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

  // Aggregation Examples
  {
    id: 'concat-names',
    title: 'String Concatenation',
    description: 'Combine first and last names',
    category: 'aggregation',
    srlCode: `PREFIX : <http://example.org/>

RULE { ?x :displayName ?name } WHERE {
    ?x :firstName ?first ;
       :lastName ?last .
    BIND(CONCAT(?first, " ", ?last) AS ?name)
}`,
    rdfData: `@prefix : <http://example.org/> .

:p1 :firstName "John" ; :lastName "Doe" .
:p2 :firstName "Jane" ; :lastName "Smith" .`,
  },
  {
    id: 'age-calculation',
    title: 'Age Calculation',
    description: 'Calculate age from birth year',
    category: 'aggregation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

RULE { ?x :age ?age } WHERE {
    ?x :birthYear ?year .
    BIND((2024 - ?year) AS ?age)
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:john :birthYear 1990 .
:jane :birthYear 1985 .`,
  },

  // Validation Examples
  {
    id: 'required-properties',
    title: 'Required Properties',
    description: 'Check that Persons have required name and email',
    category: 'validation',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX sh: <http://www.w3.org/ns/shacl#>

# This is a conceptual example - actual SHACL would be in Turtle
# Validation rules can mark invalid entities

RULE { ?x :isValid false } WHERE {
    ?x rdf:type :Person .
    NOT { ?x :name ?n }
}

RULE { ?x :missingProperty :email } WHERE {
    ?x rdf:type :Person .
    NOT { ?x :email ?e }
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:john rdf:type :Person ;
    :name "John Doe" ;
    :email "john@example.org" .
    
:jane rdf:type :Person ;
    :name "Jane Smith" .
    
    :bob rdf:type :Person .`,
  },

  // Path Expression Examples
  {
    id: 'path-sequence',
    title: 'Path Sequence',
    description: 'Navigate through multiple properties with path sequences',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find grandchildren using path sequence (parent/parent)
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
    id: 'path-alternative',
    title: 'Path Alternatives',
    description: 'Match any of several properties using path alternatives',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find any contact info (email OR phone OR address)
RULE { ?person :hasContact ?contact } WHERE {
    ?person (:email|:phone|:address) ?contact
}

# Find any parent (mother OR father)
RULE { ?child :parent ?p } WHERE {
    ?child (:motherOf|:fatherOf) ?p
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :email "john@example.org" .
:jane :phone "+1-555-1234" .
:bob :address "123 Main St" .
:alice :motherOf :carol .
:dave :fatherOf :carol .`,
  },
  {
    id: 'path-inverse',
    title: 'Inverse Paths',
    description: 'Traverse properties in reverse direction',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find children using inverse of parentOf
RULE { ?parent :child ?child } WHERE {
    ?parent ^:parentOf ?child
}

# Find employees using inverse of worksFor
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
    id: 'path-transitive',
    title: 'Transitive Path Closure',
    description: 'Use + and * for transitive property traversal',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Find all ancestors (one or more steps with +)
RULE { ?person :ancestor ?anc } WHERE {
    ?person :parentOf+ ?anc
}

# Find all reachable nodes (zero or more steps with *)
RULE { ?start :reachable ?end } WHERE {
    ?start :connectedTo* ?end
}`,
    rdfData: `@prefix : <http://example.org/> .

:alice :parentOf :bob .
:bob :parentOf :carol .
:carol :parentOf :dave .

:node1 :connectedTo :node2 .
:node2 :connectedTo :node3 .`,
  },
  {
    id: 'path-optional',
    title: 'Optional Path Step',
    description: 'Use ? for zero or one step traversal',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>

# Match self or direct manager
RULE { ?emp :selfOrManager ?target } WHERE {
    ?emp :reportsTo? ?target
}

# Find item or its immediate container
RULE { ?item :locationOrContainer ?loc } WHERE {
    ?item :containedIn? ?loc
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :reportsTo :jane .
:jane :reportsTo :ceo .
:book :containedIn :shelf .
:shelf :containedIn :room .`,
  },
  {
    id: 'path-negated',
    title: 'Negated Property Set',
    description: 'Match any property except specified ones',
    category: 'path-expressions',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Find all non-type relationships
RULE { ?s :hasRelation ?o } WHERE {
    ?s !rdf:type ?o
}

# Find connections that are not parent or child
RULE { ?a :otherConnection ?b } WHERE {
    ?a !(:parentOf|:childOf) ?b
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:john rdf:type :Person .
:john :knows :jane .
:john :friendOf :bob .
:alice :parentOf :carol .
:alice :worksAt :company .`,
  },

  // EXISTS Pattern Examples
  {
    id: 'exists-filter',
    title: 'EXISTS in Filter',
    description: 'Use EXISTS to check for pattern existence',
    category: 'exists-patterns',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Find people who have at least one child
RULE { ?person :isParent true } WHERE {
    ?person rdf:type :Person .
    FILTER(EXISTS { ?person :parentOf ?child })
}

# Find companies with employees
RULE { ?company :hasEmployees true } WHERE {
    ?company rdf:type :Company .
    FILTER(EXISTS { ?emp :worksFor ?company })
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:alice rdf:type :Person ; :parentOf :bob .
:carol rdf:type :Person .
:acme rdf:type :Company .
:john :worksFor :acme .
:widgets rdf:type :Company .`,
  },
  {
    id: 'not-exists-filter',
    title: 'NOT EXISTS Filter',
    description: 'Use NOT EXISTS for absence checks',
    category: 'exists-patterns',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Find people without children (childless)
RULE { ?person :isChildless true } WHERE {
    ?person rdf:type :Person .
    FILTER(NOT EXISTS { ?person :parentOf ?child })
}

# Find products not in any order
RULE { ?product :neverOrdered true } WHERE {
    ?product rdf:type :Product .
    FILTER(NOT EXISTS { ?order :contains ?product })
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:alice rdf:type :Person ; :parentOf :bob .
:carol rdf:type :Person .
:dave rdf:type :Person .

:laptop rdf:type :Product .
:phone rdf:type :Product .
:order1 :contains :laptop .`,
  },
  {
    id: 'exists-complex',
    title: 'Complex EXISTS Patterns',
    description: 'EXISTS with multiple conditions',
    category: 'exists-patterns',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Find managers who have highly-rated employees
RULE { ?manager :hasStarEmployee true } WHERE {
    ?manager rdf:type :Manager .
    FILTER(EXISTS {
        ?emp :reportsTo ?manager .
        ?emp :rating ?r .
        FILTER(?r > 4)
    })
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:alice rdf:type :Manager .
:bob rdf:type :Manager .

:john :reportsTo :alice ; :rating 5 .
:jane :reportsTo :alice ; :rating 3 .
:dave :reportsTo :bob ; :rating 2 .`,
  },

  // IN Expression Examples
  {
    id: 'in-expression',
    title: 'IN Expression',
    description: 'Check if value is in a list of options',
    category: 'exists-patterns',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Find people in specific departments
RULE { ?person :inCoreDept true } WHERE {
    ?person :department ?dept .
    FILTER(?dept IN ("Engineering", "Product", "Design"))
}

# Find priority orders
RULE { ?order :isPriority true } WHERE {
    ?order :status ?s .
    FILTER(?s IN ("urgent", "critical", "expedited"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :department "Engineering" .
:jane :department "Marketing" .
:bob :department "Product" .

:order1 :status "urgent" .
:order2 :status "normal" .
:order3 :status "critical" .`,
  },
  {
    id: 'not-in-expression',
    title: 'NOT IN Expression',
    description: 'Exclude values from a list',
    category: 'exists-patterns',
    srlCode: `PREFIX : <http://example.org/>

# Find active statuses (not terminated or suspended)
RULE { ?account :isActive true } WHERE {
    ?account :status ?s .
    FILTER(?s NOT IN ("terminated", "suspended", "closed"))
}

# Find non-weekend days
RULE { ?event :isWeekday true } WHERE {
    ?event :dayOfWeek ?day .
    FILTER(?day NOT IN ("Saturday", "Sunday"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:acc1 :status "active" .
:acc2 :status "terminated" .
:acc3 :status "pending" .

:event1 :dayOfWeek "Monday" .
:event2 :dayOfWeek "Saturday" .
:event3 :dayOfWeek "Wednesday" .`,
  },

  // REFLEXIVE Example
  {
    id: 'reflexive-property',
    title: 'Reflexive Property',
    description: 'Declare a property as reflexive (everything relates to itself)',
    category: 'symmetric',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# sameRegion is reflexive - every place is in the same region as itself
REFLEXIVE(:sameRegion)

# equivalentTo is reflexive
REFLEXIVE(:equivalentTo)

# Combine with rules
RULE { ?x :compatible ?y } WHERE {
    ?x :sameRegion ?y .
    ?x :sameCategory ?y
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:item1 rdf:type :Product ; :sameCategory :item2 .
:item2 rdf:type :Product .
:item1 :sameRegion :item2 .`,
  },

  // String Function Examples
  {
    id: 'string-before-after',
    title: 'STRBEFORE / STRAFTER',
    description: 'Extract substrings before or after a separator',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Extract username from email
RULE { ?person :username ?user } WHERE {
    ?person :email ?email .
    BIND(STRBEFORE(?email, "@") AS ?user)
}

# Extract domain from email
RULE { ?person :emailDomain ?domain } WHERE {
    ?person :email ?email .
    BIND(STRAFTER(?email, "@") AS ?domain)
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :email "john.doe@example.org" .
:jane :email "jane@company.com" .
:bob :email "bob123@mail.net" .`,
  },
  {
    id: 'regex-matching',
    title: 'REGEX Pattern Matching',
    description: 'Use regular expressions for pattern matching',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find valid email addresses
RULE { ?person :hasValidEmail true } WHERE {
    ?person :email ?email .
    FILTER(REGEX(?email, "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"))
}

# Find US phone numbers
RULE { ?person :hasUSPhone true } WHERE {
    ?person :phone ?phone .
    FILTER(REGEX(?phone, "^\\\\+1-[0-9]{3}-[0-9]{4}$"))
}

# Case-insensitive search
RULE { ?doc :mentionsJava true } WHERE {
    ?doc :content ?text .
    FILTER(REGEX(?text, "java", "i"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:john :email "john@example.org" ; :phone "+1-555-1234" .
:jane :email "invalid-email" ; :phone "555-1234" .
:doc1 :content "Learning Java programming" .
:doc2 :content "Python is great" .`,
  },
  {
    id: 'encode-uri',
    title: 'URI Encoding',
    description: 'Encode strings for use in URIs',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Create URL-safe identifiers
RULE { ?item :urlSlug ?slug } WHERE {
    ?item :name ?name .
    BIND(ENCODE_FOR_URI(?name) AS ?slug)
}

# Build search URLs
RULE { ?query :searchUrl ?url } WHERE {
    ?query :searchTerm ?term .
    BIND(CONCAT("https://search.example.org?q=", ENCODE_FOR_URI(?term)) AS ?url)
}`,
    rdfData: `@prefix : <http://example.org/> .

:product1 :name "Coffee & Tea" .
:product2 :name "Books/Magazines" .
:query1 :searchTerm "hello world" .`,
  },
  {
    id: 'lang-matching',
    title: 'Language Tag Matching',
    description: 'Match language tags with LANGMATCHES',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find English labels
RULE { ?item :englishLabel ?label } WHERE {
    ?item :label ?label .
    FILTER(LANGMATCHES(LANG(?label), "en"))
}

# Find any German content
RULE { ?doc :hasGermanContent true } WHERE {
    ?doc :description ?desc .
    FILTER(LANGMATCHES(LANG(?desc), "de"))
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :label "Hello"@en ; :label "Hallo"@de .
:item2 :label "Bonjour"@fr .
:doc1 :description "Ein Dokument"@de .
:doc2 :description "A document"@en .`,
  },
  {
    id: 'typed-literals',
    title: 'Typed Literals (STRDT/STRLANG)',
    description: 'Create typed literals and language-tagged strings',
    category: 'string-functions',
    srlCode: `PREFIX : <http://example.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

# Create typed integer from string
RULE { ?item :quantityInt ?qty } WHERE {
    ?item :quantityStr ?qStr .
    BIND(STRDT(?qStr, xsd:integer) AS ?qty)
}

# Add language tag to label
RULE { ?item :labelEn ?label } WHERE {
    ?item :rawLabel ?raw .
    BIND(STRLANG(?raw, "en") AS ?label)
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :quantityStr "42" .
:item2 :quantityStr "100" .
:product1 :rawLabel "Widget" .
:product2 :rawLabel "Gadget" .`,
  },

  // Hash Function Examples
  {
    id: 'hash-functions',
    title: 'Cryptographic Hashes',
    description: 'Generate MD5 and SHA hashes',
    category: 'hash-functions',
    srlCode: `PREFIX : <http://example.org/>

# Generate various hashes of a value
RULE { ?item :md5Hash ?hash } WHERE {
    ?item :identifier ?id .
    BIND(MD5(?id) AS ?hash)
}

RULE { ?item :sha256Hash ?hash } WHERE {
    ?item :identifier ?id .
    BIND(SHA256(?id) AS ?hash)
}

# Create content fingerprint
RULE { ?doc :fingerprint ?fp } WHERE {
    ?doc :content ?content .
    BIND(SHA1(?content) AS ?fp)
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :identifier "product-001" .
:item2 :identifier "product-002" .
:doc1 :content "Hello, World!" .`,
  },
  {
    id: 'uuid-generation',
    title: 'UUID Generation',
    description: 'Generate unique identifiers with UUID and STRUUID',
    category: 'hash-functions',
    srlCode: `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

# Generate UUID as IRI for new resources
RULE { ?order :transactionId ?txId } WHERE {
    ?order rdf:type :Order .
    BIND(UUID() AS ?txId)
}

# Generate UUID as string for identifiers
RULE { ?user :sessionToken ?token } WHERE {
    ?user rdf:type :User .
    BIND(STRUUID() AS ?token)
}`,
    rdfData: `@prefix : <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

:order1 rdf:type :Order .
:order2 rdf:type :Order .
:user1 rdf:type :User .`,
  },
  {
    id: 'same-term',
    title: 'SAMETERM Comparison',
    description: 'Check exact term equality (not just value equality)',
    category: 'hash-functions',
    srlCode: `PREFIX : <http://example.org/>

# Find exact matches (same term, not just same value)
RULE { ?a :exactMatch ?b } WHERE {
    ?a :code ?codeA .
    ?b :code ?codeB .
    FILTER(SAMETERM(?codeA, ?codeB))
    FILTER(?a != ?b)
}

# Detect duplicate references
RULE { ?x :duplicateRef ?y } WHERE {
    ?x :references ?ref1 .
    ?y :references ?ref2 .
    FILTER(SAMETERM(?ref1, ?ref2))
    FILTER(?x != ?y)
}`,
    rdfData: `@prefix : <http://example.org/> .

:item1 :code "ABC123" .
:item2 :code "ABC123" .
:item3 :code "XYZ789" .

:doc1 :references :refA .
:doc2 :references :refA .
:doc3 :references :refB .`,
  },
];export function getExamplesByCategory(category: ExampleCategory): Example[] {
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
