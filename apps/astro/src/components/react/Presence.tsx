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

  Left alone for twenty seconds it dozes: lids down, eyes lowered, body settled
  by a hair. Any movement wakes it with a gasp. Pressing it squashes it wide
  and short, the way a soft thing gives under a finger. Neither is a control —
  the dot never takes pointer events, and the press is hit-tested against its
  own radius so it cannot swallow a click meant for anything underneath.
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
/** Going down under a press is the system responding, so it is quick and flat. */
const PRESS = { type: 'spring', stiffness: 700, damping: 30 } as const;
/** Coming back is the material, so it is allowed to overshoot. */
const RELEASE = { type: 'spring', stiffness: 500, damping: 14 } as const;
/*
  Opening the lids again. Softer than RELEASE on purpose: RELEASE overshoots
  about 35%, which is a good pop across the 0.16 a press travels and a bad one
  across the 0.78 a lid does — it lands the eyes 27% oversized and reads as
  alarm rather than as waking up. This overshoots nearer 13%.
*/
const WAKE = { type: 'spring', stiffness: 500, damping: 24 } as const;

/** Pointer still for this long and it dozes. */
const IDLE_MS = 20000;
/** Lid openness while dozing. Lidded, never shut — shut only reads as a blink. */
const DROWSE = 0.22;

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

interface Props {
  /** What the dot claims, shown in the pointer on hover. Empty means silent. */
  status?: string;
}

export default function Presence({ status }: Props) {
  const [enabled, setEnabled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [asleep, setAsleep] = React.useState(false);

  const anchor = React.useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const nx = useSpring(rawX, GAZE);
  const ny = useSpring(rawY, GAZE);
  const lid = useMotionValue(1);
  const size = useSpring(REST, MORPH);
  /*
    Three things want to scale this body: the nod that answers a copy, the
    press, and the size morph. They are separate values multiplied together at
    the end rather than one shared value, so a press part-way through a nod
    composes with it instead of cutting it off.
  */
  const squashX = useMotionValue(1);
  const squashY = useMotionValue(1);
  const pressX = useMotionValue(1);
  const pressY = useMotionValue(1);
  /** Lid multiplier for the doze, so blinking and dozing do not fight. */
  const drowse = useMotionValue(1);

  /** The dot's centre in document space, so a scroll needs no re-measure. */
  const centre = React.useRef({ x: 0, y: 0 });
  const pointer = React.useRef({ x: 0, y: 0 });
  /** Last unit vector, kept to detect saccades. */
  const facing = React.useRef({ x: 0, y: 0 });
  const held = React.useRef(false);
  const idle = React.useRef(0);
  /* State the document listeners need to read. They are registered once, so a
     closure over `open` and `asleep` would go stale on the first change. */
  const isOpen = React.useRef(false);
  const isAsleep = React.useRef(false);

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
    isOpen.current = next;
    setOpen((was) => (was === next ? was : next));
  }, [rawX, rawY, blink]);

  /*
    Dozing is an expression of the face, never of the status. A closed dot is
    still reporting that someone is here, and dimming or shrinking it would say
    the opposite — so this only runs while the eyes are showing, and does
    nothing at all when the dot is at rest.
  */
  const doze = React.useCallback(() => {
    if (!isOpen.current || document.hidden) return;
    isAsleep.current = true;
    setAsleep(true);
    animate(drowse, DROWSE, { duration: 0.7, ease: 'easeInOut' });
    // Eyes settle downwards. The pointer is not moving, so nothing re-aims
    // over the top of this until the visitor comes back.
    rawY.set(Math.max(rawY.get(), 0.5));
  }, [drowse, rawY]);

  const wake = React.useCallback(() => {
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(doze, IDLE_MS);

    if (!isAsleep.current) return;
    isAsleep.current = false;
    setAsleep(false);

    animate(drowse, 1, WAKE);
    // A small gasp: it stretches up first, which is the shape of being
    // startled rather than of being pressed.
    animate(squashY, [1, 1.1, 0.97, 1], { duration: 0.36, ease: 'easeOut' });
    animate(squashX, [1, 0.93, 1.02, 1], { duration: 0.36, ease: 'easeOut' });
  }, [doze, drowse, squashX, squashY]);

  React.useEffect(() => {
    setEnabled(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  // Dozing settles it by a hair as well as lowering the lids. A body that only
  // half-shut its eyes reads as a stare, not as sleep.
  React.useEffect(() => {
    size.set(asleep ? OPEN * 0.94 : open ? OPEN : REST);
  }, [open, asleep, size]);

  React.useEffect(() => {
    if (!enabled) return;
    measure();

    /* Hit-tested against the dot's own radius rather than by making the
       element clickable. It stays `pointer-events: none`, so it never takes a
       click from anything underneath and never asks to be treated as a
       control — it is a thing that reacts to being poked, not a button. */
    const overDot = (x: number, y: number) => {
      const cx = centre.current.x - window.scrollX;
      const cy = centre.current.y - window.scrollY;
      return Math.hypot(x - cx, y - cy) <= size.get() / 2;
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.current = { x: event.clientX, y: event.clientY };
      aim();
      wake();
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      wake();
      if (!overDot(event.clientX, event.clientY)) return;

      held.current = true;
      animate(pressX, 1.16, PRESS);
      animate(pressY, 0.82, PRESS);
    };

    // Released anywhere, not only over the dot: a press that ends off the
    // element still ends, and leaving it squashed would strand it.
    const up = () => {
      if (!held.current) return;
      held.current = false;
      animate(pressX, 1, RELEASE);
      animate(pressY, 1, RELEASE);
    };

    const remeasure = () => {
      measure();
      aim();
    };

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', up, { passive: true });
    window.addEventListener('resize', remeasure);
    document.addEventListener('astro:page-load', remeasure);

    return () => {
      window.clearTimeout(idle.current);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      window.removeEventListener('resize', remeasure);
      document.removeEventListener('astro:page-load', remeasure);
    };
  }, [enabled, aim, measure, wake, size, pressX, pressY]);

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
    if (!enabled || !open || asleep) return;

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
  }, [enabled, open, asleep, blink]);

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

  const scaleX = useTransform([squashX, pressX], ([s, p]: number[]) => s * p);
  const scaleY = useTransform([squashY, pressY], ([s, p]: number[]) => s * p);
  const eyeLid = useTransform([lid, drowse], ([l, d]: number[]) => l * d);

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
          scaleX,
          scaleY,
          borderRadius: '999px',
          background: GREEN,
          boxShadow: RING,
        }}
      >
        <motion.span className="absolute inset-0" style={{ opacity: eyes }}>
          <Eye nx={nx} ny={ny} size={size} lid={eyeLid} side={-1} />
          <Eye nx={nx} ny={ny} size={size} lid={eyeLid} side={1} />
        </motion.span>
      </motion.div>

      {/*
        What the pointer reads to know it is over the dot. It has to be a real
        element taking real pointer events, because the pointer decides its
        shape from the event's target — and everything else in here is
        `pointer-events: none` so that it can never take a click from the page
        underneath.

        Sized to the open dot rather than the resting one: by the time a
        pointer is close enough to be over this, the dot has already opened to
        meet it.
      */}
      {status && (
        <span
          className="pointer-events-auto absolute inset-0 rounded-pill"
          data-cursor="label"
          data-cursor-label={status}
          data-cursor-active
        />
      )}
    </div>
  );
}
