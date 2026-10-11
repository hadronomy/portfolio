import { clauses, latestVersion } from '@portfolio/invoices/clauses';
import type { InvoiceData, Language } from '@portfolio/invoices/model';
import type { Pages } from '@portfolio/invoices/pages';
import { quoteNotices } from '@portfolio/invoices/quote-notices';
import * as Dialog from '@radix-ui/react-dialog';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { clauseContent, dismissMenus, PagesEditor } from './pages-editor';
import { Button, cn, layer, MorphText } from './ui';

// The room where a quote's pages are written. The sheet is the page the
// PDF prints, at its own proportions and type, so what the owner writes is
// what the customer reads. The rail beside it keeps the shape of the
// document in view: its headings, the clauses it can place, and the
// notices every quote for this customer prints on its own.

/** The view-transition name the pages card and the studio share. */
export const pagesMorph = 'pages-studio';

/** What the editor holds now: its headings, the clauses it places, its length. */
function useShape(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const headings: { text: string; level: number; at: number }[] = [];
      const placed = new Set<string>();
      let words = 0;
      current?.state.doc.descendants((node, at) => {
        if (node.type.name === 'heading')
          headings.push({
            text: node.textContent,
            level: Number(node.attrs.level),
            at,
          });
        if (node.type.name === 'clause') placed.add(String(node.attrs.id));
        if (node.isText)
          words += node.text?.split(/\s+/).filter(Boolean).length ?? 0;
        return true;
      });
      return { headings, placed: [...placed].join(' '), words };
    },
  });
}
type Shape = NonNullable<ReturnType<typeof useShape>>;

function Outline({
  editor,
  shape,
}: {
  editor: Editor | null;
  shape: Shape | null;
}) {
  const headings = shape?.headings ?? [];
  return (
    <section className="iv-rail-group">
      <h3>Outline</h3>
      {headings.length === 0 ? (
        <p className="iv-rail-empty">
          Headings appear here. Type # and a space to start one.
        </p>
      ) : (
        <ol className="iv-outline">
          {headings.map((heading) => (
            <li key={heading.at} data-level={heading.level}>
              <button
                type="button"
                onClick={() => {
                  if (!editor) return;
                  editor
                    .chain()
                    .focus()
                    .setTextSelection(heading.at + 1)
                    .scrollIntoView()
                    .run();
                }}
              >
                {heading.text || 'Untitled heading'}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ClauseLibrary({
  editor,
  shape,
  language,
  consumer,
  editable,
}: {
  editor: Editor | null;
  shape: Shape | null;
  language: Language;
  consumer: boolean;
  editable: boolean;
}) {
  const placed = new Set((shape?.placed ?? '').split(' '));
  return (
    <section className="iv-rail-group">
      <h3>Clauses</h3>
      <ul className="iv-clauses">
        {clauses.map((clause) => {
          const version = latestVersion(clause);
          const text = version.text[language];
          // A term that is void against consumers is never offered to one.
          const barred = consumer && version.audience === 'business';
          const here = placed.has(clause.id);
          return (
            <li key={clause.id} data-placed={here || undefined}>
              <button
                type="button"
                disabled={!editable || barred || !editor}
                onClick={() => {
                  if (!editor) return;
                  if (here) {
                    let found: number | null = null;
                    editor.state.doc.descendants((node, at) => {
                      if (
                        found === null &&
                        node.type.name === 'clause' &&
                        node.attrs.id === clause.id
                      )
                        found = at;
                      return found === null;
                    });
                    if (found !== null)
                      editor
                        .chain()
                        .focus()
                        .setNodeSelection(found)
                        .scrollIntoView()
                        .run();
                    return;
                  }
                  editor
                    .chain()
                    .focus()
                    .insertContent(clauseContent(clause))
                    .run();
                }}
              >
                <span className="iv-clauses-title">{text.title}</span>
                <span className="iv-clauses-source">
                  {barred ? 'Business customers only' : version.source}
                </span>
                <span className="iv-clauses-mark" aria-hidden>
                  {here ? <Check size={14} /> : <Plus size={14} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Notices({ data }: { data: InvoiceData }) {
  if (!data.quote) return null;
  const notices = quoteNotices(data, data.quote, data.language);
  return (
    <section className="iv-rail-group">
      <h3>Printed with every quote</h3>
      <p className="iv-rail-empty">
        The law asks for these, for a {data.customerType} customer. They print
        after your pages, and you cannot leave one out.
      </p>
      <ul className="iv-notices">
        {notices.map((notice) => (
          <li key={notice.id}>
            <span>{notice.title}</span>
            <small>{notice.source}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PagesStudio({
  open,
  onClose,
  pages,
  data,
  number,
  editable,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  pages: Pages;
  /** The quote as it stands, for its language, customer and notices. */
  data: InvoiceData;
  number: string | null;
  editable: boolean;
  onChange: (pages: Pages) => void;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const shape = useShape(editor);
  const words = shape?.words ?? 0;
  const t = data.language === 'es' ? 'Presupuesto' : 'Quote';
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          className={cn(layer, 'iv-studio')}
          data-studio="pages"
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            // The dialog hears Escape first. While the slash menu or the link
            // field is open, Escape is theirs: it closes them, not the studio.
            if (document.querySelector('.iv-blockmenu')) {
              event.preventDefault();
              if (editor) dismissMenus(editor);
            } else if (document.querySelector('.iv-formatbar-link'))
              event.preventDefault();
          }}
          style={{ viewTransitionName: pagesMorph } as CSSProperties}
        >
          <header className="iv-studio-head">
            <Dialog.Close asChild>
              <button type="button" className="iv-studio-back">
                <ArrowLeft size={16} aria-hidden />
                <span>Quote</span>
              </button>
            </Dialog.Close>
            <div className="iv-studio-title">
              <Dialog.Title>Pages</Dialog.Title>
              <p>
                {[data.title, number ?? 'Draft', data.customer.name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <output className="iv-studio-saved" aria-live="polite">
              <span className="iv-num">
                <MorphText>{`${words} ${words === 1 ? 'word' : 'words'}`}</MorphText>
              </span>
            </output>
          </header>
          <div className="iv-studio-body">
            <nav className="iv-studio-rail" aria-label="Outline and clauses">
              <Outline editor={editor} shape={shape} />
              <ClauseLibrary
                editor={editor}
                shape={shape}
                language={data.language}
                consumer={data.customerType === 'consumer'}
                editable={editable}
              />
              <Notices data={data} />
            </nav>
            <main className="iv-desk">
              <article className="iv-sheet" lang={data.language}>
                <p className="iv-sheet-running" aria-hidden>
                  <span>{data.issuer.name}</span>
                  <span>
                    {t} {number ?? ''}
                  </span>
                </p>
                <PagesEditor
                  pages={pages}
                  language={data.language}
                  consumer={data.customerType === 'consumer'}
                  editable={editable}
                  onChange={onChange}
                  onEditor={setEditor}
                />
              </article>
              <div className="iv-studio-bar" role="toolbar" aria-label="Pages">
                <p className="iv-studio-bar-hint">
                  {editable ? (
                    <>
                      <kbd>/</kbd> blocks and clauses · <kbd>⌥</kbd>
                      <kbd>↑</kbd>
                      <kbd>↓</kbd> move a block
                    </>
                  ) : (
                    'Issued quotes do not change. Revise it to write a new version.'
                  )}
                </p>
                <span className="iv-studio-bar-rule" aria-hidden />
                <Button size="sm" variant="primary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
