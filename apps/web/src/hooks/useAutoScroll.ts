'use client';

import { useEffect, useRef } from 'react';

/**
 * Single responsibility: pin a scrollable container to its bottom whenever
 * `dep` changes (e.g., new transcript chunk or chat message arrived), unless
 * the user has scrolled up — in that case we leave them alone.
 */
export function useAutoScroll<T>(dep: T) {
  const ref = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      stickRef.current = distanceFromBottom < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dep]);

  return ref;
}
