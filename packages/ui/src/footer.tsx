'use client';

import * as React from 'react';

export type FooterProps = React.ComponentProps<'header'>;

export function Footer({}: FooterProps) {
  return (
    <footer className="w-full border-t-[1px] border-white/20 bg-background/90 backdrop-blur-[8px]">
      <nav className="mx-auto grid max-w-screen-xl grid-cols-3 px-6 py-4">
        <small className="col-start-2 text-center text-muted-foreground">
          @ 2023 Pablo Hernández Jiménez
        </small>
      </nav>
    </footer>
  );
}
