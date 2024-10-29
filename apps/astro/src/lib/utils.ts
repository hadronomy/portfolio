import path from 'path';
import type { ImageMetadata } from 'astro';

export async function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/*.{jpeg,jpg,png,gif}',
);

export async function getImage(name: string) {
  const imagePath = path.join('/src/assets/images', name);
  const image = images[imagePath];
  if (!image) {
    throw new Error(
      `${imagePath} does not exist in glob: /src/assets/*.{jpeg,jpg,png,gif}`,
    );
  }
  return image();
}
