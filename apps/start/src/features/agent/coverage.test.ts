import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serverFunctions } from './coverage';
import { InvoiceTools } from './tools';

// Holds the agent surface level with the app: every server function is
// covered by tools or says why agents do not get it, and every tool named
// exists. See AGENTS.md, "Agents can do what the owner can".

const source = join(import.meta.dirname, '..', '..');

async function* files(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.'))
      yield path;
  }
}

describe('the agent surface', () => {
  it('covers every server function, or says why not', async () => {
    const found: string[] = [];
    for await (const file of files(source))
      for (const match of (await readFile(file, 'utf8')).matchAll(
        /export const (\w+) = createServerFn/g,
      ))
        if (match[1]) found.push(match[1]);
    expect(found.sort()).toEqual(Object.keys(serverFunctions).sort());
  });

  it('names only tools that exist', () => {
    const tools = new Set(Object.keys(InvoiceTools.tools));
    for (const entry of Object.values(serverFunctions))
      if (Array.isArray(entry))
        for (const name of entry) expect(tools).toContain(name);
  });
});
