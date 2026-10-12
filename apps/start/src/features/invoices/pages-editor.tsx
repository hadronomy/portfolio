import { translate } from '@portfolio/i18n';
import { m } from '@portfolio/i18n/messages';
import {
  type Clause,
  clauses,
  clauseVersion,
  latestVersion,
} from '@portfolio/invoices/clauses';
import type { Language } from '@portfolio/invoices/model';
import { linkable } from '@portfolio/invoices/page-links';
import { markdownToJSON } from '@portfolio/invoices/page-markdown';
import { ClauseBlock, pageExtensions } from '@portfolio/invoices/page-schema';
import {
  type Pages,
  pagesFrom,
  readPages,
  toJSONContent,
} from '@portfolio/invoices/pages';
import { type Editor, Extension, type Range } from '@tiptap/core';
import Typography from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import { NodeSelection, PluginKey, TextSelection } from '@tiptap/pm/state';
import {
  EditorContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditor,
  useEditorState,
} from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from '@tiptap/suggestion';
import { Result } from 'effect';
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  Quote,
  Scale,
  SeparatorHorizontal,
  Table,
  Underline,
  Unlink,
} from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from './ui';

// The editor for a quote's pages. It edits the document the PDF prints,
// with the page schema's own extensions, and adds only what writing needs:
// a block menu on a typed slash, a format bar on a selection, clause cards,
// and keyboard moves for blocks. Changes reach the caller as valid pages.

/** Moves the top-level block holding the selection up or down by one. */
function moveBlock(editor: Editor, direction: -1 | 1) {
  const { state, view } = editor;
  const { selection } = state;
  const { $from } = selection;
  const index = $from.index(0);
  const target = index + direction;
  if (target < 0 || target >= state.doc.childCount) return false;
  const start = $from.depth === 0 ? selection.from : $from.before(1);
  const node = state.doc.child(index);
  const other = state.doc.child(target);
  const moved =
    direction === -1 ? start - other.nodeSize : start + other.nodeSize;
  const tr = state.tr.delete(start, start + node.nodeSize);
  tr.insert(direction === -1 ? moved : start + other.nodeSize, node);
  tr.setSelection(
    selection instanceof NodeSelection
      ? NodeSelection.create(tr.doc, moved)
      : TextSelection.near(tr.doc.resolve(moved + (selection.from - start))),
  );
  view.dispatch(tr.scrollIntoView());
  return true;
}

const BlockMoves = Extension.create({
  name: 'blockMoves',
  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => moveBlock(this.editor, -1),
      'Alt-ArrowDown': () => moveBlock(this.editor, 1),
    };
  },
});

interface Block {
  readonly id: string;
  readonly title: string;
  /** What to type for it without the menu, shown at the row's end. */
  readonly shortcut?: string;
  readonly icon: LucideIcon;
  readonly group: 'Blocks' | 'Clauses';
  readonly words: string;
  readonly run: (editor: Editor, range: Range) => void;
}

const run = (editor: Editor, range: Range) =>
  editor.chain().focus().deleteRange(range);

/**
 * Every block the slash menu offers, in the order it lists them. A clause
 * that is void against consumers is never offered on a consumer's quote.
 */
