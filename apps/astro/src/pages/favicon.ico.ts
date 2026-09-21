import path from 'node:path';
import sharp from 'sharp';
import ico from 'sharp-ico';

const faviconSrc = path.resolve('src/favicon.png');

export async function GET() {
  const buffer16 = await sharp(faviconSrc)
    .resize(16)
    .toFormat('png')
    .toBuffer();
  const buffer32 = await sharp(faviconSrc)
    .resize(32)
    .toFormat('png')
    .toBuffer();
  const icoBuffer = ico.encode([buffer16, buffer32]);

  return new Response(new Uint8Array(icoBuffer), {
    headers: { 'Content-Type': 'image/x-icon' },
  });
}
