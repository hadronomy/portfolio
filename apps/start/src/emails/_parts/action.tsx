import { Button } from 'react-email';
import { tone } from './frame';

/** The email's one action, drawn as the pages' primary button. */
export function Action({ href, children }: { href: string; children: string }) {
  return (
    <Button
      href={href}
      style={{
        display: 'inline-block',
        padding: '12px 20px',
        borderRadius: 12,
        backgroundColor: tone.ink,
        color: '#ffffff',
        fontSize: 14,
        lineHeight: '20px',
        fontWeight: 500,
        textDecoration: 'none',
      }}
    >
      {children}
    </Button>
  );
}
