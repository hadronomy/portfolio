import { useLayoutEffect, useRef } from 'react';
import type { useWorkCamera } from './use-work-camera';

interface CanvasSession {
  selectedId: string | null;
  spread: boolean;
  x: number;
  y: number;
  scale: number;
}

export function useCanvasSession(
  camera: ReturnType<typeof useWorkCamera>,
  selectedId: string | null,
  spread: boolean,
  restore: (saved: CanvasSession) => void,
) {
  const current = useRef({ camera, selectedId, spread, restore });
  useLayoutEffect(() => {
    current.current = { camera, selectedId, spread, restore };
  });
  useLayoutEffect(() => {
    const key = `work-canvas:${location.pathname}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (
        saved &&
        (saved.selectedId === null || typeof saved.selectedId === 'string') &&
        typeof saved.spread === 'boolean' &&
        [saved.x, saved.y, saved.scale].every(Number.isFinite) &&
        saved.scale >= 0.1 &&
        saved.scale <= 1.6
      ) {
        current.current.restore(saved);
        current.current.camera.move(saved, true);
      }
    } catch {
      // Browsing still works when the browser blocks session storage.
    }
    const save = () => {
      const {
        camera: view,
        selectedId: id,
        spread: expanded,
      } = current.current;
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({
            selectedId: id,
            spread: expanded,
            x: view.x.get(),
            y: view.y.get(),
            scale: view.scale.get(),
          }),
        );
      } catch {
        // Session storage is optional; navigation does not depend on it.
      }
    };
    document.addEventListener('astro:before-swap', save);
    window.addEventListener('pagehide', save);
    return () => {
      save();
      document.removeEventListener('astro:before-swap', save);
      window.removeEventListener('pagehide', save);
    };
  }, []);
}
