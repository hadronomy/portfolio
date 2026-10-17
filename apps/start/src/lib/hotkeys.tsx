import {
  type AppHotkey,
  defineAppHotkeys,
  detectPlatform,
  formatForDisplay,
  type Hotkey,
  HotkeysProvider,
  resolveModifier,
  useHeldKeys,
} from '@tanstack/react-hotkeys';
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

const block = {
  ignoreInputs: false,
  capture: true,
  preventDefault: false,
  stopPropagation: false,
} as const;

/**
 * Every keyboard shortcut in the app, in one place. A component binds one
 * with `useHotkey(appHotkeys[id], callback, { target })`; the label a
 * tooltip or hint shows comes from the same entry, so the two cannot drift.
 *
 * A context names where a shortcut applies. Two shortcuts may share keys
 * only in different contexts, which is how Escape closes several things.
 */
export const appHotkeys = defineAppHotkeys({
  'documents.search': {
    hotkey: '/',
    meta: { name: 'Search documents' },
    context: 'documents',
  },
  'document.save': {
    hotkey: 'Mod+S',
    meta: { name: 'Save now' },
    context: 'editor',
  },
  'preview.find': {
    hotkey: 'Mod+F',
    meta: { name: 'Find in the document' },
    context: 'editor',
  },
  'preview.next': {
    hotkey: 'Enter',
    meta: { name: 'Next match' },
    context: 'find',
  },
  'preview.previous': {
    hotkey: 'Shift+Enter',
    meta: { name: 'Previous match' },
    context: 'find',
  },
  'preview.close': {
    hotkey: 'Escape',
    meta: { name: 'Close search' },
    context: 'find',
  },
  'line.up': {
    hotkey: 'Alt+ArrowUp',
    meta: { name: 'Move the line up' },
    context: 'lines',
  },
  'line.down': {
    hotkey: 'Alt+ArrowDown',
    meta: { name: 'Move the line down' },
    context: 'lines',
  },
  // Bound on the document, where it runs after React has handled the key:
  // a field inside the line that used the Esc marks it handled first. Every
  // line binds it, and only the open ones listen.
  'line.close': {
    hotkey: 'Escape',
    meta: { name: 'Close the line' },
    context: 'lines',
    options: {
      conflictBehavior: 'allow',
      preventDefault: false,
      stopPropagation: false,
    },
  },
  // The page text is a contenteditable inside the bound element, and
  // Alt+arrows there are a command, not typing. They listen on the way
  // down, before ProseMirror moves the caret, and claim the key only when
  // a block moved: at the first or last block it stays the caret's.
  'block.up': {
    hotkey: 'Alt+ArrowUp',
    meta: { name: 'Move the block up' },
    context: 'pages',
    options: block,
  },
  'block.down': {
    hotkey: 'Alt+ArrowDown',
    meta: { name: 'Move the block down' },
    context: 'pages',
    options: block,
  },
  'link.cancel': {
    hotkey: 'Escape',
    meta: { name: 'Cancel the link' },
    context: 'format',
  },
  'mail.send': {
    hotkey: 'Mod+Enter',
    meta: { name: 'Send' },
    context: 'mail',
  },
  'quote.close': {
    hotkey: 'Escape',
    meta: { name: 'Lay the quote down' },
    context: 'quote',
  },
  'signature.undo': {
    hotkey: 'Mod+Z',
    meta: { name: 'Undo the last stroke' },
    context: 'signature',
  },
  'signature.redo': {
    hotkey: 'Mod+Shift+Z',
    meta: { name: 'Redo' },
    context: 'signature',
  },
  // Windows and Linux redo with Ctrl+Y as well.
  'signature.redo-y': {
    hotkey: 'Mod+Y',
    meta: { name: 'Redo' },
    context: 'signature',
  },
  'signature.clear': {
    hotkey: 'Backspace',
    meta: { name: 'Clear the signature' },
    context: 'signature',
  },
  'signature.clear-forward': {
    hotkey: 'Delete',
    meta: { name: 'Clear the signature' },
    context: 'signature',
  },
  'signature.stop': {
    hotkey: 'Escape',
    meta: { name: 'Stop the replay' },
    context: 'signature',
  },
});

declare module '@tanstack/react-hotkeys' {
  interface Register {
    appHotkeys: typeof appHotkeys;
  }
}

