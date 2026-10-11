import { CircleAlert } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type Tone = 'success' | 'error';
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(
  () => {},
);

/** Shows one short confirmation at a time. A new toast replaces the current one. */
export function useToast() {
  return useContext(ToastContext);
}

// Toast open / close from transitions.dev (#22): slower in than out, with a
// short rise and cross-blur. The exit keeps the last message mounted until the
// close transition ends.
const visibleFor = 4000;
const closeFor = 250;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [open, setOpen] = useState(false);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);
  const clear = () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  };
  const show = useCallback((message: string, tone: Tone = 'success') => {
    clear();
    counter.current += 1;
    setToast({ id: counter.current, message, tone });
    setOpen(false);
    // Two frames: mount closed, then open, so the transition has a start.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    timers.current.push(
      window.setTimeout(() => setOpen(false), visibleFor),
      window.setTimeout(() => setToast(null), visibleFor + closeFor),
    );
  }, []);
  useEffect(() => clear, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="iv-layer iv-toast-region" aria-live="polite">
        {toast && (
          <div
            key={toast.id}
            className="iv-toast"
            data-open={open}
            data-tone={toast.tone}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            {toast.tone === 'success' ? (
              <SuccessCheck />
            ) : (
              <CircleAlert size={16} />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

// Success check from transitions.dev (#10). The path length is measured once:
// the dash values must match the real stroke or it draws short.
export function SuccessCheck() {
  return (
    <span className="iv-check-mark" data-state="in" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.16" />
        <path
          d="M4.75 8.25 7 10.5l4.25-4.75"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: 11, strokeDashoffset: 11 }}
        />
      </svg>
    </span>
  );
}
