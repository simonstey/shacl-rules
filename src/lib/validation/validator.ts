import { parseSRL } from '../srl/parser';
import { SRLLexer } from '../srl/tokens';
import { IToken } from 'chevrotain';

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  message: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ValidationResult {
  messages: ValidationMessage[];
  parseTime: number;
  isValid: boolean;
}

export interface WorkerMessage {
  type: 'validate' | 'parse';
  id: string;
  code: string;
}

export interface WorkerResponse {
  type: 'result';
  id: string;
  result: ValidationResult;
}

interface PrefixDeclaration {
  prefix: string;
  iri: string;
  line: number;
  column: number;
}

interface VariableUsage {
  name: string;
  line: number;
  column: number;
  isInHead: boolean;
}

function extractPrefixes(tokens: IToken[]): PrefixDeclaration[] {
  const prefixes: PrefixDeclaration[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.tokenType?.name === 'Prefix') {
      let prefix = '';
      let iriToken: IToken | null = null;
      
      if (i + 1 < tokens.length) {
        const next = tokens[i + 1];
        if (next.tokenType?.name === 'Identifier') {
          prefix = next.image;
          if (i + 3 < tokens.length && tokens[i + 3]?.tokenType?.name === 'IRI') {
            iriToken = tokens[i + 3];
          }
        } else if (next.tokenType?.name === 'Colon') {
          prefix = '';
          if (i + 2 < tokens.length && tokens[i + 2]?.tokenType?.name === 'IRI') {
            iriToken = tokens[i + 2];
          }
        }
      }
      
      if (iriToken) {
        prefixes.push({
          prefix,
          iri: iriToken.image,
          line: token.startLine || 1,
          column: token.startColumn || 1,
        });
      }
    }
  }
  
  return prefixes;
}

// Debug logging - set to true to enable verbose output
const DEBUG_VALIDATOR = true;//typeof window !== 'undefined' && (window as unknown as { DEBUG_SRL_VALIDATOR?: boolean }).DEBUG_SRL_VALIDATOR === true;

function debugLog(...args: unknown[]): void {
  if (DEBUG_VALIDATOR) {
    console.log('[SRL Validator]', ...args);
  }
}

function extractVariablesAndPrefixUsages(tokens: IToken[]): { 
  variables: VariableUsage[];
  prefixUsages: Array<{ prefix: string; line: number; column: number; fullName: string }>;
} {
  const variables: VariableUsage[] = [];
  const prefixUsages: Array<{ prefix: string; line: number; column: number; fullName: string }> = [];
  
  // Track rule context with proper brace counting
  // Rule forms:
  //   RULE { head } WHERE { body }  - head in first block, body in second
  //   IF { body } THEN { head }     - body in first block, head in second
  //   { head } :- { body }          - head in first block, body in second
  
  type RuleForm = 'rule-where' | 'if-then' | 'datalog' | null;
  let ruleForm: RuleForm = null;
  let ruleStartBraceDepth = 0;
  let blockIndex = 0; // 0 = first block, 1 = second block
  let braceDepth = 0;
  let inBlock = false;
  
  debugLog('=== Starting extractVariablesAndPrefixUsages ===');
  debugLog('Total tokens:', tokens.length);
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenType = token.tokenType?.name;
    
    // Detect rule form start
    if (tokenType === 'Rule') {
      debugLog(`[${i}] Found RULE keyword at line ${token.startLine}`);
      ruleForm = 'rule-where';
      blockIndex = 0;
      ruleStartBraceDepth = braceDepth;
    } else if (tokenType === 'If') {
      debugLog(`[${i}] Found IF keyword at line ${token.startLine}`);
      ruleForm = 'if-then';
      blockIndex = 0;
      ruleStartBraceDepth = braceDepth;
    } else if (tokenType === 'LBrace' && ruleForm === null) {
      // Potential datalog-style rule starting with { head }
      // Look ahead for :- to confirm
      let hasColonMinus = false;
      let depth = 1;
      for (let j = i + 1; j < tokens.length && depth > 0; j++) {
        const tt = tokens[j].tokenType?.name;
        if (tt === 'LBrace') depth++;
        else if (tt === 'RBrace') depth--;
        else if (depth === 0 || (depth === 1 && tt === 'ColonMinus')) {
          // Check if :- follows the closing brace
          if (j + 1 < tokens.length && tokens[j]?.tokenType?.name === 'RBrace') {
            for (let k = j + 1; k < tokens.length; k++) {
              const nextTT = tokens[k].tokenType?.name;
              if (nextTT === 'WhiteSpace') continue;
              if (nextTT === 'ColonMinus') {
                hasColonMinus = true;
              }
              break;
            }
          }
          break;
        }
      }
      if (hasColonMinus) {
        ruleForm = 'datalog';
        blockIndex = 0;
        ruleStartBraceDepth = braceDepth;
      }
    }
    
    // Track transitions between blocks
    if (tokenType === 'Where' && ruleForm === 'rule-where') {
      debugLog(`[${i}] Found WHERE keyword, transitioning to body block`);
      blockIndex = 1;
    } else if (tokenType === 'Then' && ruleForm === 'if-then') {
      debugLog(`[${i}] Found THEN keyword, transitioning to head block`);
      blockIndex = 1;
    } else if (tokenType === 'ColonMinus' && ruleForm === 'datalog') {
      debugLog(`[${i}] Found :- operator, transitioning to body block`);
      blockIndex = 1;
    }
    
    // Track brace depth
    if (tokenType === 'LBrace') {
      braceDepth++;
      inBlock = true;
      debugLog(`[${i}] LBrace: braceDepth=${braceDepth}, ruleForm=${ruleForm}, blockIndex=${blockIndex}`);
    } else if (tokenType === 'RBrace') {
      braceDepth--;
      debugLog(`[${i}] RBrace: braceDepth=${braceDepth}, ruleStartBraceDepth=${ruleStartBraceDepth}, blockIndex=${blockIndex}`);
      if (braceDepth === ruleStartBraceDepth && blockIndex === 1) {
        debugLog(`[${i}] End of rule detected, resetting state`);
        // End of rule
        ruleForm = null;
        blockIndex = 0;
        inBlock = false;
      }
    }
    
    // Determine if current position is in head or body
    const isInHead = ruleForm !== null && inBlock && (
      (ruleForm === 'rule-where' && blockIndex === 0) ||
      (ruleForm === 'if-then' && blockIndex === 1) ||
      (ruleForm === 'datalog' && blockIndex === 0)
    );
    
    if (tokenType === 'QuestionVar' || tokenType === 'DollarVar') {
      debugLog(`[${i}] Variable ${token.image} at line ${token.startLine}: ruleForm=${ruleForm}, blockIndex=${blockIndex}, inBlock=${inBlock}, isInHead=${isInHead}`);
      variables.push({
        name: token.image,
        line: token.startLine || 1,
        column: token.startColumn || 1,
        isInHead,
      });
    }
    
    if (tokenType === 'PrefixedName') {
      const match = token.image.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):/);
      if (match) {
        prefixUsages.push({
          prefix: match[1],
          line: token.startLine || 1,
          column: token.startColumn || 1,
          fullName: token.image,
        });
      }
    }
  }
  
  return { variables, prefixUsages };
}

