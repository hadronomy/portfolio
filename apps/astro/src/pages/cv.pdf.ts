import { type DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import type { APIContext } from 'astro';
import React from 'react';

import { CVDocument } from '~/components/react/cv';

export async function GET(_context: APIContext) {
  const document = React.createElement(CVDocument, {});
  const documentBuffer = await renderToBuffer(
    document as React.ReactElement<DocumentProps>,
  );
  return new Response(documentBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Pablo_Hernandez-CV.pdf"',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': documentBuffer.length.toString(),
    },
  });
}
