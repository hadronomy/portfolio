import path from 'node:path';
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import ico from 'sharp-ico';

const faviconSrc = path.resolve('src/favicon.png');

export async function GET() {
  // resize to 16px and 32px PNG
  const buffer16 = await sharp(faviconSrc)
    .resize(16)
    .toFormat('png')
    .toBuffer();
  const buffer32 = await sharp(faviconSrc)
    .resize(32)
    .toFormat('png')
    .toBuffer();
  // generate ico
  const icoBuffer = ico.encode([buffer16, buffer32]);

  return new Response(icoBuffer, {
    headers: { 'Content-Type': 'image/x-icon' },
  });
}
