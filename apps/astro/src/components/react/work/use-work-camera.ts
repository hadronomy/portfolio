import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  compositionBounds,
  type PrintPlacement,
  printHeight,
} from './canvas-layout';

export function useWorkCamera(
  placements: readonly PrintPlacement[],
  initialIndex: number,
) {
  const viewport = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const [zoom, setZoom] = useState(1);
  const reduced = useReducedMotion();
  const initial = useRef({ placements, initialIndex });
  useLayoutEffect(() => {
    initial.current = { placements, initialIndex };
  }, [placements, initialIndex]);

  const move = useCallback(
    (next: { x: number; y: number; scale: number }, instant = false) => {
      x.stop();
      y.stop();
      scale.stop();
      const target = Math.max(0.1, Math.min(1.6, next.scale));
      setZoom(target);
      if (instant || reduced) {
        x.jump(next.x);
        y.jump(next.y);
        scale.jump(target);
        return;
      }
      const spring = {
        type: 'spring',
        stiffness: 220,
        damping: 30,
        mass: 0.7,
      } as const;
      animate(x, next.x, spring);
      animate(y, next.y, spring);
      animate(scale, target, spring);
    },
    [x, y, scale, reduced],
  );

  function fit(instant = false, prints = placements) {
    const element = viewport.current;
    if (!element) return;
    const bounds = compositionBounds(prints);
    const nextScale = Math.min(
      1,
      (element.clientWidth - 64) / bounds.width,
      (element.clientHeight - 72) / bounds.height,
    );
    move(
      { x: -bounds.x * nextScale, y: -bounds.y * nextScale, scale: nextScale },
      instant,
    );
  }

  function focus(index: number, instant = false, prints = placements) {
    const element = viewport.current;
    const print = prints[index];
    if (!element || !print) return;
    const nextScale = Math.min(
      1.12,
      (element.clientWidth - 88) / print.width,
      (element.clientHeight - 112) / printHeight(print.width),
    );
    move(
      { x: -print.x * nextScale, y: -print.y * nextScale, scale: nextScale },
      instant,
    );
  }

  function zoomBy(factor: number, instant = false) {
    const currentScale = scale.get();
    const nextScale = Math.max(0.1, Math.min(1.6, currentScale * factor));
    move(
      {
        x: (x.get() * nextScale) / currentScale,
        y: (y.get() * nextScale) / currentScale,
        scale: nextScale,
      },
      instant,
    );
  }

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let previousSize = '';
    const sync = () => {
      const size = `${element.clientWidth}:${element.clientHeight}`;
      if (size === previousSize) return;
      previousSize = size;
      const { placements: prints, initialIndex: index } = initial.current;
      const bounds = compositionBounds(prints);
      const narrow = element.clientWidth < 700;
      const print = prints[index];
      const nextScale = narrow
        ? Math.min(
            0.95,
            (element.clientWidth - 88) / print.width,
            (element.clientHeight - 112) / printHeight(print.width),
          )
        : Math.min(
            1,
            (element.clientWidth - 64) / bounds.width,
            (element.clientHeight - 72) / bounds.height,
          );
      move(
        {
          x: -(narrow ? print.x : bounds.x) * nextScale,
          y: -(narrow ? print.y : bounds.y) * nextScale,
          scale: nextScale,
        },
        true,
      );
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => {
      observer.disconnect();
      x.stop();
      y.stop();
      scale.stop();
    };
  }, [move, x, y, scale]);

  return { viewport, x, y, scale, zoom, move, fit, focus, zoomBy };
}
