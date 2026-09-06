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

import type { StatusLook } from '~/lib/status';

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

/*
  Three eye shapes: proportions, a lean, and how each end is rounded.

  A capsule that only ever scales can blink and it can look, and that is the
  whole of what it can say. Changing its proportions is what buys an
  expression.

  Leaning it does not. A straight stroke set at an angle is read as an
  *eyebrow*, and an eyebrow's angle has only two things to say: inner ends down
  is a furrow, inner ends up is a plea. Angry or sad, nothing else — which is
  why two attempts at a happy squint by tilting came out as both of those in
  turn. A pleased eye has to curve.

  So `happy` is a dome: wide, shallow, round on top and flat underneath, the
  shape a closed eye makes when someone smiles. `alert` is a circle. The lean
  survives in the model but sits at zero, because it is genuinely the right
  tool for a scowl and nothing here has earned one.

  Corners are given as an x and a y radius per end, both fractions of the eye's
  own box. That is more to carry than one roundness value, and it is the only
  way each shape can be exact: `50%` on a box twice as tall as it is wide draws
  an ellipse, not the capsule that a plain `999px` clamps to. Describing the
  two radii separately is what lets a capsule stay a capsule while a dome is
  free to be a dome.

  Every one of these is reached by something the visitor did. None is on a
  timer, because a face that performs moods at nobody is lying about having
  them.
*/
const EYES = {
  /* A capsule: every corner is a circle of half the width, so the long sides
     stay parallel. `ry` is that same radius written as a fraction of the
     height — (w / 2) / h — which is what keeps it circular rather than
     elliptical on a box this tall. */
  neutral: {
    w: 0.13,
    h: 0.3,
    tilt: 0,
    rxTop: 0.5,
    ryTop: 0.2167,
    rxBot: 0.5,
    ryBot: 0.2167,
  },
  /* A dome: the top corners are half the width across and the full height
     tall, which meets in the middle as one arc. The bottom is square. */
  happy: {
    w: 0.24,
    h: 0.13,
    tilt: 0,
    rxTop: 0.5,
    ryTop: 1,
    rxBot: 0,
    ryBot: 0,
  },
  /* A circle, on a box that is already square. */
  alert: {
    w: 0.19,
    h: 0.19,
    tilt: 0,
    rxTop: 0.5,
    ryTop: 0.5,
    rxBot: 0.5,
    ryBot: 0.5,
  },
} as const;

type Expression = keyof typeof EYES;

