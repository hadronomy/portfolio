import {
  clock,
  type Effect,
  effect,
  type FrameLoopHandle,
  frameLoop,
  type Gpu,
  init,
  type ShaderSource,
  type Surface,
  surface,
} from 'vgpu';

/**
 * Drives every live shader cover on the page from one device and one loop.
 *
 * A WebGPU device per cover would work and is what mounting each canvas
 * independently gives you, but four prints on the work canvas would then hold
 * four devices, four swap chains, and four animation loops for four small
 * pictures. One device, one `requestAnimationFrame`, and one command buffer
 * per frame keeps the cost proportional to what is actually being drawn.
 *
 * Nothing here decides whether a cover *should* run — WebGPU support, reduced
 * motion, and visibility are the component's call, which is why
 * `registerShaderCover` expects a canvas that is already on screen.
 */

interface Cover {
  readonly surface: Surface;
  readonly pass: Effect;
  /** Set by the component: a cover scrolled out of view is not drawn. */
  visible: boolean;
}

/** Ambient art, not a game. Half rate is invisible here and costs half. */
const FRAME_RATE = 30;

const covers = new Set<Cover>();
let gpuPromise: Promise<Gpu> | undefined;
let loop: FrameLoopHandle | undefined;

/**
 * Whether this browser can run a live cover at all.
 *
 * Callers must check this before `register`: everything downstream assumes a
 * poster is already on screen, and a browser without WebGPU should keep it.
 */
export function supportsShaderCovers(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function startLoop(gpu: Gpu) {
  if (loop) return;
  const time = clock(gpu);
  loop = frameLoop(
    gpu,
    (frame) => {
      for (const cover of covers) {
        if (!cover.visible) continue;
        cover.pass.set({ params: { time: time.time } });
        frame.pass(cover.surface, cover.pass);
      }
    },
    { fps: FRAME_RATE },
  );
}

/**
 * Starts drawing `source` into `canvas`. Returns a handle whose `dispose`
 * releases the surface and, once the last cover is gone, the device itself.
 *
 * The returned promise resolves after the first frame has been drawn, so a
 * caller can reveal the canvas without showing an empty one first.
 */
export async function registerShaderCover(
  canvas: HTMLCanvasElement,
  source: ShaderSource,
  label: string,
): Promise<{ dispose: () => void; setVisible: (visible: boolean) => void }> {
  gpuPromise ??= init();
  const gpu = await gpuPromise;

  const canvasSurface = surface(gpu, canvas, {
    label,
    // Two device pixels per CSS pixel is the ceiling worth paying for here.
    // The prints are small and the art is hairlines, which alias badly at 1.
    dpr: [1, 2],
  });

  const cover: Cover = {
    surface: canvasSurface,
    pass: effect(gpu, source, {
      label,
      set: {
        params: {
          time: 0,
          aspect: canvasSurface.size[0] / canvasSurface.size[1],
          pixel: 1 / canvasSurface.size[1],
        },
      },
    }),
    visible: true,
  };

  // Aspect and pixel size are size-class values: they change when the print
  // is resized and at no other time, so they stay out of the frame loop.
  canvasSurface.onResize(({ width, height }) => {
    cover.pass.set({ params: { aspect: width / height, pixel: 1 / height } });
  });

  // Pre-warm the pipeline for the format this surface presents. Compiling
  // against the surface itself is not allowed outside a frame, and a signature
  // is all the compiler needs — without this the pipeline is built inside the
  // first `frame.pass`, which is when the browser is busiest.
  await cover.pass.compile({ colors: [canvasSurface.format] });

  covers.add(cover);
  startLoop(gpu);

  return {
    setVisible(visible) {
      cover.visible = visible;
    },
    dispose() {
      covers.delete(cover);
      canvasSurface.dispose();
      if (covers.size > 0) return;
      // The loop stops with the last cover, but the device stays for the life
      // of the page. Tearing it down here would race every registration still
      // in flight for another cover — and on a client-side navigation the next
      // page's covers would only have to pay for a new one.
      loop?.stop();
      loop = undefined;
    },
  };
}