// Long enough that ⌘S or ⌘F never flashes every hint on its way through;
// short enough that holding ⌘ to look still feels like an answer.
const revealAfter = 450;

interface Spot {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly above: boolean;
}

/**
 * Where each shortcut's hint goes: centred under its action, or over it
 * near the bottom of the window. An action is skipped when it is disabled,
 * covered, off screen, or inside a `data-hotkey-scope` that does not hold
 * the focus, since its shortcut would do nothing there.
 */
function measure(): Spot[] {
  const spots: Spot[] = [];
  for (const action of document.querySelectorAll<HTMLElement>(
    '[data-hotkey-hint]',
  )) {
    if (action.matches(':disabled') || action.closest('[inert]')) continue;
    const scope = action.closest('[data-hotkey-scope]');
    if (scope && !scope.matches(':focus-within')) continue;
    const box = action.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !action.contains(hit)) continue;
    const above = box.bottom + 32 > innerHeight;
    spots.push({
      label: action.dataset.hotkeyHint ?? '',
      x,
      y: above ? box.top - 6 : box.bottom + 6,
      above,
    });
  }
  return spots;
}

/**
 * Holding ⌘ (Ctrl off a Mac) on its own, for a moment, shows every shortcut
 * beside its action. The hints live in one layer over the page, so no
 * clipped toolbar or transformed panel can cut one off, and they are only
 * measured while shown.
 */
function HintReveal() {
  const held = useHeldKeys();
  const alone = held.length === 1 && held[0] === resolveModifier('Mod');
  const [spots, setSpots] = useState<Spot[] | null>(null);
  useEffect(() => {
    if (!alone) return;
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSpots(measure()));
    };
    const timer = window.setTimeout(() => {
      place();
      addEventListener('scroll', place, { capture: true, passive: true });
      addEventListener('resize', place);
    }, revealAfter);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      removeEventListener('scroll', place, { capture: true });
      removeEventListener('resize', place);
      setSpots(null);
    };
  }, [alone]);
  if (!spots?.length) return null;
  return createPortal(
    <div className="hotkey-hints" aria-hidden>
      {spots.map((spot) => (
        <kbd
          key={`${spot.label}:${spot.x}:${spot.y}`}
          data-above={spot.above || undefined}
          style={{ left: spot.x, top: spot.y }}
        >
          {spot.label}
        </kbd>
      ))}
    </div>,
    document.body,
  );
}

export function Hotkeys({ children }: { children: ReactNode }) {
  return (
    <HotkeysProvider appHotkeys={appHotkeys}>
      <HintReveal />
      {children}
    </HotkeysProvider>
  );
}

const unchanging = () => () => {};

/**
 * A value that depends on the platform. The server cannot know it, so it
 * renders `server` and the browser fills the value in after hydration.
 */
function usePlatform<T extends string | null>(read: () => T, server: T): T {
  return useSyncExternalStore(unchanging, read, () => server);
}

// ⇧⌘S, as a Mac menu writes it; Ctrl+Shift+S elsewhere.
const display = (hotkey: Hotkey) =>
  formatForDisplay(hotkey, {
    separatorToken: detectPlatform() === 'mac' ? '' : null,
  });

/** A shortcut as this platform writes it: ⌘S on a Mac, Ctrl+S elsewhere. */
export function useHotkeyLabel(hotkey: AppHotkey): string | null {
  return usePlatform(
    () => (hotkey.hotkey ? display(hotkey.hotkey) : null),
    null,
  );
}

/**
 * Props for the element that performs an action with a shortcut: its
 * `aria-keyshortcuts`, and the hint shown beside it while ⌘ is held. Several
 * shortcuts share one hint, as ⌥↑ ⌥↓ do for moving a line.
 */
export function useHotkeyProps(...hotkeys: AppHotkey[]): {
  'aria-keyshortcuts'?: string;
  'data-hotkey-hint'?: string;
} {
  const bound = hotkeys.flatMap(({ hotkey }) => (hotkey ? [hotkey] : []));
  const label = usePlatform(() => bound.map(display).join(' '), '');
  const aria = usePlatform(
    () =>
      bound
        .filter((hotkey) => typeof hotkey === 'string')
        .map((hotkey) => hotkey.replaceAll('Mod', resolveModifier('Mod')))
        .join(' '),
    '',
  );
  return label ? { 'aria-keyshortcuts': aria, 'data-hotkey-hint': label } : {};
}
