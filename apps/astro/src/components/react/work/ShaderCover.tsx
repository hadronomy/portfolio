import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ShaderCoverId } from '~/lib/shader-covers';
import type { WorkProject } from '~/lib/work';

/**
 * A project cover that is drawn rather than photographed.
 *
 * The poster is the cover. It is a real render of the same shader, it is in
 * the markup from the first byte, and it never goes transparent — WebGPU only
 * ever adds motion on top of a picture that is already there. A browser
 * without WebGPU, a visitor who asked for reduced motion, and a print that is
 * scrolled off screen all keep the still, which is also what the cursor shows
 * on hover.
 */

const sources: Record<ShaderCoverId, () => Promise<{ default: unknown }>> = {
  inari: () => import('~/shaders/inari.wgsl'),
  ram: () => import('~/shaders/ram.wgsl'),
  routes: () => import('~/shaders/routes.wgsl'),
};

/**
 * Serialises the work for one canvas.
 *
 * Setting up a cover is asynchronous and tearing one down is not, so a remount
 * can ask for a second surface on a canvas whose first surface is still being
 * built — which is exactly what React's development double-mount does, and
 * what the second caller gets back is `VGPU-SURFACE-DUPLICATE`. Chaining the
 * work per canvas makes a teardown wait for the setup it is cancelling.
 */
const queues = new WeakMap<HTMLCanvasElement, Promise<unknown>>();

function enqueue(canvas: HTMLCanvasElement, task: () => unknown) {
  const next = (queues.get(canvas) ?? Promise.resolve()).then(task, task);
  queues.set(canvas, next);
  return next;
}

interface CoverHandle {
  dispose: () => void;
  setVisible: (visible: boolean) => void;
}

export default function ShaderCover({
  project,
  shader,
}: {
  project: WorkProject;
  shader: ShaderCoverId;
}) {
  const reduced = useReducedMotion();
  const host = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (reduced) return;

    const element = host.current;
    const target = canvas.current;
    if (!element || !target) return;

    let disposed = false;
    let started = false;
    let handle: CoverHandle | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (handle) {
          handle.setVisible(entry.isIntersecting);
          return;
        }
        if (started || !entry.isIntersecting) return;
        started = true;

        void enqueue(target, async () => {
          if (disposed) return;
          // vgpu and the shader are both deferred: a visitor who never
          // reaches the work section never downloads a renderer.
          const [runtime, source] = await Promise.all([
            import('~/lib/shader-cover-runtime'),
            sources[shader](),
          ]);
          if (disposed || !runtime.supportsShaderCovers()) return;

          try {
            handle = await runtime.registerShaderCover(
              target,
              // The loader hands back a ShaderSource object, which is what
              // `effect()` wants; the cast is the seam where the `.wgsl`
              // module's type leaves this component's hands.
              source.default as Parameters<
                typeof runtime.registerShaderCover
              >[1],
              `${project.id} cover`,
            );
          } catch {
            // A device that refuses to start is not worth surfacing: the
            // poster underneath is already the complete picture.
            return;
          }
          if (disposed) {
            handle.dispose();
            handle = undefined;
            return;
          }
          setLive(true);
        });
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);

    return () => {
      disposed = true;
      observer.disconnect();
      setLive(false);
      void enqueue(target, () => {
        handle?.dispose();
        handle = undefined;
      });
    };
  }, [project.id, reduced, shader]);

  return (
    <span className="shader-cover" ref={host}>
      <img
        className="project-cover"
        src={project.cover.src}
        alt={project.cover.alt}
        width={project.cover.width}
        height={project.cover.height}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {/*
        The poster above carries the alt text for both of them — the canvas
        draws the same picture and has nothing of its own to announce. It is
        taken out of the tab order as well as the accessibility tree, because
        a canvas is focusable by default and hiding a focusable element strands
        keyboard users on a node their screen reader cannot describe.
      */}
      <canvas
        ref={canvas}
        className="shader-cover-canvas"
        data-live={live}
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  );
}
