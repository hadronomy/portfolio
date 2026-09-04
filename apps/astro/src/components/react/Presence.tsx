'use client';

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import * as React from 'react';

/*
  The presence dot, given somewhere to look.

  At rest it is the same 12px dot the server renders — same centre, same
  colour, same ring — so a visitor who never moves a pointer sees exactly the
  page they saw before. Inside 140px it opens and grows two eyes that follow
  the pointer.

  It answers the copy shortcut too, with a squash and a double blink. That
  keypress is offered two lines under the dot, in this same block, so the
  acknowledgement lands where the visitor is already looking.
*/

/** The existing accent, and the only hue on the page. */
const GREEN = 'rgb(22,191,94)';
/*
  The same edge `ring-2 ring-background` draws on the static dot, kept at every
  size rather than faded out as it opens — the void is what holds the dot off
  the avatar, and it reads as part of the object rather than as scaffolding for
  the small state.

  Passed as a constant string, never as a MotionValue. Motion interpolates
  box-shadow by parsing it, and a `var()` inside one does not survive that —
  the ring resolves to zero alpha and looks like it was never drawn.
*/
const RING = '0 0 0 2px hsl(var(--background))';

const REST = 12;
const OPEN = 36;
/** Pointer distance at which it opens. */
const RANGE = 140;

/** The solver every Cursor variant runs on, so the two morphs agree. */
const MORPH = { stiffness: 400, damping: 30, mass: 1 } as const;
/** Looser on purpose — an eye lags the thing it follows. */
const GAZE = { stiffness: 220, damping: 22, mass: 0.6 } as const;

/** Half the angular separation between the eyes, in radians. */
const EYE_ANGLE = 0.44;
const MAX_YAW = 0.62;
const MAX_PITCH = 0.46;
/** A gaze jump wider than this is a saccade, and real eyes blink on those. */
const SACCADE = 0.7;

/**
 * One eye, placed on the surface of a sphere rather than on a flat face.
 *
 * Screen position is `R·sin(angle)` and width is `cos(angle)`, which is what a
 * point on a turning ball does. That foreshortening is the whole illusion —
 * without it the two capsules only slide sideways and it never reads as a ball.
 *
 * Centring is folded into `x` and `y` rather than written as a `-50%`
 * translate, because Motion owns this element's `transform` and a translate
 * declared alongside `x` is dropped. Getting that wrong offsets each eye by
 * half its own size, which looks plausible enough to survive review.
 */
function Eye({
  nx,
  ny,
  size,
  lid,
  side,
}: {
  nx: MotionValue<number>;
  ny: MotionValue<number>;
  size: MotionValue<number>;
  lid: MotionValue<number>;
  side: -1 | 1;
}) {
  // The reference sets the eyes at ~9.5% of body width. Taken literally that is
  // 3.4px here and reads as grit, so the ratio opens up — small features need
  // optical over-sizing.
  const width = useTransform(size, (s) => s * 0.13);
  const height = useTransform(size, (s) => s * 0.3);

  const x = useTransform([nx, size], ([v, s]: number[]) => {
    return (
      (s / 2) * 0.58 * Math.sin(v * MAX_YAW + side * EYE_ANGLE) - (s * 0.13) / 2
    );
  });
  const y = useTransform([ny, size], ([v, s]: number[]) => {
    return (s / 2) * 0.58 * Math.sin(v * MAX_PITCH) - (s * 0.3) / 2;
  });
  const scaleX = useTransform(nx, (v) =>
    Math.max(0.18, Math.cos(v * MAX_YAW + side * EYE_ANGLE)),
  );

  return (
    <motion.span
      className="absolute top-1/2 left-1/2 block"
      style={{
        x,
        y,
        width,
        height,
        scaleX,
        scaleY: lid,
        borderRadius: '999px',
        background: 'hsl(var(--background))',
      }}
    />
  );
}

