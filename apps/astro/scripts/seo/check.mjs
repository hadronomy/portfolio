import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = fileURLToPath(new URL('../../dist/client/', import.meta.url));
const origin = 'https://hadronomy.com';

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(
      ([, name, double, single]) => [name, double ?? single],
    ),
  );
}

async function htmlFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const file = path.join(root, entry.name);
      return entry.isDirectory()
        ? htmlFiles(file)
        : entry.name.endsWith('.html')
          ? [file]
          : [];
    }),
  );
  return files.flat();
}

async function localResource(href) {
  const url = new URL(href, origin);
  assert.equal(url.origin, origin, `Wrong production origin: ${href}`);
  const file = path.join(directory, decodeURIComponent(url.pathname));
  const info = await stat(file);
  assert.ok(info.isFile(), `Resource is not a file: ${href}`);
  return file;
}

const indexable = new Set();
const titles = new Set();
const descriptions = new Set();
const pages = await htmlFiles(directory);

for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1];
  assert.ok(head, `${file}: missing head`);
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  const meta = (key) =>
    metas.filter((item) => item.name === key || item.property === key);
  const oneMeta = (key) => {
    const matches = meta(key);
    assert.equal(matches.length, 1, `${file}: expected one ${key}`);
    assert.ok(matches[0].content?.trim(), `${file}: empty ${key}`);
    return matches[0].content;
  };
  const canonicals = links.filter(({ rel }) => rel === 'canonical');
  assert.equal(canonicals.length, 1, `${file}: expected one canonical`);
  const canonical = new URL(canonicals[0].href);
  assert.equal(canonical.origin, origin, `${file}: wrong canonical origin`);
  assert.equal(
    canonical.search + canonical.hash,
    '',
    `${file}: query or fragment in canonical`,
  );
  const robots = oneMeta('robots');
  const noindex = /\bnoindex\b/.test(robots);
  const title = head.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
  assert.ok(title, `${file}: missing title`);
  const description = oneMeta('description');
  assert.equal(
    oneMeta('og:url'),
    canonical.href,
    `${file}: OG URL disagrees with canonical`,
  );
  oneMeta('og:site_name');
  oneMeta('og:image:alt');
  oneMeta('twitter:image:alt');
  assert.equal(oneMeta('twitter:card'), 'summary_large_image');
  const imageURL = oneMeta('og:image');
  assert.equal(oneMeta('twitter:image'), imageURL);
  const image = await sharp(await localResource(imageURL)).metadata();
  assert.equal(
    Number(oneMeta('og:image:width')),
    image.width,
    `${file}: incorrect image width`,
  );
  assert.equal(
    Number(oneMeta('og:image:height')),
    image.height,
    `${file}: incorrect image height`,
  );
  assert.ok(
    links.some(({ rel, sizes }) => rel === 'icon' && sizes === '96x96'),
    `${file}: missing search favicon`,
  );
  assert.ok(
    /<html\b[^>]*lang="en"/.test(html),
    `${file}: missing document language`,
  );

  const scripts = [
    ...head.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  if (noindex) {
    assert.equal(
      scripts.length,
      0,
      `${file}: noindex page claims rich-result data`,
    );
    continue;
  }
  assert.equal(
    (html.match(/<h1\b/g) ?? []).length,
    1,
    `${file}: expected one main heading`,
  );
  assert.ok(
    canonical.pathname.endsWith('/'),
    `${file}: inconsistent trailing slash`,
  );
  const relative = path.relative(directory, file).split(path.sep).join('/');
  const expectedPath =
    relative === 'index.html'
      ? '/'
      : `/${relative.replace(/index\.html$/, '')}`;
  assert.equal(
    canonical.pathname,
    expectedPath,
    `${file}: canonical points to another page`,
  );
  assert.ok(!titles.has(title), `${file}: duplicate title`);
  assert.ok(!descriptions.has(description), `${file}: duplicate description`);
  titles.add(title);
  descriptions.add(description);
  indexable.add(canonical.href);
  assert.equal(scripts.length, 1, `${file}: expected one JSON-LD graph`);
  const graph = JSON.parse(scripts[0][1]);
  assert.equal(graph['@context'], 'https://schema.org');
  assert.ok(Array.isArray(graph['@graph']) && graph['@graph'].length > 0);
  const types = graph['@graph'].map((node) => node['@type']);
  if (canonical.pathname === '/') {
    assert.ok(
      types.includes('ProfilePage') &&
        types.includes('Person') &&
        types.includes('WebSite'),
    );
  } else {
    assert.ok(
      types.includes('BreadcrumbList'),
      `${file}: missing breadcrumb data`,
    );
  }
  const article = graph['@graph'].find(
    (node) => node['@type'] === 'BlogPosting',
  );
  if (article) {
    assert.equal(article.url, canonical.href);
    assert.equal(article.datePublished, oneMeta('article:published_time'));
    if (article.dateModified)
      assert.equal(article.dateModified, oneMeta('article:modified_time'));
    assert.ok(
      article.author?.name && article.author?.url,
      `${file}: missing author identity`,
    );
  }
  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const { href } = attributes(tag);
    if (!href || !href.startsWith('/') || href.startsWith('//')) continue;
    const url = new URL(href, origin);
    const target = path.join(directory, decodeURIComponent(url.pathname));
    await stat(
      url.pathname.endsWith('/') ? path.join(target, 'index.html') : target,
    );
  }
}

const sitemapIndex = await readFile(
  path.join(directory, 'sitemap-index.xml'),
  'utf8',
);
const sitemapUrls = new Set();
for (const [, href] of sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const sitemap = await readFile(await localResource(href), 'utf8');
  for (const [, url] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.ok(!sitemapUrls.has(url), `Duplicate sitemap URL: ${url}`);
    sitemapUrls.add(url);
  }
}
assert.deepEqual(
  sitemapUrls,
  indexable,
  'Sitemap differs from canonical, indexable HTML pages',
);
const robots = await readFile(path.join(directory, 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*\s+Allow: \//);
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap-index.xml`));
assert.ok(
  !(await readdir(path.join(directory, 'blog'))).includes('typography'),
  'Draft specimen leaked into production',
);
console.log(
  `SEO check passed: ${pages.length} HTML pages, ${indexable.size} indexable URLs, matching sitemap, valid JSON-LD, and reachable local links/images.`,
);
