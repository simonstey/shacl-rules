/**
 * Node Expression Examples for the SHACL 1.2 Node Expressions Playground
 */

export interface NodeExprExample {
  id: string;
  title: string;
  description: string;
  category: NodeExprExampleCategory;
  expressionCode: string;
  rdfData: string;
}

export type NodeExprExampleCategory =
  | 'basic'
  | 'path-expressions'
  | 'list-operators'
  | 'sequence-operators'
  | 'aggregations'
  | 'conditionals'
  | 'dynamic-shacl'
  | 'sparql-functions';

export const nodeExprExampleCategories: Record<
  NodeExprExampleCategory,
  { name: string; description: string }
> = {
  basic: {
    name: 'Basic Expressions',
    description: 'Fundamental node expression types',
  },
  'path-expressions': {
    name: 'Path Expressions',
    description: 'Property path traversal with pathValues',
  },
  'list-operators': {
    name: 'List Operators',
    description: 'Operations on node sequences',
  },
  'sequence-operators': {
    name: 'Sequence Operators',
    description: 'Advanced sequence processing (flatMap, findFirst, matchAll)',
  },
  aggregations: {
    name: 'Aggregations',
    description: 'Count, min, max, and sum expressions',
  },
  conditionals: {
    name: 'Conditionals',
    description: 'If/then/else and exists expressions',
  },
  'dynamic-shacl': {
    name: 'Dynamic SHACL',
    description: 'Node expressions in SHACL constraint parameters',
  },
  'sparql-functions': {
    name: 'SPARQL Functions',
    description: 'Using SPARQL functions in expressions',
  },
};

