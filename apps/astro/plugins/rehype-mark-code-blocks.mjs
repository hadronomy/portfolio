/**
 * Marks the `pre` that is an actual code block, so the MDX `pre` component can
 * tell one from the `pre` twoslash builds inside a hover card.
 *
 * They are identical as elements — same classes, same shiki custom properties,
 * same `tabindex` — and differ only in where they sit: a card's `pre` is nested
 * inside the `code` of the block it belongs to. Position is the only signal, so
 * this has to be a tree pass rather than a check on the element.
 *
 * Runs after `rehypeCode`; before it there is nothing to mark.
 */
export function rehypeMarkCodeBlocks() {
  return (tree) => {
    const walk = (node, insideCode) => {
      if (node.type === 'element') {
        if (node.tagName === 'pre' && !insideCode) {
          // Astro's MDX pipeline keys this `class`, not `className`, and hands
          // it over as a string or an array depending on which transformer last
          // touched it. Writing the wrong key adds a second class attribute
          // that silently wins and drops the shiki and twoslash classes both
          // stylesheets depend on.
          const existing = node.properties.class;
          node.properties.class = [
            ...(Array.isArray(existing)
              ? existing
              : typeof existing === 'string'
                ? existing.split(/\s+/).filter(Boolean)
                : []),
            'code-block-root',
          ];
        }

        insideCode = insideCode || node.tagName === 'code';
      }

      for (const child of node.children ?? []) walk(child, insideCode);
    };

    walk(tree, false);
  };
}
