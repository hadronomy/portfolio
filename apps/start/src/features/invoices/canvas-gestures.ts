/**
 * Direct manipulation for the document viewport: drag to pan with momentum,
 * rubber-band edges, and zoom by pinch, Ctrl/⌘ + wheel, or the dock buttons.
 * Two-finger trackpad scrolling and touch stay native; the browser already
 * does those well.
 *
 * The viewport element is looked up on every event, not captured once:
 * EmbedPDF may mount a fresh one each time the previewed document changes.
 */
export type ZoomTarget = {
  /** Current zoom as a scale factor, 1 = 100%. */
  level: () => number;
  /** Padding EmbedPDF keeps around the pages, in CSS pixels. */
  gap: () => number;
  /**
   * Applies a real zoom, a scale or `fit-page` (which keeps fitting on
   * resize), and must have laid the pages out at it by the time it returns.
   * The pinch removes its transform in the same frame, so a layout that
   * landed a frame later would show as a jump.
   */
  apply: (level: number | 'fit-page') => void;
  /**
   * The zoom the page shows while a gesture is in progress, so readouts can
   * follow the fingers; null once the real zoom has landed.
   */
  preview: (level: number | null) => void;
};

export type CanvasGestures = {
  /** Zooms by `factor` around the viewport centre, animated. */
  zoomBy: (factor: number) => void;
  /** Zooms until the page fits, animated, and keeps fitting on resize. */
  fit: () => void;
  detach: () => void;
};

const minZoom = 0.25;
const maxZoom = 4;
// Pixels of travel before a press becomes a pan, so a click stays a click.
const slop = 3;

/**
 * iOS-style rubber band: the further past the edge, the less the content
 * follows, and it can never travel more than one viewport.
 */
