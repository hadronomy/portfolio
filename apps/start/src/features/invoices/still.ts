/**
 * A still is a canvas copy of the pages on screen, laid exactly over the
 * viewport. The viewer puts one up whenever what is underneath is about to
 * change in a way that would show: a new render after an edit, or the real
 * zoom landing after a pinch. The change happens behind it, and the still
 * fades away once the pages underneath have drawn.
 */

/** Page sheets that intersect the viewport, in document order. */
export function visibleSheets(viewport: Element) {
  const view = viewport.getBoundingClientRect();
  return [...viewport.querySelectorAll<HTMLElement>('.iv-page-sheet')].filter(
    (sheet) => {
      const box = sheet.getBoundingClientRect();
      return (
        box.bottom > view.top &&
        box.top < view.bottom &&
        box.right > view.left &&
        box.left < view.right
      );
    },
  );
}

/**
 * Paints what the viewport shows onto a canvas appended to `root`, which must
 * be positioned. Sheets are drawn at their on-screen rectangles, so a page
 * mid-transform is copied exactly as it looks.
 */
export function paintStill(root: HTMLElement) {
  const viewport = root.querySelector<HTMLElement>('.iv-pdf-viewport');
  if (!viewport) return null;
  const frame = root.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  const ratio = window.devicePixelRatio;
  const canvas = document.createElement('canvas');
  canvas.className = 'iv-pdf-still';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(view.width * ratio);
  canvas.height = Math.round(view.height * ratio);
  Object.assign(canvas.style, {
    left: `${view.left - frame.left}px`,
    top: `${view.top - frame.top}px`,
    width: `${view.width}px`,
    height: `${view.height}px`,
  });
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(ratio, ratio);
  const before = new Set<string>();
  for (const sheet of visibleSheets(viewport)) {
    const box = sheet.getBoundingClientRect();
    const x = box.left - view.left;
    const y = box.top - view.top;
    // Match the sheet's rounded corner at its current scale, or the square
    // corners of the page image would show while the still fades.
    const scale = box.width / sheet.offsetWidth || 1;
    const radius = 6 * scale;
    // The sheet's own shadow, the same recipe as .iv-page-sheet (keep them
    // in sync). Canvas shadowBlur and CSS blur radius share one definition
    // (a Gaussian with sigma = blur / 2), so with no spread the two match
    // and the page edge does not change when the still comes or goes.
    context.save();
    context.fillStyle = '#fff';
    for (const [offset, blur, alpha] of [
      [1, 3, 0.1],
      [12, 32, 0.22],
    ] as const) {
      context.shadowColor = `rgb(0 0 0 / ${alpha})`;
      context.shadowBlur = blur * scale;
      context.shadowOffsetY = offset * scale;
      context.beginPath();
      context.roundRect(x, y, box.width, box.height, radius);
      context.fill();
    }
    context.restore();
    // The 1px hairline ring sits just outside the sheet, like a box-shadow
    // with 1px spread: stroke half a pixel out.
    context.save();
    context.strokeStyle = 'rgb(0 0 0 / 0.06)';
    context.lineWidth = scale;
    context.beginPath();
    context.roundRect(
      x - scale / 2,
      y - scale / 2,
      box.width + scale,
      box.height + scale,
      radius + scale / 2,
    );
    context.stroke();
    context.restore();
    context.save();
    context.beginPath();
    context.roundRect(x, y, box.width, box.height, radius);
    context.clip();
    context.fillStyle = '#fff';
    context.fill();
    const image = sheet.querySelector('img');
    if (image?.complete && image.naturalWidth) {
      context.drawImage(image, x, y, box.width, box.height);
      before.add(image.src);
    }
    context.restore();
  }
  root.append(canvas);
  // Between the pages the still is transparent, and the live pages under it
  // may be mid-jump to their new place. Hiding them while covered keeps the
  // backdrop, not a flash of the wrong layout, in those gaps.
  root.dataset.covered = String(Number(root.dataset.covered ?? 0) + 1);
  return { canvas, before, root };
}

/**
 * Shows the live pages again and fades the still out over them; `onGone`
 * runs once it has left.
 */
export function fadeStill(
  still: { canvas: HTMLCanvasElement; root: HTMLElement },
  onGone = () => {},
) {
  const { canvas, root } = still;
  const count = Number(root.dataset.covered ?? 1) - 1;
  if (count > 0) root.dataset.covered = String(count);
  else delete root.dataset.covered;
  canvas.dataset.leaving = 'true';
  let done = false;
  const remove = () => {
    if (done) return;
    done = true;
    canvas.remove();
    onGone();
  };
  canvas.addEventListener('transitionend', remove, { once: true });
  // Reduced motion or a hidden tab can skip transitionend.
  window.setTimeout(remove, 400);
}