/** Expressions land quickly and hold; they are reactions, not transitions. */
const EXPR = {
  type: 'spring',
  stiffness: 520,
  damping: 26,
  mass: 0.7,
} as const;
/** How long a reaction holds before the face settles back. */
const HOLD_MS = { happy: 1400, alert: 700 } as const;

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
  eyeW,
  eyeH,
  tilt,
  rxTop,
  ryTop,
  rxBot,
  ryBot,
  side,
}: {
  nx: MotionValue<number>;
  ny: MotionValue<number>;
  size: MotionValue<number>;
  lid: MotionValue<number>;
  eyeW: MotionValue<number>;
  eyeH: MotionValue<number>;
  tilt: MotionValue<number>;
  rxTop: MotionValue<number>;
  ryTop: MotionValue<number>;
  rxBot: MotionValue<number>;
  ryBot: MotionValue<number>;
  side: -1 | 1;
}) {
  // The reference sets the eyes at ~9.5% of body width. Taken literally that is
  // 3.4px here and reads as grit, so the ratio opens up — small features need
  // optical over-sizing.
  const width = useTransform([size, eyeW], ([s, w]: number[]) => s * w);
  const height = useTransform([size, eyeH], ([s, h]: number[]) => s * h);

  const x = useTransform([nx, size, eyeW], ([v, s, w]: number[]) => {
    return (
      (s / 2) * 0.58 * Math.sin(v * MAX_YAW + side * EYE_ANGLE) - (s * w) / 2
    );
  });
  const y = useTransform([ny, size, eyeH], ([v, s, h]: number[]) => {
    return (s / 2) * 0.58 * Math.sin(v * MAX_PITCH) - (s * h) / 2;
  });
  const scaleX = useTransform(nx, (v) =>
    Math.max(0.18, Math.cos(v * MAX_YAW + side * EYE_ANGLE)),
  );
  /*
    Mirrored, and negated so that a positive tilt raises the *inner* ends of
    both marks — the pair arcs up like `^ ^`.

    Get the sign backwards and the inner ends drop into `\ /`, which is a
    furrowed brow. It is a real expression, just not this one: worth knowing
    that a negative tilt is a scowl already sitting here for free.
  */
  const rotate = useTransform(tilt, (t) => -t * side);

  /*
    Assembled each frame from plain numbers rather than animated as a string.
    Motion interpolates a border-radius by parsing it, and these shapes do not
    all parse alike — driving four radii as numbers and writing them out cannot
    go wrong that way.
  */
  const borderRadius = useTransform(
    [width, height, rxTop, ryTop, rxBot, ryBot],
    ([w, h, xt, yt, xb, yb]: number[]) => {
      const a = (w * xt).toFixed(2);
      const b = (w * xb).toFixed(2);
      const c = (h * yt).toFixed(2);
      const d = (h * yb).toFixed(2);
      return `${a}px ${a}px ${b}px ${b}px / ${c}px ${c}px ${d}px ${d}px`;
    },
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
        rotate,
        borderRadius,
        background: 'hsl(var(--background))',
      }}
    />
  );
}

interface Props {
  /** Appearance and claim for the status the dot reports. */
  look: StatusLook;
}

