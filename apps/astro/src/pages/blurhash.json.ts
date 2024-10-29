import path from 'path';
import { encode } from 'blurhash';
import sharp from 'sharp';
import { getImage, images } from '~/lib/utils';

async function getBlurhash(imagePath: string): Promise<string> {
  const image_module = await getImage(path.basename(imagePath));
  const { default: image } = image_module;
  const environment = process.env.NODE_ENV || 'development';
  const directory = environment === 'development' ? 'src' : 'dist';
  const source_prefix = '/@fs';
  const image_source = image.src.startsWith(source_prefix)
    ? image.src.replace(source_prefix, '')
    : image.src;
  const image_path = image.src.startsWith(source_prefix)
    ? image_source.split('?')[0]
    : path.join(process.cwd(), directory, image.src.split('?')[0]);
  const buffer = await sharp(image_path)
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
      const blurhash = await getBlurhash(filename).catch((error) => {
        throw new Error(
          `Failed to generate blurhash for ${filename}: ${error}`,
        );
      });
      blurhashes[`/${filename}`] = blurhash;
    } catch (error) {
      console.error(`Failed to generate blurhash for ${filename}:`, error);
    }
  }
  return blurhashes;
}

export async function GET() {
  const blurhashes = await generateBlurhashes().catch((error) => {
    console.error('Failed to generate blurhashes:', error);
    return {};
  });

  return new Response(JSON.stringify(blurhashes), {
    headers: { 'Content-Type': 'application/json' },
  });
}
