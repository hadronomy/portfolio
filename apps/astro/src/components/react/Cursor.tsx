'use client';

import { motion, useSpring } from 'motion/react';
import * as React from 'react';

/*
  A follower that trails the pointer and morphs over anything carrying a
  `data-cursor` attribute. Ported from Core's Elements/Cursor.

  Every number below is read off the Framer document rather than sampled from
  pixels. All five variants declare the same transition — `spring-physics
  400 30 1 0s` — which is Framer Motion's own spring at stiffness 400, damping
  30, mass 1. That is a damping ratio of 0.75: it reaches full size around
  200ms, drifts under 3% past it, and is back down by 430ms. The overshoot is
  four pixels on a 148px growth, so it never reads as a bounce — it reads as
  weight. No bezier has that tail, which is why this is a React island rather
  than a CSS transition.

  The native cursor stays. Core fills its dot at 15%/30% alpha, which reads as
  something travelling with the pointer rather than replacing it, and swapping
  a div for the real cursor bets against every pointer setting a visitor might
  depend on.
*/

type Variant = 'dot' | 'preview' | 'label';

const MORPH = { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const;

/*
  The follow is a separate, far stiffer spring. Critically damped at ω≈89 rad/s,
  it closes 98% of a jump inside four frames — the dot has to read as part of
  the pointer, not as something chasing it. A spring rather than a per-frame
  lerp because a lerp is tied to the display: the same constant runs twice as
  fast on a 120Hz panel.
*/
const FOLLOW = { stiffness: 8000, damping: 180, mass: 1, restDelta: 0.1 };

/* Link Preview: 164x104 of media inside 2px of padding. The pressed variant
   carries its own smaller media, so the card dips by about 4% under a click. */
const PREVIEW = { width: 168, height: 108 };
const PREVIEW_PRESSED = { width: 162, height: 104 };

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

  const size = isPreview
    ? pressed
      ? PREVIEW_PRESSED
      : PREVIEW
    : isLabel
      ? pill
      : { width: pressed ? 16 : 20, height: pressed ? 16 : 20 };

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[60]"
      style={{ x, y }}
      animate={{ opacity: away ? 0 : 1 }}
      transition={{ opacity: { duration: 0.16, ease: 'easeOut' } }}
    >
      {/* Half its own size back on both axes, so the box stays centred on the
          pointer at every point in the morph without any JS re-centring. */}
      <motion.div
        className={`flex items-center justify-center overflow-hidden backdrop-blur-[10px] transition-colors duration-200 ${
          isLabel ? 'bg-[rgba(22,191,94,0.08)]' : 'bg-cursor'
        }`}
        style={{ translate: '-50% -50%' }}
        animate={{
          ...size,
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
          className="type-body-xs absolute inset-0 flex items-center justify-center gap-1.5 px-1.5 py-0.5 whitespace-nowrap text-foreground"
          animate={{ opacity: isLabel ? 1 : 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        >
          {label.active && (
            <span className="size-2.5 shrink-0 rounded-pill bg-[rgb(22,191,94)]" />
          )}
          {label.text}
        </motion.span>
      </motion.div>

      <span
        ref={ghost}
        aria-hidden="true"
        className="type-body-xs pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1.5 px-1.5 py-0.5 whitespace-nowrap"
      >
        {label.active && <span className="size-2.5 shrink-0" />}
        {label.text}
      </span>
    </motion.div>
  );
}
