'use client';

import { motion, useSpring } from 'motion/react';
import * as React from 'react';

/*
  The pointer. Not a follower any more — this replaces the native cursor, so
  the native one is hidden for as long as this is on screen.

  That is a real trade and it is made deliberately. A translucent dot beside
  the system arrow could afford to leave the arrow alone; an arrow that *is*
  the arrow cannot, or there are two. The cost is that OS cursor settings —
  size, contrast, trails — stop applying. It is bought back by only ever
  hiding the native cursor from script, and only once this component has
  decided it will render: no JavaScript, a coarse pointer, or reduced motion
  and the system cursor is untouched.

  Every variant shares one spring — stiffness 400, damping 30, mass 1. That is
  a damping ratio of 0.75: it reaches full size around 200ms, drifts under 3%
  past it, and is back down by 430ms. The overshoot is small relative to the
  growth, so it never reads as a bounce — it reads as weight.
*/

type Variant = 'dot' | 'preview' | 'label';

const MORPH = { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const;

/*
  The follow is a separate, far stiffer spring. Critically damped at ω≈89 rad/s,
  it closes 98% of a jump inside four frames — the arrow has to read as the
  pointer, not as something chasing it. A spring rather than a per-frame lerp
  because a lerp is tied to the display: the same constant runs twice as fast
  on a 120Hz panel.
*/
const FOLLOW = { stiffness: 8000, damping: 180, mass: 1, restDelta: 0.1 };

/*
  The macOS arrow, traced from the system asset rather than drawn by eye.
  Source: github.com/daviddarnes/mac-cursors, `src/svg/default.svg`, which
  ships it as two filled paths — a white outline and the black body inside it.
  Both are reproduced here verbatim, translated so the tip is (0,0).

  (0,0) is the hotspot: the point the system considers "where you are
  clicking". Every other shape here is positioned against the pointer instead,
  which is what a card wants and a cursor does not.

  Worth knowing, because the internet will tell you otherwise: the macOS arrow
  has a *vertical* left edge, and its tail ends in a bevel rather than a point.
  It is 11.4 by 18.1, which is smaller than it looks — an arrow guessed at from
  memory comes out wider, taller and sharper than the real one.
*/
const ARROW_OUTER =
  'M0 0 L0 16.015 L3.316 12.794 L6.137 18.066 L8 17.063 L9.615 16.224 L7.047 11.408 L11.379 11.408 Z';
const ARROW_INNER =
  'M0.989 2.407 L0.989 13.595 L3.519 11.153 L6.42 16.593 L8.185 15.652 L5.41 10.45 L9.014 10.45 Z';
const ARROW_BOX = { width: 11.379, height: 18.066 };

/* Link Preview: 164x104 of media inside 2px of padding. The pressed variant
   carries its own smaller media, so the card dips by about 4% under a click. */
const PREVIEW = { width: 168, height: 108 };
const PREVIEW_PRESSED = { width: 162, height: 104 };

/* Where the card starts from and returns to. Small enough to read as growing
   out of the arrow's tip rather than fading in at size. */
const SEED = { width: 14, height: 14 };

export default function Cursor() {
  // Nothing is rendered on the server, or on a device that cannot hover, or for
  // a visitor who asked for less motion.
  const [enabled, setEnabled] = React.useState(false);
  const [variant, setVariant] = React.useState<Variant>('dot');
  const [pressed, setPressed] = React.useState(false);
  const [away, setAway] = React.useState(true);
  const [src, setSrc] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState({ text: '', active: false });
  const [pill, setPill] = React.useState({ width: 20, height: 20 });

  const ghost = React.useRef<HTMLSpanElement>(null);
  const placed = React.useRef(false);

  const x = useSpring(0, FOLLOW);
  const y = useSpring(0, FOLLOW);

  React.useEffect(() => {
    setEnabled(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  /*
    Hidden from script rather than from the stylesheet, and only once this
    component has committed to rendering. A page that never runs this — no
    JavaScript, a touch device, reduced motion — keeps the system cursor it
    has always had.
  */
  React.useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;

    /*
      Re-applied after a view transition as well as on mount. A swap replaces
      the `html` element's attributes with the incoming document's, and those
      come from the static build with no class on them — the same thing that
      once lost the theme on every client-side navigation. Without this the
      system cursor comes back mid-session and there are two again.
    */
    const hide = () => root.classList.add('cursor-hidden');

    hide();
    document.addEventListener('astro:after-swap', hide);

    return () => {
      document.removeEventListener('astro:after-swap', hide);
      root.classList.remove('cursor-hidden');
    };
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      if (!placed.current) {
        // Land on the pointer instead of flying in from the corner.
        placed.current = true;
        x.jump(event.clientX);
        y.jump(event.clientY);
        setAway(false);
      } else {
        x.set(event.clientX);
        y.set(event.clientY);
        setAway((wasAway) => (wasAway ? false : wasAway));
      }
    };

    const over = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(
        '[data-cursor]',
      );

      if (!target) return setVariant('dot');

      const kind = target.getAttribute('data-cursor');
      const preview = target.getAttribute('data-cursor-src');

      if (kind === 'preview' && preview) {
        setSrc(preview);
        return setVariant('preview');
      }

      if (kind === 'label') {
        setLabel({
          text: target.getAttribute('data-cursor-label') ?? '',
          active: target.hasAttribute('data-cursor-active'),
        });
        return setVariant('label');
      }

      setVariant('dot');
    };

    // The press gesture rides on pointerdown/up rather than :active, so it
    // still reads when the press lands on something that is not a control.
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setPressed(true);
    };
    const up = () => setPressed(false);

    // Leaving the window fades the follower but keeps its position, so coming
    // back does not send it flying in from wherever it was parked.
    const leave = () => {
      setAway(true);
      setPressed(false);
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', up, { passive: true });
    document.addEventListener('pointerleave', leave, { passive: true });

    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('pointerleave', leave);
    };
  }, [enabled, x, y]);

  // The pill is sized by its own text, and Motion needs a number to spring
  // towards, so the copy is laid out once in a hidden twin and measured.
  React.useLayoutEffect(() => {
    const el = ghost.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setPill({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
  }, [label, enabled]);

  if (!enabled) return null;

  const isPreview = variant === 'preview';
  const isLabel = variant === 'label';
  const isArrow = variant === 'dot';

  const size = isPreview
    ? pressed
      ? PREVIEW_PRESSED
      : PREVIEW
    : isLabel
      ? pill
      : SEED;

  /*
    Where the card sits relative to the tip, in px on both axes so the two
    positions interpolate — a percentage and a number do not.

    A preview is centred on the pointer, the way it always was. A label is not:
    it is describing the thing under the pointer, and a pill centred on the tip
    covers exactly what you are pointing at. Offsetting it clear of the arrow
    is what lets you read the label and see the dot at the same time.
  */
  const offset = isPreview
    ? { x: -size.width / 2, y: -size.height / 2 }
    : isLabel
      ? { x: 16, y: 12 }
      : { x: -SEED.width / 2, y: -SEED.height / 2 };

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[60]"
      style={{ x, y }}
      animate={{ opacity: away ? 0 : 1 }}
      transition={{ opacity: { duration: 0.16, ease: 'easeOut' } }}
    >
      {/*
        What the pointer opens: a preview centred on the tip, or a label beside
        it. Both grow out of a seed the size of the arrow's shoulder, so the
        card reads as unfolding from the pointer rather than fading in at size.

        Drawn before the arrow so the arrow stays on top of it.
      */}
      <motion.div
        className={`absolute top-0 left-0 flex items-center justify-center overflow-hidden backdrop-blur-[10px] ${
          isLabel ? 'cursor-pill' : 'bg-cursor'
        }`}
        animate={{
          ...size,
          ...offset,
          opacity: isArrow ? 0 : 1,
          borderRadius: isPreview ? 10 : 16,
          padding: isPreview ? 2 : 0,
        }}
        transition={MORPH}
      >
        {/* Sized to the box rather than fixed, so the picture grows with the
            card instead of popping in at full size once the morph finishes. */}
        {src && (
          <motion.img
            src={src}
            alt=""
            className="h-full w-full rounded-[9px] object-cover"
            animate={{ opacity: isPreview ? 1 : 0 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          />
        )}

        <motion.span
          className="type-body-xs absolute inset-0 flex items-center justify-center gap-1.5 px-2.5 py-1 whitespace-nowrap text-foreground"
          animate={{ opacity: isLabel ? 1 : 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        >
          {label.active && (
            <span className="size-2 shrink-0 rounded-pill bg-[rgb(22,191,94)]" />
          )}
          {label.text}
        </motion.span>
      </motion.div>

      {/*
        The arrow, anchored by its tip rather than centred, because a pointer's
        hotspot is its point — centring it would put the click half a glyph
        from where it looks like it lands.

        It never leaves. It used to fade out when the follower morphed, which
        was fine while the system cursor was still underneath it; now that this
        *is* the cursor, fading it out would leave a visitor pointing at a link
        with nothing on screen telling them where.
      */}
      <motion.div
        className="bg-cursor absolute top-0 left-0"
        style={{
          width: ARROW_BOX.width,
          height: ARROW_BOX.height,
          clipPath: `path('${ARROW_OUTER}')`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transformOrigin: '0 0',
        }}
        animate={{ scale: pressed ? 0.88 : 1 }}
        transition={MORPH}
      >
        {/*
          The whole arrow is the material the dot was: one translucent tint over
          a blurred backdrop, themed by the same token. What the system draws as
          a white outline around a black body is here the plain material around
          a darkened core — the same relationship, in the page's own glass,
          rather than two opaque colours pasted on top of it.

          The core is a black tint in both themes because "darker" only means
          one thing. Lightening it in dark mode would read as *lighter* than the
          surround, since it composites over the tint rather than replacing it.
        */}
        <svg
          width={ARROW_BOX.width}
          height={ARROW_BOX.height}
          viewBox={`0 0 ${ARROW_BOX.width} ${ARROW_BOX.height}`}
          className="block"
          aria-hidden="true"
          focusable="false"
        >
          <path d={ARROW_INNER} fill="hsl(var(--cursor-core))" />
        </svg>
      </motion.div>

      <span
        ref={ghost}
        aria-hidden="true"
        className="type-body-xs pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1.5 px-2.5 py-1 whitespace-nowrap"
      >
        {label.active && <span className="size-2 shrink-0" />}
        {label.text}
      </span>
    </motion.div>
  );
}