function rubber(overshoot: number, dimension: number) {
  if (!overshoot) return 0;
  const resisted = 1 - 1 / ((Math.abs(overshoot) * 0.55) / dimension + 1);
  return Math.sign(overshoot) * resisted * dimension;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function attachCanvasGestures(
  surface: HTMLElement,
  zoom: ZoomTarget,
): CanvasGestures {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = () => surface.querySelector<HTMLElement>('.iv-pdf-viewport');

  // ---- Momentum ---------------------------------------------------------
  let glide = 0;
  const stopGlide = () => {
    cancelAnimationFrame(glide);
    glide = 0;
  };
  function startGlide(element: HTMLElement, vx: number, vy: number) {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const beforeLeft = element.scrollLeft;
      const beforeTop = element.scrollTop;
      element.scrollLeft += vx * dt;
      element.scrollTop += vy * dt;
      // Hitting an edge ends the glide on that axis instead of bouncing:
      // the bounce belongs to the hand, not to leftover momentum.
      if (element.scrollLeft === beforeLeft) vx = 0;
      if (element.scrollTop === beforeTop) vy = 0;
      // Friction is per 16ms so the glide lasts the same at any frame rate.
      const friction = 0.95 ** (dt / 16);
      vx *= friction;
      vy *= friction;
      // Below about 0.8px a frame the glide only creeps; end it cleanly.
      if (Math.hypot(vx, vy) < 0.05) glide = 0;
      else glide = requestAnimationFrame(frame);
    };
    glide = requestAnimationFrame(frame);
  }

  // ---- Drag to pan --------------------------------------------------------
  type Press = {
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
    panning: boolean;
    samples: { t: number; x: number; y: number }[];
  };
  let press: Press | null = null;
  let settleBand = 0;

  const content = (element: HTMLElement) =>
    element.firstElementChild as HTMLElement | null;

  function onPointerDown(event: PointerEvent) {
    // Touch scrolls natively, with the platform's own momentum.
    if (event.pointerType === 'touch' || pinch) return;
    if (event.button !== 0 && event.button !== 1) return;
    const element = viewport();
    if (!element || !element.contains(event.target as Node)) return;
    stopGlide();
    // Middle-button press would otherwise start the browser's autoscroll.
    if (event.button === 1) event.preventDefault();
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
      panning: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
  }

  function onPointerMove(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    const element = viewport();
    if (!element) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!press.panning) {
      if (Math.hypot(dx, dy) < slop) return;
      press.panning = true;
      surface.setPointerCapture(event.pointerId);
      element.dataset.panning = 'true';
      clearTimeout(settleBand);
      const inner = content(element);
      if (inner) inner.style.transition = 'none';
    }
    const maxLeft = element.scrollWidth - element.clientWidth;
    const maxTop = element.scrollHeight - element.clientHeight;
    const wantLeft = press.left - dx;
    const wantTop = press.top - dy;
    const left = clamp(wantLeft, 0, maxLeft);
    const top = clamp(wantTop, 0, maxTop);
    element.scrollLeft = left;
    element.scrollTop = top;
    // Whatever the scroll cannot absorb becomes a damped offset, so a drag
    // always answers, even on a page that already fits.
    const inner = content(element);
    if (inner) {
      const bandX = -rubber(wantLeft - left, element.clientWidth);
      const bandY = -rubber(wantTop - top, element.clientHeight);
      inner.style.transform =
        bandX || bandY ? `translate(${bandX}px, ${bandY}px)` : '';
    }
    press.samples.push({
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    });
    // Only the last ~80ms decide the release velocity.
    while (
      press.samples.length > 2 &&
      event.timeStamp - (press.samples[0]?.t ?? 0) > 80
    )
      press.samples.shift();
  }

  function onPointerUp(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    const ended = press;
    press = null;
    if (!ended.panning) return;
    const element = viewport();
    if (surface.hasPointerCapture(event.pointerId))
      surface.releasePointerCapture(event.pointerId);
    if (!element) return;
    delete element.dataset.panning;
    const inner = content(element);
    const banded = !!inner?.style.transform;
    if (inner && banded) {
      // Spring back on the iOS drawer curve: quick to leave, soft to land.
      inner.style.transition = 'transform 400ms cubic-bezier(0.32, 0.72, 0, 1)';
      inner.style.transform = '';
      settleBand = window.setTimeout(() => {
        inner.style.transition = '';
      }, 420);
    }
    // A released band has nowhere to glide, and reduced motion means the
    // page stops where the hand let go.
    if (banded || reduced.matches) return;
    const first = ended.samples[0];
    const last = ended.samples[ended.samples.length - 1];
    if (!first || !last || last.t - first.t <= 0) return;
    // Stale samples mean the hand stopped before letting go: no flick.
    if (event.timeStamp - last.t > 60) return;
    const vx = -(last.x - first.x) / (last.t - first.t);
    const vy = -(last.y - first.y) / (last.t - first.t);
    if (Math.hypot(vx, vy) > 0.1) startGlide(element, vx, vy);
  }

  // A pan ends with a pointerup over whatever lies below; do not let that
  // count as a click on it.
  function onClick(event: MouseEvent) {
    const element = viewport();
    if (element?.dataset.justPanned) {
      event.stopPropagation();
      event.preventDefault();
    }
  }
  function markPanned(event: PointerEvent) {
    const element = viewport();
    if (element?.dataset.panning === 'true') {
      element.dataset.justPanned = 'true';
      setTimeout(() => {
        delete element.dataset.justPanned;
      }, 0);
    }
    onPointerUp(event);
  }

  // ---- Zoom ----------------------------------------------------------------
  // A pinch never changes the real zoom while fingers move. Each real zoom
  // re-lays out every page and re-renders its image, and EmbedPDF scrolls
  // before the larger layout exists, so the offset clamps toward the top
  // left: frame by frame that reads as a stutter that drifts to the corner.
  // Instead the page scales with a transform, which the compositor draws at
  // full frame rate, and the real zoom lands once, when the gesture ends,
  // behind a still of the scaled page.
  type Axis = { start: number; size: number };
  type Pinch = {
    base: number;
    k: number;
    x: number;
    y: number;
    content: HTMLElement;
    origin: DOMRect;
    view: DOMRect;
    gap: number;
    ax: Axis;
    ay: Axis;
    clientWidth: number;
    clientHeight: number;
  };
  let pinch: Pinch | null = null;
  let painted = 0;
  let idle = 0;
  // Frames spent holding the anchor after a commit (see end()).
  let holding = 0;

  // Where the pages sit on one axis, in screen pixels. A scrolled axis is
  // measured from the scroll geometry, because pages out of view are not
  // rendered; an axis that fits is measured from the pages themselves.
  function axis(
    element: HTMLElement,
    sheets: DOMRect[],
    vertical: boolean,
    view: DOMRect,
    gap: number,
  ): Axis {
    const scroll = vertical ? element.scrollHeight : element.scrollWidth;
    const client = vertical ? element.clientHeight : element.clientWidth;
    if (scroll > client + 1) {
      const offset = vertical ? element.scrollTop : element.scrollLeft;
      return {
        start: (vertical ? view.top : view.left) - offset + gap,
        size: scroll - 2 * gap,
      };
    }
    const starts = sheets.map((box) => (vertical ? box.top : box.left));
    const ends = sheets.map((box) => (vertical ? box.bottom : box.right));
    return {
      start: Math.min(...starts),
      size: Math.max(...ends) - Math.min(...starts),
    };
  }

  // Where the committed layout will put the pages at scale k, as EmbedPDF
  // lays them out: while they fit, centred across and top-aligned down; once
  // they overflow, anchored under the pointer and never past an edge, as the
  // scroll container clamps them. Each pair of cases meets at the fit
  // threshold, so crossing it does not jump.
  function place(
    a: Axis,
    pointer: number,
    k: number,
    viewStart: number,
    client: number,
    gap: number,
    centred: boolean,
  ) {
    const next = a.size * k;
    const room = client - 2 * gap;
    if (next <= room)
      return viewStart + gap + (centred ? (room - next) / 2 : 0);
    const anchored = pointer - k * (pointer - a.start);
    return Math.max(
      viewStart + client - gap - next,
      Math.min(viewStart + gap, anchored),
    );
  }

  function begin(x: number, y: number): Pinch | null {
    const element = viewport();
    const content = element?.firstElementChild as HTMLElement | null;
    if (!element || !content) return null;
    // A new gesture takes over from the last one's anchor hold.
    cancelAnimationFrame(holding);
    stopGlide();
    const view = element.getBoundingClientRect();
    const sheets = [
      ...element.querySelectorAll<HTMLElement>('.iv-page-sheet'),
    ].map((sheet) => sheet.getBoundingClientRect());
    if (!sheets.length) return null;
    const gap = zoom.gap();
    content.style.transition = 'none';
    content.style.transformOrigin = '0 0';
    content.style.willChange = 'transform';
    content.style.setProperty('--iv-pinch', '1');
    return {
      base: zoom.level(),
      k: 1,
      x,
      y,
      content,
      origin: content.getBoundingClientRect(),
      view,
      gap,
      ax: axis(element, sheets, false, view, gap),
      ay: axis(element, sheets, true, view, gap),
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
    };
  }

  function paint() {
    painted = 0;
    const p = pinch;
    if (!p) return;
    const left = place(p.ax, p.x, p.k, p.view.left, p.clientWidth, p.gap, true);
    const top = place(p.ay, p.y, p.k, p.view.top, p.clientHeight, p.gap, false);
    // With the origin at the content's top-left, a content point q lands at
    // origin + t + k·q; solve t so the pages start where place() says.
    const tx = left - p.origin.left - p.k * (p.ax.start - p.origin.left);
    const ty = top - p.origin.top - p.k * (p.ay.start - p.origin.top);
    p.content.style.transform = `translate(${tx}px, ${ty}px) scale(${p.k})`;
    // The sheets divide their shadow and corner radius by this, so the
    // transform leaves them their normal size and nothing about the page's
    // edge changes when the real zoom lands.
    p.content.style.setProperty('--iv-pinch', String(p.k));
    zoom.preview(p.base * p.k);
  }

  function scaleTo(k: number) {
    const p = pinch;
    if (!p) return;
    p.k = clamp(k, minZoom / p.base, maxZoom / p.base);
    if (!painted) painted = requestAnimationFrame(paint);
  }

  // A spot on a page, as fractions of that page, and the screen point it
  // sits under. After the real zoom lands, scrolling that spot back under
  // that point makes the sharp page line up with the scaled one exactly.
  type Mark = { page: string; fx: number; fy: number; x: number; y: number };
  function mark(element: HTMLElement, x: number, y: number): Mark | null {
    const view = element.getBoundingClientRect();
    const tries = [
      { x, y },
      { x: view.left + view.width / 2, y: view.top + view.height / 2 },
    ];
    for (const point of tries)
      for (const sheet of element.querySelectorAll<HTMLElement>(
        '.iv-page-sheet',
      )) {
        const box = sheet.getBoundingClientRect();
        const inside =
          point.x >= box.left &&
          point.x <= box.right &&
          point.y >= box.top &&
          point.y <= box.bottom;
        if (!inside || sheet.dataset.page === undefined) continue;
        return {
          page: sheet.dataset.page,
          fx: (point.x - box.left) / box.width,
          fy: (point.y - box.top) / box.height,
          ...point,
        };
      }
    return null;
  }

  // Scrolls so the marked spot is back under its screen point. Returns how
  // far the offset had to move; 0 means it holds (or an edge bounds it).
  function realign(target: Mark) {
    const live = viewport();
    const page = live?.querySelector<HTMLElement>(
      `.iv-page-sheet[data-page="${target.page}"]`,
    );
    if (!live || !page) return Number.POSITIVE_INFINITY;
    const box = page.getBoundingClientRect();
    const beforeLeft = live.scrollLeft;
    const beforeTop = live.scrollTop;
    live.scrollLeft += box.left + target.fx * box.width - target.x;
    live.scrollTop += box.top + target.fy * box.height - target.y;
    return (
      Math.abs(live.scrollLeft - beforeLeft) +
      Math.abs(live.scrollTop - beforeTop)
    );
  }

  // The real zoom lands in one frame: apply() lays the pages out at the new
  // size, the transform comes off, and the marked spot is scrolled back under
  // the pointer, all before the browser paints. Each page keeps its old
  // image stretched to the new size until the sharp render replaces it, which
  // looks exactly like the transformed page did. So the commit is invisible,
  // and the only change on screen is each page sharpening in place: no
  // still, no cross-fade, no double image while two renders overlap.
  function end(level?: 'fit-page') {
    const p = pinch;
    pinch = null;
    cancelAnimationFrame(painted);
    painted = 0;
    clearTimeout(idle);
    if (!p) return;
    const clear = () => {
      for (const node of new Set([p.content, viewport()?.firstElementChild]))
        if (node instanceof HTMLElement) {
          node.style.transform = '';
          node.style.transformOrigin = '';
          node.style.willChange = '';
          node.style.transition = '';
          node.style.removeProperty('--iv-pinch');
        }
    };
    const element = viewport();
    if (!element || (!level && Math.abs(p.k - 1) < 0.002)) {
      clear();
      zoom.preview(null);
      return;
    }
    // EmbedPDF rounds a zoom down to three decimals. Rounding the last
    // transformed frame the same way means the page is exactly as wide before
    // and after the commit, not a pixel off.
    const exact = Math.floor(p.base * p.k * 1000) / 1000;
    if (!level) p.k = exact / p.base;
    paint();
    const target = mark(element, p.x, p.y);
    zoom.apply(level ?? exact);
    clear();
    if (target) {
      // Twice: the first pass can land a fraction of a pixel off, because the
      // browser rounds scroll offsets.
      realign(target);
      realign(target);
    }
    zoom.preview(null);
    // EmbedPDF scrolls to its own idea of the anchor on the next frame. It
    // agrees with ours, give or take rounding; holding the anchor for a few
    // frames keeps that rounding from showing as a one-pixel twitch.
    if (!target) return;
    let frames = 0;
    const hold = () => {
      realign(target);
      frames += 1;
      if (frames < 4) holding = requestAnimationFrame(hold);
    };
    holding = requestAnimationFrame(hold);
  }

  function onWheel(event: WheelEvent) {
    const element = viewport();
    if (!element) return;
    stopGlide();
    // Trackpad pinch arrives as a Ctrl + wheel in Chromium and Firefox; the
    // same chord on a mouse wheel zooms too, as in every design tool.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    // A trackpad pinch sends many small deltas; a mouse notch sends one big
    // one. Capping each event keeps a notch near 1.4x instead of 3x.
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const factor = Math.exp(-clamp(delta, -40, 40) * 0.008);
    pinch ??= begin(event.clientX, event.clientY);
    if (!pinch) return;
    scaleTo(pinch.k * factor);
    // Wheel pinches have no end event: a short pause is the end.
    clearTimeout(idle);
    idle = window.setTimeout(() => end(), 140);
  }

  // Safari reports trackpad pinch as gesture events, with a clean end.
  type GestureEvent = UIEvent & {
    scale: number;
    clientX: number;
    clientY: number;
  };
  function onGestureStart(event: Event) {
    event.preventDefault();
    const gesture = event as GestureEvent;
    pinch = begin(gesture.clientX, gesture.clientY);
  }
  function onGestureChange(event: Event) {
    event.preventDefault();
    scaleTo((event as GestureEvent).scale);
  }
  function onGestureEnd(event: Event) {
    event.preventDefault();
    end();
  }

  // Buttons zoom around the viewport centre, animated on the same curve as
  // the rest of the interface. The transform does the motion; the real zoom
  // lands once, at the end, like a pinch.
  let tween = 0;
  function animateTo(factor: number, level?: 'fit-page') {
    cancelAnimationFrame(tween);
    if (pinch) end();
    const element = viewport();
    if (!element) return;
    const view = element.getBoundingClientRect();
    pinch = begin(view.left + view.width / 2, view.top + view.height / 2);
    const p = pinch;
    if (!p) return;
    const target = clamp(factor, minZoom / p.base, maxZoom / p.base);
    if (reduced.matches) {
      scaleTo(target);
      end(level);
      return;
    }
    const started = performance.now();
    const duration = 220;
    const step = (now: number) => {
      if (pinch !== p) return;
      // A frame's timestamp is when the frame began, which can be a moment
      // before the click that started this; clamp so it never runs backwards.
      const t = clamp((now - started) / duration, 0, 1);
      // Ease-out cubic: the zoom answers at once and settles softly.
      const eased = 1 - (1 - t) ** 3;
      p.k = 1 + (target - 1) * eased;
      paint();
      if (t < 1) tween = requestAnimationFrame(step);
      else end(level);
    };
    tween = requestAnimationFrame(step);
  }

  function fit() {
    const element = viewport();
    const sheet = element?.querySelector<HTMLElement>('.iv-page-sheet');
    if (!element || !sheet) return;
    // The scale at which the widest page fits both ways, from its size now.
    const box = sheet.getBoundingClientRect();
    const gap = zoom.gap();
    const scale = Math.min(
      (element.clientWidth - 2 * gap) / box.width,
      (element.clientHeight - 2 * gap) / box.height,
    );
    animateTo(scale, 'fit-page');
  }

  const preventDrag = (event: Event) => event.preventDefault();

  surface.addEventListener('pointerdown', onPointerDown);
  surface.addEventListener('pointermove', onPointerMove);
  surface.addEventListener('pointerup', markPanned);
  surface.addEventListener('pointercancel', onPointerUp);
  surface.addEventListener('click', onClick, true);
  surface.addEventListener('dragstart', preventDrag);
  surface.addEventListener('wheel', onWheel, { passive: false });
  surface.addEventListener('gesturestart', onGestureStart);
  surface.addEventListener('gesturechange', onGestureChange);
  surface.addEventListener('gestureend', onGestureEnd);
  return {
    zoomBy: (factor) => animateTo(factor),
    fit,
    detach: () => {
      stopGlide();
      cancelAnimationFrame(painted);
      cancelAnimationFrame(tween);
      clearTimeout(idle);
      clearTimeout(settleBand);
      cancelAnimationFrame(holding);
      surface.removeEventListener('pointerdown', onPointerDown);
      surface.removeEventListener('pointermove', onPointerMove);
      surface.removeEventListener('pointerup', markPanned);
      surface.removeEventListener('pointercancel', onPointerUp);
      surface.removeEventListener('click', onClick, true);
      surface.removeEventListener('dragstart', preventDrag);
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('gesturestart', onGestureStart);
      surface.removeEventListener('gesturechange', onGestureChange);
      surface.removeEventListener('gestureend', onGestureEnd);
    },
  };
}
