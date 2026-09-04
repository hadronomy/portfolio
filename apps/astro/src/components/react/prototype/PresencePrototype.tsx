'use client';

/*
  PROTOTYPE — throwaway. Delete this directory once a variant wins.

  Three structurally different answers to "what should the presence dot
  become". They are mounted on the real homepage rather than a scratch page,
  because every one of them looks fine in a vacuum and the only useful test is
  against the real avatar, the real column and both real themes.

    A  Face  — opens to 36px, two capsule eyes projected onto a sphere
    B  Body  — never opens, never grows, expresses through lean and squash
    C  Eye   — becomes one eye with a moving pupil, and blinks by closing whole

  Opt in with ?variant=A|B|C. Without the param the real static dot is left
  alone, so the page a visitor sees is unchanged. The whole module is gated on
  import.meta.env.DEV, so a stray merge cannot ship it.
*/

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import * as React from 'react';

/** The one hue on the page. No variant is allowed to introduce another. */
const GREEN = 'rgb(22,191,94)';
const RING = '0 0 0 2px hsl(var(--background))';

/** The solver every Cursor variant already runs on. */
const MORPH = { stiffness: 400, damping: 30, mass: 1 } as const;
/** Gaze is looser on purpose — an eye lags the thing it follows. */
const GAZE = { stiffness: 220, damping: 22, mass: 0.6 } as const;

const REST = 12;

// ── Shared pointer state ────────────────────────────────────────────────────

interface Gaze {
  /** Unit vector from the dot towards the pointer, spring-smoothed. */
  nx: MotionValue<number>;
  ny: MotionValue<number>;
  /** Raw distance in px. Not smoothed — it only gates thresholds. */
  distance: React.RefObject<number>;
  near: boolean;
  /** Increments on every large gaze jump. Real eyes blink on saccades. */
  saccade: number;
}

function useGaze(
  ref: React.RefObject<HTMLDivElement | null>,
  range: number,
): Gaze {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const nx = useSpring(rawX, GAZE);
  const ny = useSpring(rawY, GAZE);

  const distance = React.useRef(Number.POSITIVE_INFINITY);
  const previous = React.useRef({ x: 0, y: 0 });
  const [near, setNear] = React.useState(false);
  const [saccade, setSaccade] = React.useState(0);

  React.useEffect(() => {
    const move = (event: PointerEvent) => {
      const el = ref.current;
      if (!el || event.pointerType !== 'mouse') return;

      const box = el.getBoundingClientRect();
      const vx = event.clientX - (box.left + box.width / 2);
      const vy = event.clientY - (box.top + box.height / 2);
      const d = Math.hypot(vx, vy) || 1;

      const ux = vx / d;
      const uy = vy / d;

      distance.current = d;
      rawX.set(ux);
      rawY.set(uy);
      setNear(d < range);

      if (Math.hypot(ux - previous.current.x, uy - previous.current.y) > 0.7) {
        setSaccade((n) => n + 1);
      }
      previous.current = { x: ux, y: uy };
    };

    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, [ref, rawX, rawY, range]);

  return { nx, ny, distance, near, saccade };
}

/**
 * Lid openness, 1 open and ~0 shut.
 *
 * The schedule is randomised rather than fixed, because an even interval is
 * the single thing that makes a blink read as a machine rather than a face.
 */
function useBlink(saccade: number) {
  const lid = useMotionValue(1);

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

  React.useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          void blink(Math.random() < 0.18 ? 2 : 1);
          schedule();
        },
        3500 + Math.random() * 3500,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [blink]);

  React.useEffect(() => {
    if (saccade === 0) return;
    void blink();
  }, [saccade, blink]);

  return lid;
}

// ── A — Face ────────────────────────────────────────────────────────────────

const OPEN_A = 36;
/** Half the angular separation between the eyes, in radians. */
const EYE_ANGLE = 0.44;
const MAX_YAW = 0.62;
const MAX_PITCH = 0.46;

