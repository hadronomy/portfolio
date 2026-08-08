import { persistentAtom } from '@nanostores/persistent';

export type Theme = 'light' | 'dark';

/**
 * `undefined` means "the visitor has not chosen", which is what keeps the OS
 * preference authoritative until they do. A store with a concrete default could
 * not tell that apart from someone having picked light.
 *
 * The value is a bare `light` or `dark` under the key `theme` — the same key
 * and encoding the blocking script in the document head reads. That script runs
 * before this module has been fetched, so the two cannot be allowed to disagree
 * about the format.
 */
export const theme = persistentAtom<Theme | undefined>('theme', undefined, {
  encode: (value) => value ?? '',
  decode: (value) =>
    value === 'dark' || value === 'light' ? value : undefined,
});

const prefersDark = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/** The theme actually in force: the stored choice, or the OS preference. */
export const resolvedTheme = (): Theme =>
  theme.get() ?? (prefersDark() ? 'dark' : 'light');

const apply = () => {
  const next = resolvedTheme();
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.style.colorScheme = next;
};

export const toggleTheme = () =>
  theme.set(resolvedTheme() === 'dark' ? 'light' : 'dark');

export function initTheme() {
  // Fires once immediately and then on every change, including one made in
  // another tab — that cross-tab sync is what the store buys over reading
  // localStorage by hand.
  theme.subscribe(apply);

  /*
    A view transition replaces the `html` element's attributes with the incoming
    document's, and those come from the static build with no theme class on
    them. The store has not changed, so the subscription above will not re-fire;
    this is what puts the class back, and it is the whole reason the choice
    appeared not to persist across navigation.
  */
  document.addEventListener('astro:after-swap', apply);

  // Follow the OS only while no explicit choice is stored.
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (!theme.get()) apply();
    });
}
