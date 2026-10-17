import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { isFigure, layout, lead, tail } from '#page-render';

const text = (value: string): JSONContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text: value }],
});
const heading = (level: number, value: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text: value }],
});
const list = (count: number): JSONContent => ({
  type: 'bulletList',
  content: Array.from({ length: count }, (_, at) => ({
    type: 'listItem',
    content: [text(`Item ${at + 1}`)],
  })),
});
const clause = (id: string): JSONContent => ({
  type: 'clause',
  attrs: { id, version: 1 },
});

describe('page layout', () => {
  it('opens a part at a later level-1 heading, not an empty section', () => {
    const { title, parts } = layout({
      type: 'doc',
      content: [
        heading(1, 'Quote'),
        text('Lede'),
        heading(1, 'Commercial terms'),
        heading(2, 'Validity'),
        text('Thirty days.'),
      ],
    });
    expect(title).not.toBeNull();
    expect(parts.map((part) => part.kind)).toEqual(['part', 'section']);
  });

  it('numbers clauses through the whole document', () => {
    const { parts } = layout({
      type: 'doc',
      content: [
        heading(2, 'Payment'),
        clause('payment-terms'),
        heading(2, 'Scope'),
        clause('scope'),
        clause('copyright'),
      ],
    });
    const numbers = parts.flatMap((part) =>
      part.kind === 'section' ? part.blocks.map((block) => block.attrs?.n) : [],
    );
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('keeps the first two items of a list with its heading', () => {
    const [head, rest] = lead([list(5), text('After')]);
    expect(head[0]?.content).toHaveLength(2);
    expect(rest[0]?.content).toHaveLength(3);
    expect(rest[0]?.attrs?.start).toBe(3);
  });

  it('keeps a short closing paragraph with the last two items of its list', () => {
    const [body, end] = tail([list(6), text('Closing.')]);
    expect(body[0]?.content).toHaveLength(4);
    expect(end.map((block) => block.type)).toEqual(['bulletList', 'paragraph']);
    expect(end[0]?.content).toHaveLength(2);
  });

  it('leaves a section alone when nothing would strand', () => {
    const blocks = [text('One.'), text('Two.')];
    expect(tail(blocks)).toEqual([blocks, []]);
  });

  it('knows an amount from words in a table cell', () => {
    for (const figure of ['288,00 €', '1.400,00 €', '30%', '0,5', '-500,00 €'])
      expect(isFigure(figure)).toBe(true);
    for (const words of ['Tarifa publicada', 'S01 · Análisis', '15 días'])
      expect(isFigure(words)).toBe(false);
  });
});
