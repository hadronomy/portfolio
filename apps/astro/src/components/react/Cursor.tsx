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
  The outline settles roughly three times faster than the box it bounds.

  The arrow is concave — it has a notch between its heel and its tail — and the
  card is not. Interpolating one into the other keeps the notch open for most
  of the journey, so at the same rate as the growth you spend the middle of the
  morph looking at a large torn banner. Resolving the outline while the box is
  still small means the notch closes at a few pixels across, where it cannot be
  read, and what actually grows is already a rounded card.

  It works the same in reverse: the outline becomes an arrow early and the box
  shrinks to meet it, which reads as the card folding down into a pointer.
*/
const OUTLINE = { type: 'spring', stiffness: 1200, damping: 44 } as const;

/*
  The two halves are sequenced rather than overlapped, which is what keeps the
  in-betweens clean.

  Run together, the outline is still part-way through resolving while the box
  has already grown, so somewhere around 60ms there is a frame of a
  half-unfolded arrow at four times its size — small, brief, and the one ugly
  thing left in the morph. Letting the outline finish at cursor size first means
  the shape that grows is always a plain rounded rectangle, and the arrow's
  notch closes at 11px across where there is nothing to see.

  So: out, the outline goes first and the growth waits for it. Back, the box
  shrinks first and the outline waits — a card collapses to a small rounded
  thing, and only then does it become a pointer again. The delays are short
  enough that the whole move still lands inside the time it took before.
*/
const HOLD = 0.055;
/*
  Longer coming back than going out, because the box has much further to fall
  than it had to climb before the outline matters. Held at 55ms the shape was
  still 78px wide when it started growing a notch again — the same torn frame
  the sequencing was meant to remove, just mirrored. By 100ms the box is down
  to about 27px, where an arrow's notch is a few pixels and reads as detail
  rather than as damage.
*/
const HOLD_BACK = 0.1;

/*
  The two axes are deliberately not the same spring, so the card does not
  inflate as a rigid rectangle.

  Width leads and overshoots about 4%; height follows slower and overshoots
  about 2%. The card spreads sideways, then its height catches up — squash and
  stretch, on a shape that has no character of its own to squash. Every offset
  travels with its own axis, so the card stays centred on the pointer the whole
  way rather than drifting while the two disagree.

  There is no anticipation dip before the growth, and that is a decision rather
  than an omission. On a character it costs nothing; here the move is a reply to
  a hover, and every millisecond spent winding up before responding is felt as
  the interface being slow to answer.
*/
const SPREAD = {
  type: 'spring',
  stiffness: 560,
  damping: 34,
  mass: 1,
} as const;
const RISE = { type: 'spring', stiffness: 320, damping: 30, mass: 1 } as const;

/*
  Going back is critically damped, and not for symmetry's sake.

  A spring's overshoot is a fraction of the distance it travels, not of where
  it lands. The 4% that reads as a pleasant stretch across a 157px expansion is
  the same 6px coming back — and 6px against an 11px arrow crushes it to little
  over half its width before it springs out again. Measured at 5.8px wide on
  the way home, which is a visible pinch on the one shape that has to look
  exactly like a system cursor.

  Damping 60 against stiffness 900 is exactly critical: no overshoot at any
  distance, settled in about 130ms. Leaving is also the moment to be quick,
  since the pointer is on its way somewhere else.
*/
const SETTLE = {
  type: 'spring',
  stiffness: 1500,
  damping: 78,
  mass: 1,
} as const;

/*
  What the card holds, arriving after the card does.

  Unheld, a picture is a third of the way in by 34ms, while the box is still
  under 15px wide — so the first thing anyone sees of a screenshot is it being
  stretched out of a slot. Holding it back until the box has most of its size
  turns that into follow-through: the container arrives, and its contents land
  just behind it.

  Leaving is not delayed. A thing on its way out should go immediately, or it
  reads as reluctance.
*/
const CONTENTS = {
  duration: 0.2,
  delay: 0.12,
  ease: 'easeOut',
} as const;
const CONTENTS_OUT = { duration: 0.1, ease: 'easeOut' } as const;

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
  Both are reproduced here verbatim, translated so the tip is (0,0): the body
  below, and the outline as the percentages in `ARROW_CLIP`.

  (0,0) is the hotspot: the point the system considers "where you are
  clicking". Every other shape here is positioned against the pointer instead,
  which is what a card wants and a cursor does not.

  Worth knowing, because the internet will tell you otherwise: the macOS arrow
  has a *vertical* left edge, and its tail ends in a bevel rather than a point.
  It is 11.4 by 18.1, which is smaller than it looks — an arrow guessed at from
  memory comes out wider, taller and sharper than the real one.
*/
const ARROW_INNER =
  'M0.989 2.407 L0.989 13.595 L3.519 11.153 L6.42 16.593 L8.185 15.652 L5.41 10.45 L9.014 10.45 Z';
const ARROW_BOX = { width: 11.379, height: 18.066 };

/*
  The same eight vertices as a percentage of the box, and the box's own outline
  written with eight points in the same order. Those two interpolate, which is
  what lets one element travel from an arrow to a card instead of two elements
  trading places.

  The rounding is left to `border-radius` rather than baked into the target
  polygon. A polygon can only round a corner by spending points on it — eight
  would give a chamfer — and this way the end state is a plain box outline that
  clips nothing at all, with the radius doing the shape.

  The mapping is monotonic around both outlines: the tip goes to the top-left,
  the heel and tail walk along the bottom edge, and the shoulder ends at the
  top-right. Nothing crosses anything else, so the arrow inflates into the card
  rather than folding through itself on the way.
*/
const ARROW_CLIP =
  'polygon(0% 0%, 0% 88.65%, 29.14% 70.82%, 53.93% 100%, 70.31% 94.45%, 84.5% 89.8%, 61.93% 63.15%, 100% 63.15%)';
