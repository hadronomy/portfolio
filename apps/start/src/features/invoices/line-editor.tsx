import { formatMoney } from '@portfolio/invoices/calculate';
import type { Currency, Language, Line } from '@portfolio/invoices/model';
import { useHotkey } from '@tanstack/react-hotkeys';
import { ChevronDown, Copy, Trash2 } from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import { memo, useId, useRef, useState } from 'react';
import {
  currencySymbol,
  igicRates,
  lineKinds,
  treatments,
} from '~/features/invoices/choices';
import { AmountField } from '~/features/invoices/smart-fields';
import { Button, cn, Field, MorphText, Select } from '~/features/invoices/ui';
import { appHotkeys, useHotkeyProps } from '~/lib/hotkeys';

type LineEditorProps = {
  /** Just created: its description takes focus. */
  fresh: boolean;
  line: Line;
  index: number;
  /** The one line whose editor is showing. */
  open: boolean;
  disabled: boolean;
  /** Net amount from the shared calculator, or null while a value is incomplete. */
  net: string | null;
  language: Language;
  currency: Currency;
  onToggle: () => void;
  onChange: (line: Line) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (offset: number) => void;
  /** A drag finished: the order it left behind is the one to keep. */
  onDrop: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

/** "2 days × €450.00 · IGIC 7%": the line's arithmetic in one glance. */
function summarise(line: Line, language: Language, currency: Currency) {
  const quantity = `${line.quantity || '0'}${line.unit && line.unit !== 'unit' ? ` ${line.unit}` : ''}`;
  const price = formatMoney(line.unitPrice || '0', language, currency);
  const tax =
    line.tax.treatment === 'taxable'
      ? `IGIC ${line.tax.rate}%`
      : (treatments.find(([key]) => key === line.tax.treatment)?.[1] ?? '');
  const off = Number(line.discount.value)
    ? `−${line.discount.kind === 'percent' ? `${line.discount.value}%` : formatMoney(line.discount.value, language, currency)}`
    : null;
  return [`${quantity} × ${price}`, off, tax].filter(Boolean).join(' · ');
}

/**
 * One invoice line. At rest it is a single row that reads like the line on
 * the PDF: what, how it adds up, and what it comes to. Opening it turns the
 * row into its editor. The row is also the handle: drag it to reorder, or
 * use Alt+↑ and Alt+↓ from the keyboard.
 */
export const LineEditor = memo(function LineEditor({
  fresh,
  line,
  index,
  open,
  disabled,
  net,
  language,
  currency,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onDrop,
}: LineEditorProps) {
  const panel = useId();
  const controls = useDragControls();
  const head = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  // A drag ends with a click on the row it started from; that click must not
  // also open or close the line.
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [more, setMore] = useState(false);
  const note = line.kind === 'note';
  const title = line.description.trim().split('\n')[0];
  const amount = net === null ? '—' : formatMoney(net, language, currency);
  const needsReason = line.tax.treatment !== 'taxable' || !!line.tax.reason;

  const move = (by: -1 | 1) => {
    onMove(by);
    // The row moved under the focus; keep it in view at its new place.
    requestAnimationFrame(() =>
      head.current?.scrollIntoView({ block: 'nearest' }),
    );
  };
  const moveKeys = useHotkeyProps(
    appHotkeys['line.up'],
    appHotkeys['line.down'],
  );
  useHotkey(appHotkeys['line.up'], () => move(-1), {
    target: head,
    enabled: !disabled,
  });
  useHotkey(appHotkeys['line.down'], () => move(1), {
    target: head,
    enabled: !disabled,
  });
  // Esc from anywhere inside the open line closes it, unless a select or
  // suggestion in it used the Esc first.
  useHotkey(
    appHotkeys['line.close'],
    (event) => {
      if (event.defaultPrevented) return;
      if (!clip.current?.contains(event.target as Node)) return;
      event.preventDefault();
      onToggle();
      head.current?.focus();
    },
    { enabled: open },
  );

  return (
    // Layout carries the row to its new slot when lines reorder or a
    // neighbour opens, closes, or leaves. A new line grows in from 0.98,
    // never from nothing, and leaves faster than it came.
    <Reorder.Item
      as="section"
      ref={root}
      value={line.id}
      className="iv-line"
      data-open={open}
      data-dragging={dragging || undefined}
      dragListener={false}
      dragControls={controls}
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: 0.25, ease },
      }}
      exit={{
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.15, ease },
      }}
      whileDrag={{ scale: 1.015 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
      onDragStart={() => {
        dragged.current = true;
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDrop();
      }}
      aria-label={note ? 'Note' : `Item ${index + 1}`}
    >
      <button
        ref={head}
        type="button"
        className="iv-line-head"
        aria-expanded={open}
        aria-controls={panel}
        {...(disabled ? {} : moveKeys)}
        // The move keys work from this button alone, so their hint shows
        // only while it has the focus.
        data-hotkey-scope
        onPointerDown={(event) => {
          dragged.current = false;
          if (!disabled && event.button === 0) controls.start(event);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onToggle();
          if (open) return;
          // Once the editor has grown, bring what fell below the fold into
          // view; 'nearest' leaves a line that already fits alone.
          window.setTimeout(
            () =>
              root.current?.scrollIntoView({
                block: 'nearest',
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
              }),
            260,
          );
        }}
      >
        <span className="iv-line-text">
          {open ? (
            <span className="iv-line-index">
              {note ? 'Note' : `Item ${index + 1}`}
            </span>
          ) : (
            <>
              <span
                className={cn('iv-line-title', !title && 'iv-line-untitled')}
              >
                {title || (note ? 'Empty note' : 'Untitled item')}
              </span>
              {!note && (
                <span className="iv-line-meta">
                  {summarise(line, language, currency)}
                </span>
              )}
            </>
          )}
        </span>
        {!note && (
          <strong className="iv-line-net">
            <MorphText>{amount}</MorphText>
          </strong>
        )}
      </button>
      <div className="iv-line-panel" id={panel} data-open={open}>
        <div ref={clip} className="iv-line-clip" inert={!open}>
          <div className="iv-line-body">
            <Field
              label="Description"
              value={line.description}
              disabled={disabled}
              onChange={(description) => onChange({ ...line, description })}
              placeholder={
                note ? 'A note printed across the table' : 'What was delivered'
              }
              autoFocus={fresh}
              multiline
            />
            {!note && (
              <div className="iv-line-figures">
                <AmountField
                  label="Qty"
                  value={line.quantity}
                  disabled={disabled}
                  {...(line.unit && line.unit !== 'unit'
                    ? { unit: line.unit }
                    : {})}
                  onChange={(quantity) => onChange({ ...line, quantity })}
                />
                <span className="iv-line-times" aria-hidden>
                  ×
                </span>
                <AmountField
                  label="Unit price"
                  value={line.unitPrice}
                  disabled={disabled}
                  unit={currencySymbol(currency)}
                  step={10}
                  onChange={(unitPrice) => onChange({ ...line, unitPrice })}
                />
                <Select
                  label="IGIC"
                  value={line.tax.treatment === 'taxable' ? line.tax.rate : '0'}
                  disabled={disabled || line.tax.treatment !== 'taxable'}
                  onChange={(rate) =>
                    onChange({ ...line, tax: { ...line.tax, rate } })
                  }
                  options={igicRates}
                  context="Canary Islands"
                />
              </div>
            )}
            <div className="iv-line-options" data-open={more}>
              <div inert={!more}>
                <div className="iv-grid">
                  <Select
                    label="Kind"
                    value={line.kind}
                    disabled={disabled}
                    onChange={(kind) => onChange({ ...line, kind })}
                    options={lineKinds}
                  />
                  {!note && (
                    <>
                      {/* "unit" is the model's word for no unit: it prints
                          nothing, so the field shows nothing either. */}
                      <Field
                        label="Unit"
                        placeholder="hour, day, month"
                        value={line.unit === 'unit' ? '' : line.unit}
                        disabled={disabled}
                        onChange={(unit) =>
                          onChange({
                            ...line,
                            unit: unit.trim() ? unit : 'unit',
                          })
                        }
                      />
                      <Select
                        label="Tax treatment"
                        value={line.tax.treatment}
                        disabled={disabled}
                        onChange={(treatment) =>
                          onChange({
                            ...line,
                            tax: {
                              ...line.tax,
                              treatment,
                              rate: treatment === 'taxable' ? '7' : '0',
                            },
                          })
                        }
                        options={treatments}
                      />
                      <AmountField
                        label="Discount"
                        value={line.discount.value}
                        disabled={disabled}
                        unit={
                          line.discount.kind === 'percent'
                            ? '%'
                            : currencySymbol(currency)
                        }
                        unitSwitch={{
                          label:
                            line.discount.kind === 'percent'
                              ? 'Switch to a fixed amount'
                              : 'Switch to a percentage',
                          onSwitch: () =>
                            onChange({
                              ...line,
                              discount: {
                                ...line.discount,
                                kind:
                                  line.discount.kind === 'percent'
                                    ? 'amount'
                                    : 'percent',
                              },
                            }),
                        }}
                        onChange={(value) =>
                          onChange({
                            ...line,
                            discount: { ...line.discount, value },
                          })
                        }
                      />
                      {/* Only an untaxed line needs its legal basis printed. */}
                      {needsReason && (
                        <Field
                          className="iv-span"
                          label="Legal basis or exemption reason"
                          value={line.tax.reason}
                          disabled={disabled}
                          onChange={(reason) =>
                            onChange({ ...line, tax: { ...line.tax, reason } })
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="iv-line-foot">
              <button
                type="button"
                className="iv-line-more"
                aria-expanded={more}
                onClick={() => setMore(!more)}
              >
                <span>{more ? 'Fewer options' : 'More options'}</span>
                <ChevronDown size={13} />
              </button>
              {!disabled && (
                <div className="iv-line-tools">
                  <Button size="sm" variant="ghost" onClick={onDuplicate}>
                    <Copy size={13} />
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="iv-line-delete"
                    onClick={onRemove}
                  >
                    <Trash2 size={13} />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
});