function blocks(language: Language, consumer: boolean): readonly Block[] {
  const basics: Block[] = [
    {
      id: 'text',
      title: 'Text',
      icon: Pilcrow,
      group: 'Blocks',
      words: 'paragraph body',
      run: (e, r) => run(e, r).setParagraph().run(),
    },
    {
      id: 'h1',
      title: 'Heading 1',
      shortcut: '#',
      icon: Heading1,
      group: 'Blocks',
      words: 'title section',
      run: (e, r) => run(e, r).setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      title: 'Heading 2',
      shortcut: '##',
      icon: Heading2,
      group: 'Blocks',
      words: 'subtitle section',
      run: (e, r) => run(e, r).setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      title: 'Heading 3',
      shortcut: '###',
      icon: Heading3,
      group: 'Blocks',
      words: 'subsection',
      run: (e, r) => run(e, r).setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullets',
      title: 'Bulleted list',
      shortcut: '-',
      icon: List,
      group: 'Blocks',
      words: 'unordered points',
      run: (e, r) => run(e, r).toggleBulletList().run(),
    },
    {
      id: 'numbers',
      title: 'Numbered list',
      shortcut: '1.',
      icon: ListOrdered,
      group: 'Blocks',
      words: 'ordered steps',
      run: (e, r) => run(e, r).toggleOrderedList().run(),
    },
    {
      id: 'quote',
      title: 'Quote',
      shortcut: '>',
      icon: Quote,
      group: 'Blocks',
      words: 'blockquote aside callout',
      run: (e, r) => run(e, r).toggleBlockquote().run(),
    },
    {
      id: 'table',
      title: 'Table',
      icon: Table,
      group: 'Blocks',
      words: 'grid columns timeline',
      run: (e, r) =>
        run(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'divider',
      title: 'Divider',
      shortcut: '---',
      icon: Minus,
      group: 'Blocks',
      words: 'rule line separator',
      run: (e, r) => run(e, r).setHorizontalRule().run(),
    },
    {
      id: 'page',
      title: 'Page break',
      icon: SeparatorHorizontal,
      group: 'Blocks',
      words: 'new page',
      run: (e, r) => run(e, r).insertContent({ type: 'pageBreak' }).run(),
    },
  ];
  const conditions = clauses.flatMap((clause): Block[] => {
    const version = latestVersion(clause);
    if (consumer && version.audience === 'business') return [];
    return [
      {
        id: `clause-${clause.id}`,
        title: version.text[language].title,
        icon: Scale,
        group: 'Clauses',
        words: `clause condition ${clause.id} ${version.text.en.title} ${version.text.es.title}`,
        run: (e, r) => run(e, r).insertContent(clauseContent(clause)).run(),
      },
    ];
  });
  return [...basics, ...conditions];
}

/** A clause block for the library's latest version of `clause`. */
export const clauseContent = (clause: Clause) => ({
  type: 'clause',
  attrs: { id: clause.id, version: latestVersion(clause).version },
});

interface MenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const BlockMenu = forwardRef<MenuHandle, SuggestionProps<Block, Block>>(
  function BlockMenu({ items, command }, ref) {
    const [active, setActive] = useState(0);
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => setActive(0), [items]);
    useEffect(() => {
      list.current
        ?.querySelector('[data-active]')
        ?.scrollIntoView({ block: 'nearest' });
    }, [active]);
    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (!items.length) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          setActive(
            (current) => (current + step + items.length) % items.length,
          );
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = items[active];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));
    if (!items.length)
      return (
        <div className="iv-blockmenu" data-empty>
          No blocks match
        </div>
      );
    let group = '';
    return (
      <div
        className="iv-blockmenu"
        ref={list}
        role="listbox"
        aria-label="Blocks"
      >
        {items.map((item, index) => {
          const heading = item.group !== group ? item.group : null;
          group = item.group;
          const Icon = item.icon;
          return (
            <div key={item.id} role="presentation">
              {heading && <p className="iv-blockmenu-group">{heading}</p>}
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                onMouseMove={() => setActive(index)}
                onMouseDown={(event) => {
                  // Keep the editor's selection: the menu acts on it.
                  event.preventDefault();
                  command(item);
                }}
              >
                <Icon size={15} aria-hidden />
                <span>{item.title}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            </div>
          );
        })}
      </div>
    );
  },
);

const slashKey = new PluginKey('slashCommand');

/**
 * Closes the slash menu, if it is open. A modal around the editor hears
 * Escape before the editor does and cancels it, so it asks here instead.
 */
export function dismissMenus(editor: Editor) {
  exitSuggestion(editor.view, slashKey);
}

/**
 * `/` on an empty line opens the block menu; pasted slashes never do, and
 * a slash typed before existing words is only a slash.
 */