const BOX_CLIP =
  'polygon(0% 0%, 0% 100%, 25% 100%, 50% 100%, 75% 100%, 100% 100%, 100% 60%, 100% 0%)';

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
  const [label, setLabel] = React.useState({
    text: '',
    active: false,
    tint: '',
  });
  const [pill, setPill] = React.useState({ width: 20, height: 20 });

  const ghost = React.useRef<HTMLSpanElement>(null);
  const placed = React.useRef(false);
  /* Mirrors `away` so the move handler can skip the dispatch entirely when it
     has nothing to change. React bails out on an unchanged value, but only
     after the call has gone through the scheduler — and this runs per event. */
  const isAway = React.useRef(true);

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
        isAway.current = false;
        setAway(false);
      } else {
        x.set(event.clientX);
        y.set(event.clientY);
        if (isAway.current) {
          isAway.current = false;
          setAway(false);
        }
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
          tint: target.getAttribute('data-cursor-tint') ?? '',
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
      isAway.current = true;
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
      : ARROW_BOX;

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
      : { x: 0, y: 0 };

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[60]"
      style={{ x, y }}
      animate={{ opacity: away ? 0 : 1 }}
      transition={{ opacity: { duration: 0.16, ease: 'easeOut' } }}
    >
      {/*
        One element for every shape it takes, so this is a morph and not a
        hand-off between two things fading past each other.

        The box travels from the arrow's own size to the card's, its offset
        from the tip to wherever that shape belongs, and its clip from the
        arrow's outline to the box's — which by the end clips nothing, leaving
        `border-radius` to round the card. What the arrow is made of never
        changes: the same tint over the same blur, all the way through.

        Anchored by the tip rather than centred, because a pointer's hotspot is
        its point. Where a card wants to sit relative to that is `offset`'s job.
      */}
      <motion.div
        className={`absolute top-0 left-0 flex items-center justify-center overflow-hidden backdrop-blur-[10px] transition-colors duration-200 ${
          isLabel ? 'cursor-pill' : 'bg-cursor'
        }`}
        style={{
          /* Whatever the trigger is reporting. The pill mixes its own tint
             from this, so one variable dresses the label and its dot. */
          ...(label.tint ? { ['--cursor-tint' as string]: label.tint } : null),
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transformOrigin: '0 0',
        }}
        animate={{
          ...size,
          ...offset,
          clipPath: isArrow ? ARROW_CLIP : BOX_CLIP,
          borderRadius: isArrow ? 0 : isPreview ? 10 : 16,
          padding: isPreview ? 2 : 0,
          scale: isArrow && pressed ? 0.88 : 1,
        }}
        transition={{
          ...MORPH,
          width: isArrow ? SETTLE : { ...SPREAD, delay: HOLD },
          x: isArrow ? SETTLE : { ...SPREAD, delay: HOLD },
          height: isArrow ? SETTLE : { ...RISE, delay: HOLD },
          y: isArrow ? SETTLE : { ...RISE, delay: HOLD },
          clipPath: isArrow ? { ...OUTLINE, delay: HOLD_BACK } : OUTLINE,
          borderRadius: isArrow ? { ...OUTLINE, delay: HOLD_BACK } : OUTLINE,
        }}
      >
        {/*
          The darker body, and the only part that is arrow-shaped rather than
          box-shaped. It is a fixed size pinned to the tip and fades out as the
          shape opens, because there is nothing for it to become — the card's
          interior is a picture or a word.

          A black tint in both themes: "darker" only means one thing, and this
          composites over the tint rather than replacing it, so lightening it in
          dark mode would come out lighter than its surround.
        */}
        <motion.svg
          width={ARROW_BOX.width}
          height={ARROW_BOX.height}
          viewBox={`0 0 ${ARROW_BOX.width} ${ARROW_BOX.height}`}
          className="absolute top-0 left-0 block"
          aria-hidden="true"
          focusable="false"
          animate={{ opacity: isArrow ? 1 : 0 }}
          transition={isArrow ? CONTENTS : CONTENTS_OUT}
        >
          <path d={ARROW_INNER} fill="hsl(var(--cursor-core))" />
        </motion.svg>

        {/* Sized to the box rather than fixed, so the picture grows with the
            card instead of popping in at full size once the morph finishes. */}
        {src && (
          <motion.img
            src={src}
            alt=""
            className="h-full w-full rounded-[9px] object-cover"
            /* The element only exists once there is a source, so the first
               preview of a session mounts mid-morph. Without a starting value
               it mounts already opaque and the hold below never applies to the
               one hover most likely to be someone's first. */
            initial={{ opacity: 0 }}
            animate={{ opacity: isPreview ? 1 : 0 }}
            transition={isPreview ? CONTENTS : CONTENTS_OUT}
          />
        )}

        <motion.span
          className="type-body-xs absolute inset-0 flex items-center justify-center gap-1.5 px-2.5 py-1 whitespace-nowrap text-foreground"
          animate={{ opacity: isLabel ? 1 : 0 }}
          transition={isLabel ? CONTENTS : CONTENTS_OUT}
        >
          {label.active && (
            <span
              className="size-2 shrink-0 rounded-pill"
              style={{ background: 'var(--cursor-tint, rgb(22,191,94))' }}
            />
          )}
          {label.text}
        </motion.span>
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
