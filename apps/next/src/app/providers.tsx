'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

export type ProvidersProps = React.ComponentProps<typeof ThemeProvider>;

export function Providers({ children, ...props }: ProvidersProps) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>;
}
