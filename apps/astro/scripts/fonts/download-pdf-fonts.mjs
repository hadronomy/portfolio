import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'src/assets/pdf-fonts');

const FONT_SOURCES = [
  {
    filename: 'SpaceGrotesk-Light.ttf',
    url: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj62UUsj.ttf',
  },
  {
    filename: 'SpaceGrotesk-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUUsj.ttf',
  },
  {
    filename: 'SpaceGrotesk-SemiBold.ttf',
    url: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42Vksj.ttf',
  },
  {
    filename: 'SpaceGrotesk-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVksj.ttf',
  },
  {
    filename: 'DMSans-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf',
  },
  {
    filename: 'DMSans-Medium.ttf',
    url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTg.ttf',
  },
  {
    filename: 'DMSans-SemiBold.ttf',
    url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJthTg.ttf',
  },
  {
    filename: 'DMSans-Bold.ttf',
    url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf',
  },
  {
    filename: 'GeistMono-Regular.ttf',
    url: 'https://unpkg.com/geist@1.3.1/dist/fonts/geist-mono/GeistMono-Regular.ttf',
  },
  {
    filename: 'GeistMono-Bold.ttf',
    url: 'https://unpkg.com/geist@1.3.1/dist/fonts/geist-mono/GeistMono-Bold.ttf',
  },
];

async function fileExistsWithSize(filePath) {
  try {
    const info = await stat(filePath);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function downloadFont({ filename, url }) {
  const destination = path.join(OUTPUT_DIR, filename);
  if (await fileExistsWithSize(destination)) {
    console.log(`skip ${filename}`);
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${filename}: ${response.status} ${response.statusText}`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(destination, bytes);
  console.log(`downloaded ${filename}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const source of FONT_SOURCES) {
    await downloadFont(source);
  }
  console.log(`fonts ready in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
