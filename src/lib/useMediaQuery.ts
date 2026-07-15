'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query and returns whether it currently matches.
 * SSR-safe: returns `false` on the server and during the first client render
 * (matching the server markup), then updates on mount and on every change.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    // Sync once on mount: matchMedia can't be read during render (it's a
    // browser API), and the server can't know the viewport, so the initial
    // value is resolved here after the SSR-matching first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only measurement, see comment above
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
