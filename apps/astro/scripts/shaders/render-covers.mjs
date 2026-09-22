// Renders each shader cover's poster frame.
//
// The poster is not a placeholder for the live cover — it is the same shader,
// the same uniforms, at a chosen moment, rendered through Dawn instead of the
// browser. It is what visitors see before WebGPU starts, what they keep when
// WebGPU is unavailable or motion is reduced, and what the cursor shows on
// hover. Re-run this whenever a cover's WGSL changes.
//
//   node scripts/shaders/render-covers.mjs            # write every poster
//   node scripts/shaders/render-covers.mjs ram        # one cover
//   node scripts/shaders/render-covers.mjs ram --time 3.2 --out /tmp/look.png
//
// Requires a GPU-capable machine; `npx vgpu doctor` reports what is missing.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveShader } from '@vgpu/wgsl/runtime';
import sharp from 'sharp';
import { effect, init, target } from 'vgpu/node';

import { shaderCovers } from '../../src/lib/shader-covers.ts';

const here = dirname(fileURLToPath(import.meta.url));
const shaderDir = resolve(here, '../../src/shaders');
const posterDir = resolve(here, '../../public/work');

const WIDTH = 1200;
const HEIGHT = 900;
/**
 * Height the poster is composed for, in device pixels.
 *
 * It renders at 1200x900 so the cursor preview has pixels to use, but the
 * print on the page is about this tall. Stroke weights are floored against
 * `pixel`, so passing the render height would make every hairline in the
 * poster finer than the same hairline in the live canvas beside it, and the
 * crossfade between them would read as a sharpen.
 */
const DISPLAY_HEIGHT = 520;

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};
const names = argv.filter((arg, index) => {
  if (arg.startsWith('--')) return false;
  return !argv[index - 1]?.startsWith('--');
});

const requested = names.length
  ? shaderCovers.filter((cover) => names.includes(cover.id))
  : shaderCovers;

if (requested.length === 0) {
  const known = shaderCovers.map((cover) => cover.id).join(', ');
  throw new Error(
    `No shader cover matched ${names.join(', ')}. Known: ${known}`,
  );
}

const overrideTime =
  flag('time') === undefined ? undefined : Number(flag('time'));
const overrideOut = flag('out');

const gpu = await init();
try {
  for (const cover of requested) {
    const resolved = await resolveShader({
      entry: resolve(shaderDir, `${cover.id}.wgsl`),
    });

    const colorTarget = target(gpu, {
      size: [WIDTH, HEIGHT],
      format: 'rgba8unorm',
    });
    const pass = effect(gpu, resolved.wgsl, {
      label: `${cover.id}-poster`,
      set: {
        params: {
          time: overrideTime ?? cover.posterTime,
          aspect: WIDTH / HEIGHT,
          pixel: 1 / DISPLAY_HEIGHT,
        },
      },
    });
    pass.draw(colorTarget);

    const pixels = await colorTarget.color.read({ mipLevel: 0, region: 'all' });
    const image = sharp(Buffer.from(pixels), {
      raw: { width: WIDTH, height: HEIGHT, channels: 4 },
    });

    const out = overrideOut ?? resolve(posterDir, `${cover.id}.webp`);
    await mkdir(dirname(out), { recursive: true });
    const encoded = out.endsWith('.png')
      ? await image.png().toBuffer()
      : await image.webp({ quality: 88, effort: 6 }).toBuffer();
    await writeFile(out, encoded);
    console.log(
      `${cover.id} -> ${out} (${(encoded.length / 1024).toFixed(0)} KB)`,
    );
  }
} finally {
  // Dawn keeps polling until the device is gone, which keeps the process alive.
  gpu.dispose();
}
