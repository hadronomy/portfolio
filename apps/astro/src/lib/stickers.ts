import { persistentAtom } from '@nanostores/persistent';

/**
 * Where a sticker was left, as an offset from its own slot rather than a point
 * on the page.
 *
 * Absolute coordinates would be wrong the moment anything reflows — a narrower
 * window, a new post in the writing list, a longer intro — and the sticker
 * would be found somewhere unrelated to where it was stuck. An offset from the
 * slot survives all of that, because the slot moves with the layout and the
 * sticker moves with the slot.
 */
export interface Placement {
  x: number;
  y: number;
  /** Angle it came to rest at, so it keeps the tilt it was dropped with. */
  r: number;
}

export type Placements = Record<string, Placement>;

export const placements = persistentAtom<Placements>(
  'sticker-placements',
  {},
  {
    encode: JSON.stringify,
    decode: (raw) => {
      // Anything unreadable means an older or hand-edited value; an empty map
      // puts every sticker back in its slot, which is a safe place to land.
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },
  },
);

export function placeSticker(id: string, placement: Placement) {
  placements.set({ ...placements.get(), [id]: placement });
}

export function clearSticker(id: string) {
  const next = { ...placements.get() };
  delete next[id];
  placements.set(next);
}

export function clearAllStickers() {
  placements.set({});
}