export default function Presence() {
  const [enabled, setEnabled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const anchor = React.useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const nx = useSpring(rawX, GAZE);
  const ny = useSpring(rawY, GAZE);
  const lid = useMotionValue(1);
  const size = useSpring(REST, MORPH);
  /* Squash rides on top of the size, so the nod composes with the morph
     instead of fighting it for the same property. */
  const squashX = useMotionValue(1);
  const squashY = useMotionValue(1);

  /** The dot's centre in document space, so a scroll needs no re-measure. */
  const centre = React.useRef({ x: 0, y: 0 });
  const pointer = React.useRef({ x: 0, y: 0 });
  /** Last unit vector, kept to detect saccades. */
  const facing = React.useRef({ x: 0, y: 0 });

  const blink = React.useCallback(
    async (times = 1) => {
      for (let i = 0; i < times; i += 1) {
        await animate(lid, [1, 0.06, 1], {
          duration: 0.2,
          ease: 'easeInOut',
        }).finished;
      }
    },
    [lid],
  );

  const measure = React.useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    centre.current = {
      x: box.left + box.width / 2 + window.scrollX,
      y: box.top + box.height / 2 + window.scrollY,
    };
  }, []);

  /*
    Runs on every pointer move, so it reads no layout. The centre is cached in
    document space and scroll is subtracted, which keeps a `getBoundingClientRect`
    out of the hot path — that call forces a synchronous layout, and at 120Hz it
    is the one thing here that would cost real frames.
  */
  const aim = React.useCallback(() => {
    const cx = centre.current.x - window.scrollX;
    const cy = centre.current.y - window.scrollY;

    const vx = pointer.current.x - cx;
    const vy = pointer.current.y - cy;
    const d = Math.hypot(vx, vy) || 1;
    const ux = vx / d;
    const uy = vy / d;

    rawX.set(ux);
    rawY.set(uy);

    if (Math.hypot(ux - facing.current.x, uy - facing.current.y) > SACCADE) {
      void blink();
    }
    facing.current = { x: ux, y: uy };

    const next = d < RANGE;
    setOpen((was) => (was === next ? was : next));
  }, [rawX, rawY, blink]);

  React.useEffect(() => {
    setEnabled(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  React.useEffect(() => {
    size.set(open ? OPEN : REST);
  }, [open, size]);

  React.useEffect(() => {
    if (!enabled) return;
    measure();

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.current = { x: event.clientX, y: event.clientY };
      aim();
    };
    const remeasure = () => {
      measure();
      aim();
    };

    document.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('resize', remeasure);
    document.addEventListener('astro:page-load', remeasure);

    return () => {
      document.removeEventListener('pointermove', move);
      window.removeEventListener('resize', remeasure);
      document.removeEventListener('astro:page-load', remeasure);
    };
  }, [enabled, aim, measure]);

  /*
    The nod that answers a copy. It squashes on one axis while it stretches on
    the other so the volume reads as constant — a dot that only got shorter
    would read as deflating rather than as a nod. Both curves land back on 1,
    so this leaves no state behind for the morph to fight with.
  */
  React.useEffect(() => {
    if (!enabled) return;

    const nod = () => {
      animate(squashY, [1, 0.72, 1.1, 1], { duration: 0.42, ease: 'easeOut' });
      animate(squashX, [1, 1.18, 0.94, 1], { duration: 0.42, ease: 'easeOut' });
      void blink(2);
    };

    document.addEventListener('email-copied', nod);
    return () => document.removeEventListener('email-copied', nod);
  }, [enabled, blink, squashX, squashY]);

  /*
    Only while the eyes are showing, and never while the tab is in the
    background. The interval is randomised because an even one is the single
    thing that makes a blink read as a machine rather than a face.
  */
  React.useEffect(() => {
    if (!enabled || !open) return;

    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (!document.hidden) void blink(Math.random() < 0.18 ? 2 : 1);
          schedule();
        },
        3500 + Math.random() * 3500,
      );
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, [enabled, open, blink]);

  /*
    The server-rendered dot stays in the markup and is hidden here rather than
    replaced, so the dot never depends on this island mounting. Unlike the
    cursor follower, this one is content.
  */
  React.useEffect(() => {
    if (!enabled) return;
    const real = document.getElementById('presence-dot');
    if (!real) return;

    real.style.opacity = '0';
    return () => {
      real.style.opacity = '';
    };
  }, [enabled]);

  const eyes = useTransform(size, [REST + 9, OPEN], [0, 1]);
  // Scaled by how far open it is, so a closed dot never leans. At rest it has
  // to sit exactly where the static dot sits.
  const openness = useTransform(size, [REST, OPEN], [0, 1]);
  const leanX = useTransform([nx, openness], ([v, o]: number[]) => v * 1.5 * o);
  const leanY = useTransform([ny, openness], ([v, o]: number[]) => v * 1.5 * o);

  if (!enabled) return null;

  return (
    /*
      A box the size of the open dot, centred on the static dot's own centre,
      so the body is centred by layout and `transform` stays free for the lean.

      It has to be a real 36px rather than a zero-size point: grid centring
      falls back to start alignment when the item is larger than its area, so a
      zero-size anchor silently pins the dot by its top-left corner and lands it
      6px off the dot it is meant to cover.
    */
    <div
      ref={anchor}
      aria-hidden="true"
      className="pointer-events-none absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center"
      style={{ left: 'calc(100% - 4px)', top: 'calc(100% - 4px)' }}
    >
      <motion.div
        className="relative"
        style={{
          width: size,
          height: size,
          x: leanX,
          y: leanY,
          scaleX: squashX,
          scaleY: squashY,
          borderRadius: '999px',
          background: GREEN,
          boxShadow: RING,
        }}
      >
        <motion.span className="absolute inset-0" style={{ opacity: eyes }}>
          <Eye nx={nx} ny={ny} size={size} lid={lid} side={-1} />
          <Eye nx={nx} ny={ny} size={size} lid={lid} side={1} />
        </motion.span>
      </motion.div>
    </div>
  );
}
