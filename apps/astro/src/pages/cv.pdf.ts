import { type DocumentProps, renderToBuffer } from '@react-pdf/renderer';
import type { APIContext } from 'astro';
import React from 'react';

import { CVDocument } from '~/components/react/cv';
import { type SigningOptions, signPdfBuffer } from '~/lib/pdf-signer';

export async function GET(_context: APIContext) {
  const document = React.createElement(CVDocument, {});
  const documentBuffer = await renderToBuffer(
    document as React.ReactElement<DocumentProps>,
  );

  // Sign the PDF with digital signature
  const signingOptions: SigningOptions = {
    signerName: 'Pablo Hernandez',
    location: 'San Cristóbal de La Laguna, Santa Cruz de Tenerife, Spain',
    reason: 'CV Authentication',
  };

  const signedBuffer = await signPdfBuffer(documentBuffer, signingOptions);

  return new Response(new Uint8Array(signedBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Pablo_Hernandez-CV.pdf"',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': signedBuffer.length.toString(),
    },
  });
}