const SlashCommand = Extension.create<{
  language: Language;
  consumer: boolean;
}>({
  name: 'slashCommand',
  addOptions: () => ({ language: 'en', consumer: false }),
  addProseMirrorPlugins() {
    const all = blocks(this.options.language, this.options.consumer);
    return [
      Suggestion<Block, Block>({
        pluginKey: slashKey,
        editor: this.editor,
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const line = $from.parent.textContent;
          return /^\/\S*$/.test(line);
        },
        char: '/',
        startOfLine: true,
        // Inside the editor's own wrapper, not on the body: a modal studio
        // makes everything outside itself inert, and the menu would be too.
        container: '.iv-pages',
        allowSpaces: false,
        items: ({ query }) => {
          const wanted = query.toLowerCase();
          return all.filter((item) =>
            `${item.title} ${item.words}`.toLowerCase().includes(wanted),
          );
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<
            MenuHandle,
            SuggestionProps<Block, Block>
          > | null = null;
          let unmount: (() => void) | null = null;
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(BlockMenu, {
                props,
                editor: props.editor,
              });
              unmount = props.mount(renderer.element as HTMLElement);
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: ({ event, view }) => {
              if (event.key === 'Escape') {
                exitSuggestion(view, slashKey);
                return true;
              }
              return renderer?.ref?.onKeyDown(event) ?? false;
            },
            onExit: () => {
              unmount?.();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});

/** A placed clause, as a card: its words are the library's, not the owner's. */
function ClauseCard({
  node,
  selected,
  editor,
  getPos,
  extension,
}: NodeViewProps) {
  const language: Language = extension.options.language;
  const found = clauseVersion(
    String(node.attrs.id),
    Number(node.attrs.version),
  );
  const text = found?.text[language];
  const detach = () => {
    const at = getPos();
    if (!found || !text || at === undefined) return;
    // The words become the owner's own text, free to edit, and lose the
    // promise that they match a published clause.
    const body = markdownToJSON(text.body).content ?? [];
    editor
      .chain()
      .focus()
      .insertContentAt({ from: at, to: at + node.nodeSize }, [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: text.title }],
        },
        ...body,
      ])
      .run();
  };
  return (
    <NodeViewWrapper
      className={cn('iv-clause', selected && 'iv-clause-selected')}
      data-drag-handle
    >
      {found && text ? (
        <>
          <p className="iv-clause-title">{text.title}</p>
          {text.body.split(/\n{2,}/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="iv-clause-foot">
            <span>{found.source}</span>
            {found.audience === 'business' && (
              <span>Business customers only</span>
            )}
          </p>
          {editor.isEditable && (
            <button
              type="button"
              className="iv-clause-detach"
              onClick={detach}
              contentEditable={false}
            >
              Edit as text
            </button>
          )}
        </>
      ) : (
        <p className="iv-clause-title">This clause is not in the library.</p>
      )}
    </NodeViewWrapper>
  );
}

const ClauseView = ClauseBlock.extend<{ language: Language }>({
  addOptions: () => ({ language: 'en' }),
  addNodeView() {
    return ReactNodeViewRenderer(ClauseCard);
  },
});

/** The page schema's extensions, with the editor's behaviour on top. */
function editorExtensions(language: Language, consumer: boolean) {
  // Each language sets quotations in its own marks: Spanish in angle quotes.
  const t = translate(language);
  const quotes = {
    openDoubleQuote: t(m.typography_open_quote),
    closeDoubleQuote: t(m.typography_close_quote),
  };
  return [
    ...pageExtensions.map((extension) =>
      extension === ClauseBlock
        ? ClauseView.configure({ language })
        : extension,
    ),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'heading'
          ? 'Heading'
          : 'Write, or type / for blocks and clauses',
    }),
    Typography.configure(quotes),
    SlashCommand.configure({ language, consumer }),
    BlockMoves,
  ];
}

/** Turns a typed address into a link the PDF can open, or null. */
function linkTarget(typed: string): string | null {
  const value = typed.trim();
  if (!value) return null;
  if (linkable.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^[^\s]+\.[^\s]+$/.test(value)) return `https://${value}`;
  return null;
}

/** The bar over a text selection: marks, headings and links. */
function FormatBar({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      link: current.isActive('link'),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      href: String(current.getAttributes('link').href ?? ''),
    }),
  });
  const apply = () => {
    const target = linkTarget(href);
    const chain = editor.chain().focus().extendMarkRange('link');
    (target ? chain.setLink({ href: target }) : chain.unsetLink()).run();
    setLinking(false);
  };
  const mark = (
    label: string,
    active: boolean,
    Icon: LucideIcon,
    toggle: () => void,
  ) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={toggle}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
  return (
    <BubbleMenu
      editor={editor}
      className="iv-formatbar"
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: current, state: view }) =>
        current.isEditable &&
        !view.selection.empty &&
        !(view.selection instanceof NodeSelection)
      }
    >
      {linking ? (
        <form
          className="iv-formatbar-link"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the field opens on purpose, from the link button, to take the address at once.
            autoFocus
            aria-label="Link address"
            placeholder="example.com or name@example.com"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setLinking(false);
                editor.commands.focus();
              }
            }}
          />
        </form>
      ) : (
        <>
          {mark('Bold', state.bold, Bold, () =>
            editor.chain().focus().toggleBold().run(),
          )}
          {mark('Italic', state.italic, Italic, () =>
            editor.chain().focus().toggleItalic().run(),
          )}
          {mark('Underline', state.underline, Underline, () =>
            editor.chain().focus().toggleUnderline().run(),
          )}
          <span className="iv-formatbar-rule" aria-hidden />
          {mark('Heading 2', state.h2, Heading2, () =>
            editor.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {mark('Heading 3', state.h3, Heading3, () =>
            editor.chain().focus().toggleHeading({ level: 3 }).run(),
          )}
          <span className="iv-formatbar-rule" aria-hidden />
          {state.link
            ? mark('Remove link', true, Unlink, () =>
                editor
                  .chain()
                  .focus()
                  .extendMarkRange('link')
                  .unsetLink()
                  .run(),
              )
            : mark('Link', false, Link2, () => {
                setHref(state.href);
                setLinking(true);
              })}
        </>
      )}
    </BubbleMenu>
  );
}

