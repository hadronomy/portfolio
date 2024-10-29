import path from 'path';
import type { ImageMetadata } from 'astro';
import { encode } from 'blurhash';
import sharp from 'sharp';
import { getImage, images } from '~/lib/utils';

// Generate blurhash for a single image using sharp and blurhash
async function getBlurhash(imagePath: string): Promise<string> {
  const imageModule = await getImage(path.basename(imagePath));
  const { default: image } = imageModule;

  const buffer = await sharp(image.src.split('?')[0].substring(4))
    .toBuffer()
    .catch((error) => {
      throw new Error(`Failed to read image buffer: ${error}`);
    });
  const { data, info } = await sharp(Buffer.from(buffer))
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);
}

// Generate blurhashes for all images
async function generateBlurhashes() {
  const blurhashes: Record<string, string> = {};
  for (const imagePath in images) {
    const filename = path.basename(imagePath);
    try {
      const blurhash = await getBlurhash(filename);
      blurhashes[`/${filename}`] = blurhash;
    } catch (error) {
      console.error(`Failed to generate blurhash for ${filename}:`, error);
    }
  }
  return blurhashes;
}

export async function GET() {
  const blurhashes = await generateBlurhashes();

  return new Response(JSON.stringify(blurhashes), {
    headers: { 'Content-Type': 'application/json' },
  });
}
