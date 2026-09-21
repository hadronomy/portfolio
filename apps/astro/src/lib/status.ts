/**
 * What the dot on the avatar is claiming, and how it says it.
 *
 * The set is closed on purpose. A free string let the label say anything,
 * including something untrue, and gave the dot no way to look like what it
 * meant — it was green whatever it claimed. Naming the states makes the claim
 * checkable and gives each one an appearance to go with it.
 */
export type Status = 'available' | 'busy' | 'away' | 'offline';

export interface StatusLook {
  /** Shown in the pointer when the dot is hovered. Empty means no label. */
  label: string;
  /** The dot's fill. */
  dot: string;
  /**
   * Whether the dot animates at all.
   *
   * An absence should not blink at you. `offline` renders as the plain dot the
   * server draws and nothing hydrates over it, which is the same path a touch
   * device or reduced motion already takes.
   */
  alive: boolean;
}

/*
  Three hues and an absence.

  This is the one place the achromatic palette gives way, and it was already
  giving way for a single green — a status that cannot be told apart from
  another status is not reporting anything. The three share a hue family:
  the same saturation the existing green has, so they read as one set rather
  than as three accents borrowed from different places. `offline` returns to
  the palette entirely and uses the muted foreground, because "not here" is
  better said by draining the colour than by adding a fourth.
*/
export const STATUS = {
  available: { label: 'Available', dot: 'rgb(22,191,94)', alive: true },
  busy: { label: 'Busy', dot: 'rgb(192,28,22)', alive: true },
  away: { label: 'Away', dot: 'rgb(228,154,27)', alive: true },
  offline: {
    label: 'Offline',
    dot: 'hsl(var(--muted-foreground))',
    alive: false,
  },
} as const satisfies Record<Status, StatusLook>;

/** The look for a status, resolved once so callers never index the map twice. */
export const lookOf = (status: Status): StatusLook => STATUS[status];