/**
 * The pages, editable or read-only. `onChange` hears valid pages a moment
 * after the owner stops typing, and once more when the editor goes away,
 * so a change made just before closing is never lost.
 */
export function PagesEditor({
  pages,
  language,
  consumer,
  editable,
  onChange,
  onEditor,
}: {
  pages: Pages;
  language: Language;
  /** The quote is for a consumer: business-only clauses are not offered. */
  consumer: boolean;
  editable: boolean;
  onChange: (pages: Pages) => void;
  onEditor?: (editor: Editor | null) => void;
}) {
  const initial = useMemo(() => toJSONContent(readPages(pages)), []);
  const extensions = useMemo(
    () => editorExtensions(language, consumer),
    [language, consumer],
  );
  const timer = useRef<number | null>(null);
  const pending = useRef<Editor | null>(null);
  const report = useRef(onChange);
  report.current = onChange;
  const flush = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const source = pending.current;
    pending.current = null;
    if (!source) return;
    const next = pagesFrom(source.getJSON());
    if (Result.isSuccess(next)) report.current(next.success);
  };
  const editor = useEditor(
    {
      extensions,
      content: initial,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: 'iv-prose',
          lang: language,
          'aria-label': 'Pages',
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor: current }) => {
        pending.current = current;
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 300);
      },
    },
    [extensions],
  );
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);
  useEffect(() => () => flush(), []);
  if (!editor) return null;
  return (
    <div className="iv-pages">
      <EditorContent editor={editor} />
      <FormatBar editor={editor} />
    </div>
  );
}
