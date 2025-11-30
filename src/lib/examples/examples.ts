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
  | 'validation';

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
