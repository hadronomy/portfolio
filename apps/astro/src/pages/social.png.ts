import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { render } from 'takumi-js';
import { SITE_IMAGE } from '~/consts';
import { profile } from '~/lib/profile';

export async function GET() {
  const require = createRequire(import.meta.url);
  const font = await readFile(
    require.resolve(
      '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    ),
  );
  const image = await render(
    {
      type: 'container',
      style: {
        width: 1200,
        height: 630,
        backgroundColor: '#fafafa',
        color: '#121212',
        padding: 72,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Inter',
      },
      children: [
        {
          type: 'text',
          text: 'hadronomy.com',
          style: { fontSize: 28, color: '#595959' },
        },
        {
          type: 'container',
          style: { display: 'flex', flexDirection: 'column', gap: 24 },
          children: [
            {
              type: 'text',
              text: profile.name,
              style: { fontSize: 76, fontWeight: 600, letterSpacing: -3 },
            },
            {
              type: 'text',
              text: 'Full-Stack & Product Engineer',
              style: { fontSize: 36, color: '#595959' },
            },
          ],
        },
        {
          type: 'text',
          text: 'Web development · Product interfaces · AI systems',
          style: { fontSize: 26, color: '#595959' },
        },
      ],
    },
    {
      width: SITE_IMAGE.width,
      height: SITE_IMAGE.height,
      format: 'png',
      fonts: [font],
    },
  );

  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/png' },
  });
}