/**
 * One eye, placed on the surface of a sphere rather than on a flat face.
 *
 * The eye's screen position is `R·sin(angle)` and its width is `cos(angle)`,
 * which is what a point on a turning ball actually does. That foreshortening
 * is the whole reason a flat circle reads as a sphere here — without it the
 * two capsules just slide sideways and the illusion never arrives.
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
  const x = useTransform([nx, size] as const, ([v, s]: number[]) => {
    return (s / 2) * 0.58 * Math.sin(v * MAX_YAW + side * EYE_ANGLE);
  });
  const y = useTransform([ny, size] as const, ([v, s]: number[]) => {
    return (s / 2) * 0.58 * Math.sin(v * MAX_PITCH);
  });
  const scaleX = useTransform(nx, (v) =>
    Math.max(0.18, Math.cos(v * MAX_YAW + side * EYE_ANGLE)),
  );

  // The reference sets the eyes at ~9.5% of body width. Copied literally that
  // is 3.4px here and reads as dirt, so the ratio is opened up — small
  // features always need over-sizing.
  const width = useTransform(size, (s) => s * 0.13);
  const height = useTransform(size, (s) => s * 0.3);

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
        translateX: '-50%',
        translateY: '-50%',
        borderRadius: '999px',
        background: 'hsl(var(--background))',
      }}
    />
  );
}

function VariantA({
  anchor,
}: {
  anchor: React.RefObject<HTMLDivElement | null>;
}) {
  const { nx, ny, near, saccade } = useGaze(anchor, 140);
  const lid = useBlink(saccade);

  const size = useSpring(REST, MORPH);
  React.useEffect(() => {
    size.set(near ? OPEN_A : REST);
  }, [near, size]);

  const eyes = useTransform(size, [REST + 9, OPEN_A], [0, 1]);
  // Leans towards the pointer rather than away. Looking at something is a
  // move in, not a flinch.
  const leanX = useTransform(nx, (v) => v * 1.5);
  const leanY = useTransform(ny, (v) => v * 1.5);

  return (
    <motion.div
      className="relative"
      style={{
        width: size,
        height: size,
        x: leanX,
        y: leanY,
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
  );
}

// ── B — Body ────────────────────────────────────────────────────────────────

/**
 * Never opens, never grows, never grows a face. It stays a 12px status dot and
 * says everything with lean and squash.
 *
 * This is the restrained position, and the one that most obviously keeps
 * DESIGN.md's "no second focal object" rule. There is no idle animation at
 * all — it is inert until a pointer moves.
 */
function VariantB({
  anchor,
}: {
  anchor: React.RefObject<HTMLDivElement | null>;
}) {
  const { nx, ny, distance } = useGaze(anchor, 140);

  const shy = useMotionValue(1);
  React.useEffect(() => {
    const id = window.setInterval(() => {
      // Pull back a little when the pointer crowds it.
      shy.set(distance.current < 44 ? -0.45 : 1);
    }, 80);
    return () => window.clearInterval(id);
  }, [distance, shy]);

  const shySpring = useSpring(shy, MORPH);

  const x = useTransform(
    [nx, shySpring] as const,
    ([v, s]: number[]) => v * 2.4 * s,
  );
  const y = useTransform(
    [ny, shySpring] as const,
    ([v, s]: number[]) => v * 2.4 * s,
  );

  // Stretches along the axis it reaches on, and thins on the other, so the
  // volume reads as constant instead of the dot simply getting bigger.
  const scaleX = useTransform(
    [nx, ny] as const,
    ([hx, hy]: number[]) => 1 + 0.12 * Math.abs(hx) - 0.06 * Math.abs(hy),
  );
  const scaleY = useTransform(
    [nx, ny] as const,
    ([hx, hy]: number[]) => 1 + 0.12 * Math.abs(hy) - 0.06 * Math.abs(hx),
  );

  return (
    <motion.div
      style={{
        width: REST,
        height: REST,
        x,
        y,
        scaleX,
        scaleY,
        borderRadius: '999px',
        background: GREEN,
        boxShadow: RING,
      }}
    />
  );
}

// ── C — Eye ─────────────────────────────────────────────────────────────────

const OPEN_C = 22;

/**
 * One eye rather than a face. The dot is the sclera, a background-coloured
 * pupil moves inside it, and the blink closes the whole body vertically
 * because here the body *is* the eye.
 */
