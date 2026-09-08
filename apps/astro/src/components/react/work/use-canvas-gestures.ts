import {
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import type { useWorkCamera } from './use-work-camera';

export function useCanvasGestures(
  camera: ReturnType<typeof useWorkCamera>,
  suppressClick: RefObject<boolean>,
  browse: (direction: number) => void,
  onGesture: () => void,
) {
  const swipe = useRef<{
    id: number;
    x: number;
    y: number;
    cameraX: number;
    moved: boolean;
  } | null>(null);
  const latest = useRef(onGesture);
  useLayoutEffect(() => {
    latest.current = onGesture;
  });
  useEffect(() => {
    const element = camera.viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      latest.current();
      const bounds = element.getBoundingClientRect();
      const px = event.clientX - bounds.left - bounds.width / 2;
      const py = event.clientY - bounds.top - bounds.height / 2;
      const oldScale = camera.scale.get();
      const scale = Math.max(
        0.1,
        Math.min(1.6, oldScale * Math.exp(-event.deltaY * 0.008)),
      );
      camera.move(
        {
          x: px - ((px - camera.x.get()) * scale) / oldScale,
          y: py - ((py - camera.y.get()) * scale) / oldScale,
          scale,
        },
        true,
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [camera.viewport, camera.x, camera.y, camera.scale, camera.move]);
  function start(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary) {
      if (swipe.current?.moved) camera.x.jump(swipe.current.cameraX);
      swipe.current = null;
      return;
    }
    swipe.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x.get(),
      moved: false,
    };
    onGesture();
    camera.x.stop();
  }
  function move(event: PointerEvent<HTMLElement>) {
    const start = swipe.current;
    if (start && start.id === event.pointerId) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        start.moved = true;
        suppressClick.current = true;
        camera.x.set(start.cameraX + dx * 0.55);
        event.currentTarget.setAttribute('data-dragging', 'true');
      }
    }
  }
  function end(event: PointerEvent<HTMLElement>) {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (start.moved && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      browse(dx < 0 ? 1 : -1);
    } else if (start.moved)
      camera.move({
        x: start.cameraX,
        y: camera.y.get(),
        scale: camera.scale.get(),
      });
    camera.viewport.current?.removeAttribute('data-dragging');
  }
  function cancel() {
    if (swipe.current?.moved) camera.x.jump(swipe.current.cameraX);
    swipe.current = null;
    camera.viewport.current?.removeAttribute('data-dragging');
  }
  return { start, move, end, cancel };
}
