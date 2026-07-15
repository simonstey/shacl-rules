'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface DiagramMessage {
  type: 'hover' | 'click' | 'ready';
  ruleName?: string;
}

export interface UseSyntaxDiagramsOptions {
  onRuleHover?: (ruleName: string | null) => void;
  onRuleClick?: (ruleName: string) => void;
}

export interface UseSyntaxDiagramsReturn {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  highlightRule: (ruleName: string | null) => void;
  scrollToRule: (ruleName: string) => void;
  isReady: boolean;
}

export function useSyntaxDiagrams(options: UseSyntaxDiagramsOptions = {}): UseSyntaxDiagramsReturn {
  const { onRuleHover, onRuleClick } = options;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== 'srl-diagram') return;

      const message = event.data as DiagramMessage & { source: string };

      switch (message.type) {
        case 'ready':
          setIsReady(true);
          break;
        case 'hover':
          onRuleHover?.(message.ruleName ?? null);
          break;
        case 'click':
          if (message.ruleName) {
            onRuleClick?.(message.ruleName);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onRuleHover, onRuleClick]);

  const postMessage = useCallback((message: { type: string; ruleName?: string | null }) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { ...message, source: 'srl-editor' },
        '*'
      );
    }
  }, []);

  const highlightRule = useCallback((ruleName: string | null) => {
    postMessage({ type: 'highlight', ruleName });
  }, [postMessage]);

  const scrollToRule = useCallback((ruleName: string) => {
    postMessage({ type: 'scrollTo', ruleName });
  }, [postMessage]);

  return {
    iframeRef,
    highlightRule,
    scrollToRule,
    isReady,
  };
}

const KEYWORD_TO_RULE_MAP: Record<string, string> = {
  RULE: 'rule1',
  WHERE: 'rule1',
  IF: 'rule2',
  THEN: 'rule2',
  DATA: 'dataBlock',
  PREFIX: 'prefixDecl',
  BASE: 'baseDecl',
  FILTER: 'filterClause',
  SET: 'assignment',
  NOT: 'negation',
  TRANSITIVE: 'declaration',
  SYMMETRIC: 'declaration',
  INVERSE: 'declaration',
  VERSION: 'versionDecl',
  IMPORTS: 'importsDecl',
};

export function getGrammarRuleForKeyword(keyword: string): string | null {
  return KEYWORD_TO_RULE_MAP[keyword.toUpperCase()] ?? null;
}

export function getGrammarRuleForContext(lineContent: string, column: number): string | null {
  const beforeCursor = lineContent.substring(0, column);
  
  const keywordMatch = beforeCursor.match(/\b(RULE|WHERE|IF|THEN|DATA|PREFIX|BASE|FILTER|SET|NOT|TRANSITIVE|SYMMETRIC|INVERSE|VERSION|IMPORTS)\b/gi);
  if (keywordMatch) {
    const lastKeyword = keywordMatch[keywordMatch.length - 1];
    return getGrammarRuleForKeyword(lastKeyword);
  }

  if (/\?[a-zA-Z_]\w*/.test(beforeCursor) || /\$[a-zA-Z_]\w*/.test(beforeCursor)) {
    return 'variable';
  }

  if (/<[^>]+>/.test(beforeCursor)) {
    return 'iriRef';
  }

  if (/[a-zA-Z_][a-zA-Z0-9_-]*:[a-zA-Z_][a-zA-Z0-9_-]*/.test(beforeCursor)) {
    return 'iriRef';
  }

  return null;
}