function checkSemanticIssues(tokens: IToken[], prefixes: PrefixDeclaration[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const { variables, prefixUsages } = extractVariablesAndPrefixUsages(tokens);
  
  debugLog('=== Variables extracted ===');
  debugLog('All variables:', variables.map(v => ({ name: v.name, line: v.line, isInHead: v.isInHead })));
  
  const declaredPrefixes = new Set(prefixes.map(p => p.prefix));
  declaredPrefixes.add(''); // Empty prefix is always valid if declared
  
  // Check for undefined prefixes
  for (const usage of prefixUsages) {
    if (!declaredPrefixes.has(usage.prefix)) {
      messages.push({
        type: 'warning',
        message: `Undefined prefix '${usage.prefix}:' used in '${usage.fullName}'`,
        startLine: usage.line,
        startColumn: usage.column,
        endLine: usage.line,
        endColumn: usage.column + usage.fullName.length,
      });
    }
  }
  
  // Check for variables used in head but not defined in body
  const ruleGroups = groupVariablesByRule(tokens, variables);
  debugLog('=== Rule groups ===');
  debugLog('Number of rule groups:', ruleGroups.length);
  ruleGroups.forEach((group, idx) => {
    debugLog(`Group ${idx}:`, group.map(v => ({ name: v.name, line: v.line, isInHead: v.isInHead })));
  });
  
  for (const group of ruleGroups) {
    const bodyVars = new Set(group.filter(v => !v.isInHead).map(v => v.name));
    const headVars = group.filter(v => v.isInHead);
    
    debugLog('Processing group - bodyVars:', [...bodyVars], 'headVars:', headVars.map(v => v.name));
    
    for (const headVar of headVars) {
      if (!bodyVars.has(headVar.name)) {
        debugLog(`WARNING: ${headVar.name} not found in bodyVars`);
        messages.push({
          type: 'warning',
          message: `Variable '${headVar.name}' in rule head is not bound in rule body`,
          startLine: headVar.line,
          startColumn: headVar.column,
          endLine: headVar.line,
          endColumn: headVar.column + headVar.name.length,
        });
      }
    }
  }
  
  // Check for duplicate prefix declarations
  const prefixCounts = new Map<string, number>();
  for (const prefix of prefixes) {
    const key = prefix.prefix;
    prefixCounts.set(key, (prefixCounts.get(key) || 0) + 1);
  }
  
  for (const prefix of prefixes) {
    if ((prefixCounts.get(prefix.prefix) || 0) > 1) {
      messages.push({
        type: 'info',
        message: `Prefix '${prefix.prefix || ':'}' is declared multiple times`,
        startLine: prefix.line,
        startColumn: prefix.column,
        endLine: prefix.line,
        endColumn: prefix.column + 6, // LENGTH of "PREFIX"
      });
    }
  }
  
  return messages;
}

function groupVariablesByRule(tokens: IToken[], variables: VariableUsage[]): VariableUsage[][] {
  const groups: VariableUsage[][] = [];
  let currentRuleStart = -1;
  let currentRuleEnd = -1;
  let braceDepth = 0;
  let ruleStartBraceDepth = 0;
  let blockCount = 0; // Track how many brace blocks we've seen in current rule
  
  debugLog('=== groupVariablesByRule ===');
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenType = token.tokenType?.name;
    
    if (tokenType === 'Rule' || tokenType === 'If') {
      debugLog(`[${i}] Rule/If at offset ${token.startOffset}, braceDepth=${braceDepth}`);
      currentRuleStart = token.startOffset || 0;
      ruleStartBraceDepth = braceDepth;
      blockCount = 0;
    } else if (tokenType === 'LBrace') {
      braceDepth++;
      if (currentRuleStart >= 0) {
        debugLog(`[${i}] LBrace in rule, braceDepth=${braceDepth}, blockCount=${blockCount}`);
      }
    } else if (tokenType === 'RBrace') {
      braceDepth--;
      if (currentRuleStart >= 0 && braceDepth === ruleStartBraceDepth) {
        blockCount++;
        debugLog(`[${i}] RBrace closes block, braceDepth=${braceDepth}, blockCount=${blockCount}`);
        
        // A complete rule has 2 brace blocks (head and body)
        if (blockCount >= 2) {
          currentRuleEnd = token.endOffset || token.startOffset || 0;
          debugLog(`Rule complete: start=${currentRuleStart}, end=${currentRuleEnd}`);
          
          // Collect variables in this range
          const ruleVars = variables.filter(v => {
            const varOffset = getOffsetForLine(tokens, v.line, v.column);
            const inRange = varOffset >= currentRuleStart && varOffset <= currentRuleEnd;
            debugLog(`  Variable ${v.name} at offset ${varOffset}: inRange=${inRange}`);
            return inRange;
          });
          
          if (ruleVars.length > 0) {
            debugLog(`Adding group with ${ruleVars.length} variables`);
            groups.push(ruleVars);
          }
          
          currentRuleStart = -1;
          blockCount = 0;
        }
      }
    }
  }
  
  debugLog(`Total groups: ${groups.length}`);
  return groups;
}