function VariantC({
  anchor,
}: {
  anchor: React.RefObject<HTMLDivElement | null>;
}) {
  const { nx, ny, near, saccade } = useGaze(anchor, 140);
  const lid = useBlink(saccade);

  const size = useSpring(REST, MORPH);
  React.useEffect(() => {
    size.set(near ? OPEN_C : REST);
  }, [near, size]);

  const pupilSize = useTransform(size, (s) => s * 0.4);
  const travel = useTransform(size, (s) => s * 0.5 - s * 0.2 - 2);

  const x = useTransform([nx, travel] as const, ([v, t]: number[]) => v * t);
  const y = useTransform([ny, travel] as const, ([v, t]: number[]) => v * t);
  const pupil = useTransform(size, [REST + 4, OPEN_C], [0, 1]);

  return (
    <motion.div
      className="relative"
      style={{
        width: size,
        height: size,
        scaleY: lid,
        borderRadius: '999px',
        background: GREEN,
        boxShadow: RING,
      }}
    >
      <motion.span
        className="absolute top-1/2 left-1/2 block"
        style={{
          x,
          y,
          width: pupilSize,
          height: pupilSize,
          opacity: pupil,
          translateX: '-50%',
          translateY: '-50%',
          borderRadius: '999px',
          background: 'hsl(var(--background))',
        }}
      />
    </motion.div>
  );
}

// ── Switcher ────────────────────────────────────────────────────────────────

const VARIANTS = ['A', 'B', 'C'] as const;
type Variant = (typeof VARIANTS)[number];

const NAMES: Record<Variant, string> = {
  A: 'Face — opens, two eyes, sphere projection',
  B: 'Body — never opens, lean and squash only',
  C: 'Eye — one pupil, closes whole to blink',
};

function Switcher({
  current,
  onPick,
}: {
  current: Variant;
  onPick: (next: Variant) => void;
}) {
  const step = React.useCallback(
    (delta: number) => {
      const index = VARIANTS.indexOf(current);
      onPick(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length]);
    },
    [current, onPick],
  );

  React.useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [step]);

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black px-1.5 py-1.5 font-mono text-[12px] text-white shadow-2xl">
      <button
        type="button"
        onClick={() => step(-1)}
        className="grid size-7 place-items-center rounded-full hover:bg-white/15"
        aria-label="Previous variant"
      >
        ←
      </button>
      <span className="px-2 whitespace-nowrap">
        {current} · {NAMES[current]}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        className="grid size-7 place-items-center rounded-full hover:bg-white/15"
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────

function readVariant(): Variant | null {
  const raw = new URLSearchParams(window.location.search)
    .get('variant')
    ?.toUpperCase();
  return VARIANTS.includes(raw as Variant) ? (raw as Variant) : null;
}

export default function PresencePrototype() {
  const anchor = React.useRef<HTMLDivElement>(null);
  const [variant, setVariant] = React.useState<Variant | null>(null);
  const [ready, setReady] = React.useState(false);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    setVariant(readVariant());
    setReady(true);
  }, []);

  // The real dot stays in the HTML for no-JS and for the default page. A
  // variant hides it rather than replacing it, so nothing is ever gated on
  // this island mounting.
  React.useEffect(() => {
    const real = document.getElementById('presence-static');
    if (real) real.style.opacity = variant ? '0' : '';
  }, [variant]);

  const pick = (next: Variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', url);
    setVariant(next);
  };

  if (!import.meta.env.DEV || !ready || !variant || reduced) return null;

  return (
    <>
      {/* Anchored to the same centre the static dot sits on, so every variant
          grows about that point instead of shifting the corner. */}
      <div
        ref={anchor}
        className="pointer-events-none absolute grid place-items-center"
        style={{
          left: 'calc(100% - 4px)',
          top: 'calc(100% - 4px)',
          width: 0,
          height: 0,
        }}
      >
        {variant === 'A' && <VariantA anchor={anchor} />}
        {variant === 'B' && <VariantB anchor={anchor} />}
        {variant === 'C' && <VariantC anchor={anchor} />}
      </div>

      <Switcher current={variant} onPick={pick} />
    </>
  );
}
