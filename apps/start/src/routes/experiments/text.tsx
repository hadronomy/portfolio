import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { fingerprint } from '../../lib/fingerprint';

export const Route = createFileRoute('/experiments/text')({
  component: TextTool,
});

function TextTool() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof fingerprint>
  > | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function hash() {
    setPending(true);
    setError('');
    try {
      setResult(await fingerprint({ data: text }));
    } catch {
      setError('The fingerprint request failed. Try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <h1>Text tools</h1>
      <p>
        Count text locally, or send it to the server to calculate a SHA-256
        fingerprint.
      </p>
      <label htmlFor="text">Your text</label>
      <textarea
        id="text"
        value={text}
        disabled={pending}
        maxLength={65536}
        rows={8}
        onChange={(event) => {
          setText(event.target.value);
          setResult(null);
        }}
      />
      <p className="counts" aria-live="polite">
        {Array.from(text).length} characters ·{' '}
        {text.trim() ? text.trim().split(/\s+/u).length : 0} words
      </p>
      <button type="button" disabled={pending} onClick={hash}>
        {pending ? 'Calculating…' : 'Calculate fingerprint'}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <output>
          <span>SHA-256 · {result.bytes} bytes</span>
          <code>{result.hash}</code>
        </output>
      )}
      <footer>
        <a href="/experiments">All experiments</a>
      </footer>
    </section>
  );
}