export default function Presence({ look }: Props) {
  const [enabled, setEnabled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [asleep, setAsleep] = React.useState(false);
  const [expression, setExpression] = React.useState<Expression>('neutral');

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

  /* The face. Shape rather than scale, so an eye can change what it means and
     not just how open it is. */
  const eyeW = useMotionValue<number>(EYES.neutral.w);
  const eyeH = useMotionValue<number>(EYES.neutral.h);
  const tilt = useMotionValue<number>(EYES.neutral.tilt);
  /* The body leans into a squint and rears back when startled — the reference's
     whole trick is that the body carries as much of the expression as the eyes. */
  const lean = useMotionValue<number>(0);
  const rxTop = useMotionValue<number>(EYES.neutral.rxTop);
  const ryTop = useMotionValue<number>(EYES.neutral.ryTop);
  const rxBot = useMotionValue<number>(EYES.neutral.rxBot);
  const ryBot = useMotionValue<number>(EYES.neutral.ryBot);

  /** The dot's centre in document space, so a scroll needs no re-measure. */
  const centre = React.useRef({ x: 0, y: 0 });
  const pointer = React.useRef({ x: 0, y: 0 });
  /** Last unit vector, kept to detect saccades. */
  const facing = React.useRef({ x: 0, y: 0 });
  const held = React.useRef(false);
  const idle = React.useRef(0);
  const lastMove = React.useRef(0);
  const mood = React.useRef(0);
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
    // Guarded on the ref rather than left to React's bail-out, so an unchanged
    // value costs a comparison instead of a dispatch into the scheduler.
    if (isOpen.current !== next) {
      isOpen.current = next;
      setOpen(next);
    }
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

  /*
    Arms one timer and lets it re-arm itself, rather than tearing one down and
    building another on every pointer event.

    Resetting the countdown per event costs a `clearTimeout` and a `setTimeout`
    each time — measured at 1.35us, which at 120Hz is the single most expensive
    thing this handler did. Recording when the pointer last moved is a number
    write. The timer wakes at the deadline, finds the pointer moved since, and
    re-arms for the remainder, so the dot still dozes exactly IDLE_MS after the
    last movement and nothing about when it happens changes.
  */
  const armIdle = React.useCallback(() => {
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(function tick() {
      const quiet = performance.now() - lastMove.current;
      if (quiet < IDLE_MS) {
        idle.current = window.setTimeout(tick, IDLE_MS - quiet);
        return;
      }
      // Cleared before `doze` runs, because `doze` declines when the dot is
      // closed. Leaving the handle set there would strand it: the next pointer
      // move would see a timer already armed and never arm a live one.
      idle.current = 0;
      doze();
    }, IDLE_MS);
  }, [doze]);

  const wake = React.useCallback(() => {
    lastMove.current = performance.now();
    if (!idle.current) armIdle();

    if (!isAsleep.current) return;
    isAsleep.current = false;
    setAsleep(false);

    animate(drowse, 1, WAKE);
    setExpression('alert');
    // A small gasp: it stretches up first, which is the shape of being
    // startled rather than of being pressed.
    animate(squashY, [1, 1.1, 0.97, 1], { duration: 0.36, ease: 'easeOut' });
    animate(squashX, [1, 0.93, 1.02, 1], { duration: 0.36, ease: 'easeOut' });
  }, [armIdle, drowse, squashX, squashY]);

  /*
    One place turns an expression into geometry, so a reaction is added by
    naming it rather than by animating four values at every call site.
  */
  React.useEffect(() => {
    if (!enabled) return;
    const shape = EYES[expression];
    animate(eyeW, shape.w, EXPR);
    animate(eyeH, shape.h, EXPR);
    animate(tilt, shape.tilt, EXPR);
    animate(rxTop, shape.rxTop, EXPR);
    animate(ryTop, shape.ryTop, EXPR);
    animate(rxBot, shape.rxBot, EXPR);
    animate(ryBot, shape.ryBot, EXPR);
    animate(
      lean,
      expression === 'happy' ? 5 : expression === 'alert' ? -3 : 0,
      EXPR,
    );

    if (expression === 'neutral') return;

    // Reactions lapse on their own. Nothing else has to remember to clear them.
    window.clearTimeout(mood.current);
    mood.current = window.setTimeout(
      () => setExpression('neutral'),
      HOLD_MS[expression],
    );
    return () => window.clearTimeout(mood.current);
  }, [enabled, expression, eyeW, eyeH, tilt, lean, rxTop, ryTop, rxBot, ryBot]);

  /*
    A status that is not present does not animate. `offline` leaves the dot the
    server drew and mounts nothing over it — the same path a touch device or a
    request for less motion already takes, so there is only one way to be
    still rather than two.
  */
  React.useEffect(() => {
    setEnabled(
      look.alive &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, [look.alive]);

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
      pointer.current.x = event.clientX;
      pointer.current.y = event.clientY;
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
      setExpression('happy');
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
          rotate: lean,
          borderRadius: '999px',
          background: look.dot,
          boxShadow: RING,
        }}
      >
        <motion.span className="absolute inset-0" style={{ opacity: eyes }}>
          <Eye
            nx={nx}
            ny={ny}
            size={size}
            lid={eyeLid}
            eyeW={eyeW}
            eyeH={eyeH}
            tilt={tilt}
            rxTop={rxTop}
            ryTop={ryTop}
            rxBot={rxBot}
            ryBot={ryBot}
            side={-1}
          />
          <Eye
            nx={nx}
            ny={ny}
            size={size}
            lid={eyeLid}
            eyeW={eyeW}
            eyeH={eyeH}
            tilt={tilt}
            rxTop={rxTop}
            ryTop={ryTop}
            rxBot={rxBot}
            ryBot={ryBot}
            side={1}
          />
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
      {look.label && (
        <span
          className="pointer-events-auto absolute inset-0 rounded-pill"
          data-cursor="label"
          data-cursor-label={look.label}
          /* The pointer tints its label to match whatever it is reporting, so
             a red status is never announced on a green pill. */
          data-cursor-tint={look.dot}
          data-cursor-active
        />
      )}
    </div>
  );
}