function getOffsetForLine(tokens: IToken[], line: number, column: number): number {
  for (const token of tokens) {
    if ((token.startLine || 1) === line && (token.startColumn || 1) === column) {
      return token.startOffset;
    }
  }
  // Fallback: find any token on the same line with closest column
  let bestMatch: IToken | null = null;
  let bestDistance = Infinity;
  for (const token of tokens) {
    if ((token.startLine || 1) === line) {
      const distance = Math.abs((token.startColumn || 1) - column);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = token;
      }
    }
  }
  if (bestMatch) {
    debugLog(`getOffsetForLine fallback: line=${line}, col=${column} -> matched token at col ${bestMatch.startColumn}, offset ${bestMatch.startOffset}`);
    return bestMatch.startOffset;
  }
  debugLog(`getOffsetForLine: no match for line=${line}, col=${column}`);
  return 0;
}

export function validateSRL(code: string): ValidationResult {
  const startTime = performance.now();
  const messages: ValidationMessage[] = [];

  try {
    // First, try lexing
    const lexResult = SRLLexer.tokenize(code);

    // Add lexer errors
    for (const error of lexResult.errors) {
      messages.push({
        type: 'error',
        message: error.message,
        startLine: error.line ?? 1,
        startColumn: error.column ?? 1,
        endLine: error.line ?? 1,
        endColumn: (error.column ?? 1) + (error.length ?? 1),
      });
    }

    // Then parse
    const parseResult = parseSRL(code);

    // Add parser errors
    for (const error of parseResult.errors) {
      const token = error.token;
      messages.push({
        type: 'error',
        message: error.message,
        startLine: token?.startLine ?? 1,
        startColumn: token?.startColumn ?? 1,
        endLine: token?.endLine ?? token?.startLine ?? 1,
        endColumn: token?.endColumn ?? (token?.startColumn ?? 1) + 1,
      });
    }
    
    // Run semantic analysis if no parse errors
    if (parseResult.errors.length === 0) {
      const prefixes = extractPrefixes(parseResult.tokens);
      const semanticMessages = checkSemanticIssues(parseResult.tokens, prefixes);
      messages.push(...semanticMessages);
    }
  } catch (e) {
    messages.push({
      type: 'error',
      message: e instanceof Error ? e.message : 'Unknown parsing error',
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 1,
    });
  }

  const parseTime = performance.now() - startTime;

  return {
    messages,
    parseTime,
    isValid: messages.filter((m) => m.type === 'error').length === 0,
  };
}