export const nodeExprExamples: NodeExprExample[] = [
  // Basic Expressions
  {
    id: 'basic-var',
    title: 'Variable Expression',
    description: 'Access the focus node via the var expression',
    category: 'basic',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Expression to get the focus node
ex:getFocusNode a shnex:Expression ;
    shnex:var "focusNode" .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:name "John Doe" ;
    ex:age 30 .
`,
  },
  {
    id: 'basic-empty',
    title: 'Empty Expression',
    description: 'Returns an empty sequence',
    category: 'basic',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix ex: <http://example.org/> .

# Empty expression returns []
ex:emptyExpr rdf:type shnex:empty .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:name "John Doe" .
`,
  },

  // Path Expressions
  {
    id: 'path-simple',
    title: 'Simple Path Values',
    description: 'Get values of a property from the focus node',
    category: 'path-expressions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Get all names of the focus node
ex:getNames shnex:pathValues ex:name .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:name "John Doe" ;
    ex:age 30 .

ex:jane ex:name "Jane Smith" ;
    ex:age 28 .
`,
  },
  {
    id: 'path-sequence',
    title: 'Path Sequence',
    description: 'Navigate through multiple properties',
    category: 'path-expressions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Get grandchildren: person -> child -> child
ex:getGrandchildren shnex:pathValues ( ex:child ex:child ) .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:grandpa ex:child ex:dad .
ex:dad ex:child ex:kid1 ;
    ex:child ex:kid2 .
`,
  },
  {
    id: 'path-inverse',
    title: 'Inverse Path',
    description: 'Traverse a property in reverse direction',
    category: 'path-expressions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Get parent via inverse of child
ex:getParent shnex:pathValues [ sh:inversePath ex:child ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:child ex:mary .
ex:john ex:child ex:tom .
`,
  },
  {
    id: 'path-alternative',
    title: 'Alternative Path',
    description: 'Match any of several properties',
    category: 'path-expressions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Get any contact info (email or phone)
ex:getContact shnex:pathValues [ sh:alternativePath ( ex:email ex:phone ) ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:email "john@example.org" ;
    ex:phone "+1-555-1234" .

ex:jane ex:email "jane@example.org" .
`,
  },

  // List Operators
  {
    id: 'list-distinct',
    title: 'Distinct',
    description: 'Remove duplicate nodes from a sequence',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Get distinct skills across all employees
ex:distinctSkills shnex:distinct [
    shnex:pathValues ex:skill
] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane .
ex:john ex:skill ex:java, ex:python .
ex:jane ex:skill ex:python, ex:javascript .
`,
  },
  {
    id: 'list-concat',
    title: 'Concat (Sequence)',
    description: 'Concatenate sequences preserving order (may have duplicates)',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Concat skills from both sources (preserves order, allows duplicates)
ex:allSkills shnex:concat (
    [ shnex:pathValues ex:primarySkill ]
    [ shnex:pathValues ex:secondarySkill ]
) .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:primarySkill ex:java ;
    ex:secondarySkill ex:python, ex:java .
`,
  },
  {
    id: 'list-join',
    title: 'Join (Set Union)',
    description: 'Set union - nodes in any expression (no duplicates)',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Join skills as set union (no duplicates)
ex:uniqueSkills shnex:join (
    [ shnex:pathValues ex:primarySkill ]
    [ shnex:pathValues ex:secondarySkill ]
) .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:primarySkill ex:java ;
    ex:secondarySkill ex:python, ex:java .
`,
  },
  {
    id: 'list-remove',
    title: 'Remove',
    description: 'Remove all occurrences of nodes from sequence',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Remove deprecated skills
ex:activeSkills shnex:nodes [ shnex:pathValues ex:skill ] ;
    shnex:remove [ shnex:pathValues ex:deprecatedSkill ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:skill ex:java, ex:cobol, ex:python ;
    ex:deprecatedSkill ex:cobol .
`,
  },
  {
    id: 'list-intersection',
    title: 'Intersection',
    description: 'Nodes that appear in all expressions',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Skills shared by all team members
ex:sharedSkills shnex:intersection (
    [ shnex:pathValues ( ex:employee ex:skill ) ]
) .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:team ex:employee ex:john, ex:jane .
ex:john ex:skill ex:java, ex:python .
ex:jane ex:skill ex:python, ex:javascript .
`,
  },
  {
    id: 'list-limit-offset',
    title: 'Limit and Offset',
    description: 'Pagination over node sequences',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Get 5 employees, skipping the first 2 (pagination)
ex:pagedEmployees shnex:nodes [ shnex:pathValues ex:employee ] ;
    shnex:offset 2 ;
    shnex:limit 5 .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:emp1, ex:emp2, ex:emp3, ex:emp4, ex:emp5, ex:emp6, ex:emp7 .
`,
  },
  {
    id: 'list-orderby',
    title: 'Order By',
    description: 'Sort nodes by property values',
    category: 'list-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Sort employees by name
ex:sortedEmployees shnex:nodes [ shnex:pathValues ex:employee ] ;
    shnex:orderBy ex:name .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:alice, ex:bob .
ex:john ex:name "John" .
ex:alice ex:name "Alice" .
ex:bob ex:name "Bob" .
`,
  },

  // Sequence Operators
  {
    id: 'seq-flatmap',
    title: 'FlatMap',
    description: 'Apply expression to each node with changed focus, flatten results',
    category: 'sequence-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Collect all skills from all employees
ex:allEmployeeSkills shnex:nodes [ shnex:pathValues ex:employee ] ;
    shnex:flatMap [ shnex:pathValues ex:skill ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane .
ex:john ex:skill ex:java, ex:python .
ex:jane ex:skill ex:javascript, ex:typescript .
`,
  },
  {
    id: 'seq-flatmap-nested',
    title: 'Nested FlatMap',
    description: 'FlatMap through multiple levels of structure',
    category: 'sequence-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Get all items from all orders from all customers
ex:allItems shnex:nodes [ shnex:pathValues ex:customer ] ;
    shnex:flatMap [
        shnex:nodes [ shnex:pathValues ex:order ] ;
        shnex:flatMap [ shnex:pathValues ex:item ]
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:store ex:customer ex:cust1, ex:cust2 .
ex:cust1 ex:order ex:ord1 .
ex:cust2 ex:order ex:ord2 .
ex:ord1 ex:item ex:itemA, ex:itemB .
ex:ord2 ex:item ex:itemC .
`,
  },
  {
    id: 'seq-findfirst',
    title: 'Find First',
    description: 'First node conforming to a shape',
    category: 'sequence-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Find first senior employee
ex:firstSenior shnex:nodes [ shnex:pathValues ex:employee ] ;
    shnex:findFirst ex:SeniorEmployeeShape .

ex:SeniorEmployeeShape a sh:NodeShape ;
    sh:property [
        sh:path ex:yearsOfService ;
        sh:minInclusive 10
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane, ex:bob .
ex:john ex:yearsOfService 5 .
ex:jane ex:yearsOfService 12 .
ex:bob ex:yearsOfService 15 .
`,
  },
  {
    id: 'seq-matchall',
    title: 'Match All',
    description: 'Check if all nodes conform to a shape',
    category: 'sequence-operators',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

# Check if all employees are active
ex:allActive shnex:nodes [ shnex:pathValues ex:employee ] ;
    shnex:matchAll ex:ActiveEmployeeShape .

ex:ActiveEmployeeShape a sh:NodeShape ;
    sh:property [
        sh:path ex:status ;
        sh:hasValue "active"
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane .
ex:john ex:status "active" .
ex:jane ex:status "active" .
`,
  },

  // Aggregations
  {
    id: 'agg-count',
    title: 'Count',
    description: 'Count the number of nodes',
    category: 'aggregations',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Count employees
ex:employeeCount shnex:count [ shnex:pathValues ex:employee ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane, ex:bob .
`,
  },
  {
    id: 'agg-sum',
    title: 'Sum',
    description: 'Sum of numeric values',
    category: 'aggregations',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Sum of all salaries
ex:totalSalary shnex:sum [ shnex:pathValues ex:salary ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane .
ex:john ex:salary 50000 .
ex:jane ex:salary 60000 .
`,
  },
  {
    id: 'agg-min-max',
    title: 'Min and Max',
    description: 'Minimum and maximum values',
    category: 'aggregations',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Minimum salary
ex:minSalary shnex:min [ shnex:pathValues ex:salary ] .

# Maximum salary
ex:maxSalary shnex:max [ shnex:pathValues ex:salary ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:dept ex:employee ex:john, ex:jane, ex:bob .
ex:john ex:salary 50000 .
ex:jane ex:salary 60000 .
ex:bob ex:salary 45000 .
`,
  },

  // Conditionals
  {
    id: 'cond-exists',
    title: 'Exists',
    description: 'Check if expression produces any nodes',
    category: 'conditionals',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Check if person has any skills
ex:hasSkills shnex:exists [ shnex:pathValues ex:skill ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:skill ex:java .
ex:jane ex:name "Jane" .
`,
  },
  {
    id: 'cond-if-then-else',
    title: 'If/Then/Else',
    description: 'Conditional expression with lazy evaluation',
    category: 'conditionals',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix ex: <http://example.org/> .

# Return salary or default value
ex:effectiveSalary 
    shnex:if [ shnex:exists [ shnex:pathValues ex:salary ] ] ;
    shnex:then [ shnex:pathValues ex:salary ] ;
    shnex:else "50000" .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:salary 60000 .
ex:jane ex:name "Jane" .
`,
  },

  // Dynamic SHACL
  {
    id: 'dynamic-minmax',
    title: 'Dynamic Min/Max',
    description: 'sh:minInclusive computed from another property',
    category: 'dynamic-shacl',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:AgeRangeShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:age ;
        # Minimum age is computed from minAgeConfig
        sh:minInclusive [
            shnex:pathValues ex:minAgeConfig
        ]
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:config ex:minAgeConfig 18 .

ex:john rdf:type ex:Person ;
    ex:age 25 .

ex:jane rdf:type ex:Person ;
    ex:age 16 .
`,
  },
  {
    id: 'dynamic-in',
    title: 'Dynamic In List',
    description: 'sh:in list computed dynamically',
    category: 'dynamic-shacl',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:DepartmentShape a sh:NodeShape ;
    sh:targetClass ex:Employee ;
    sh:property [
        sh:path ex:department ;
        # Valid departments are computed from config
        sh:in [
            shnex:pathValues ( ex:config ex:validDepartment )
        ]
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:config ex:validDepartment "Engineering", "Product", "Design" .

ex:john rdf:type ex:Employee ;
    ex:department "Engineering" .

ex:jane rdf:type ex:Employee ;
    ex:department "Marketing" .
`,
  },
  {
    id: 'dynamic-expression-constraint',
    title: 'Expression Constraint',
    description: 'sh:expression for custom validation logic',
    category: 'dynamic-shacl',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .

ex:EmployeeShape a sh:NodeShape ;
    sh:targetClass ex:Employee ;
    # Employee must have at least one skill
    sh:expression [
        shnex:exists [ shnex:pathValues ex:skill ]
    ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:john rdf:type ex:Employee ;
    ex:skill ex:java .

ex:jane rdf:type ex:Employee .
`,
  },

  // SPARQL Functions
  {
    id: 'sparql-strlen',
    title: 'String Length',
    description: 'Using SPARQL strlen function',
    category: 'sparql-functions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sparql: <http://www.w3.org/ns/sparql#> .
@prefix ex: <http://example.org/> .

# Get length of name
ex:nameLength a sparql:strlen ;
    shnex:arg1 [ shnex:pathValues ex:name ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:name "John Doe" .
`,
  },
  {
    id: 'sparql-concat',
    title: 'String Concatenation',
    description: 'Concatenate strings with SPARQL concat',
    category: 'sparql-functions',
    expressionCode: `@prefix shnex: <http://www.w3.org/ns/shacl-nex#> .
@prefix sparql: <http://www.w3.org/ns/sparql#> .
@prefix ex: <http://example.org/> .

# Create full name from parts
ex:fullName a sparql:concat ;
    shnex:arg1 [ shnex:pathValues ex:firstName ] ;
    shnex:arg2 " " ;
    shnex:arg3 [ shnex:pathValues ex:lastName ] .
`,
    rdfData: `@prefix ex: <http://example.org/> .

ex:john ex:firstName "John" ;
    ex:lastName "Doe" .
`,
  },
];

export function getNodeExprExamplesByCategory(
  category: NodeExprExampleCategory
): NodeExprExample[] {
  return nodeExprExamples.filter((e) => e.category === category);
}

export function getNodeExprExampleById(id: string): NodeExprExample | undefined {
  return nodeExprExamples.find((e) => e.id === id);
}

export function searchNodeExprExamples(query: string): NodeExprExample[] {
  const lowerQuery = query.toLowerCase();
  return nodeExprExamples.filter(
    (e) =>
      e.title.toLowerCase().includes(lowerQuery) ||
      e.description.toLowerCase().includes(lowerQuery) ||
      e.expressionCode.toLowerCase().includes(lowerQuery)
  );
}
