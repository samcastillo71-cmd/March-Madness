import { useRef, useLayoutEffect, useState, useCallback } from 'react';

export function BracketConnector({ leftGameRefs, rightGameRefs, color = 'var(--ink)' }) {
  const svgRef = useRef(null);
  const [paths, setPaths] = useState([]);

  const measure = useCallback(() => {
    if (!svgRef.current) return;
    const svgEl        = svgRef.current;
    const svgOffsetLeft = svgEl.offsetLeft;
    const svgOffsetTop  = svgEl.offsetTop;
    const next = [];

    for (let i = 0; i < rightGameRefs.length; i++) {
      const topEl   = leftGameRefs[i * 2]?.current;
      const botEl   = leftGameRefs[i * 2 + 1]?.current;
      const rightEl = rightGameRefs[i]?.current;
      if (!topEl || !botEl || !rightEl) continue;

      // offsetLeft/Top relative to same offsetParent as svgEl.
      // getBoundingClientRect is viewport-relative and drifts on horizontal scroll.
      const x1   = topEl.offsetLeft + topEl.offsetWidth  - svgOffsetLeft;
      const y1   = topEl.offsetTop  + topEl.offsetHeight / 2 - svgOffsetTop;
      const y2   = botEl.offsetTop  + botEl.offsetHeight / 2 - svgOffsetTop;
      const yMid = (y1 + y2) / 2;
      const x2   = rightEl.offsetLeft - svgOffsetLeft;
      const xMid = x1 + (x2 - x1) / 2;

      next.push(`M ${x1} ${y1} H ${xMid} V ${yMid}`);
      next.push(`M ${x1} ${y2} H ${xMid} V ${yMid}`);
      next.push(`M ${xMid} ${yMid} H ${x2}`);
    }
    setPaths(next);
  }, [leftGameRefs, rightGameRefs]);

  // ResizeObserver fires only when sizes change, not on every parent render.
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (svgRef.current?.parentElement) ro.observe(svgRef.current.parentElement);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <svg ref={svgRef} aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
               pointerEvents: 'none', overflow: 'visible' }}>
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth="2"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
