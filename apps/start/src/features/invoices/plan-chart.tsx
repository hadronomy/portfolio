import { formatMoney } from '@portfolio/invoices/calculate';
import type { Laid, Part, PaymentPlan, Terms } from '@portfolio/invoices/plan';
import { curveStepAfter } from '@visx/curve';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Area } from '@/components/charts/area';
import { ComposedChart } from '@/components/charts/composed-chart';
import { ReferenceArea } from '@/components/charts/reference-area';
import { SeriesBar } from '@/components/charts/series-bar';
import { ChartTooltip } from '@/components/charts/tooltip';
import '@/components/charts/charts.css';
import { fromCents, toCents } from './money';
import { type LaidPart, movable, moveSeam, seamStep } from './plan-edit';
import { shortDate } from './plan-words';
import { MorphText } from './ui';

// Two drawings of the same plan. The strip is the money: one segment per
// part, to scale, with seams the owner drags to move money between
// neighbours. The chart is the calendar: each payment a bar standing on
// its date, as tall as its amount, over a quiet step of what has been paid
// by then. The part under the pointer lights up in both, and in its
// sentence.

/** What the owner calls a payment: its part's name, or its place. */
export function paymentName(payment: Laid, index: number, count: number) {
  if (payment.label && payment.step)
    return `${payment.label} · ${payment.step.index + 1} of ${payment.step.of}`;
  return payment.label || `Payment ${index + 1} of ${count}`;
}

const day = 86_400_000;
const time = (date: string) => Date.parse(`${date}T12:00:00Z`);
const tone = (index: number) => `var(--part-${index % 6})`;

export function PlanStrip({
  plan,
  terms,
  parts,
  hot,
  onHot,
  onChange,
}: {
  plan: PaymentPlan;
  terms: Terms;
  parts: readonly LaidPart[];
  hot: Part['id'] | null;
  onHot: (part: Part['id'] | null) => void;
  onChange: (plan: PaymentPlan) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  // The seam in hand, and how far from its centre it was picked up, so it
  // never jumps to the pointer.
  const [drag, setDrag] = useState<{ index: number; offset: number } | null>(
    null,
  );
  const total = toCents(terms.total);
  const shares = parts.map((item) => Math.max(item.cents, 0));
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  const starts = shares.map((_, index) =>
    shares.slice(0, index).reduce((a, b) => a + b, 0),
  );
  const at = (cents: number) => (cents * 100) / sum;
  const percent = (cents: number) =>
    total ? Math.round((cents * 100) / total) : 0;
  const money = (cents: number) =>
    formatMoney(fromCents(Math.max(cents, 0)), 'en', terms.currency);

  const place = (index: number, clientX: number, offset: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box?.width) return;
    const raw = ((clientX - offset - box.left) / box.width) * sum;
    const step = seamStep(plan, terms, index);
    const next = moveSeam(plan, terms, index, Math.round(raw / step) * step);
    if (JSON.stringify(next.parts) !== JSON.stringify(plan.parts))
      onChange(next);
  };
  const nudge = (index: number, event: KeyboardEvent<HTMLSpanElement>) => {
    const by = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[
      event.key
    ];
    if (!by) return;
    event.preventDefault();
    const step = seamStep(plan, terms, index) * (event.shiftKey ? 10 : 1);
    const seam = (starts[index] ?? 0) + (shares[index] ?? 0);
    onChange(moveSeam(plan, terms, index, seam + by * step));
  };

  return (
    <div
      className="iv-strip"
      data-dragging={drag ? true : undefined}
      onPointerLeave={() => !drag && onHot(null)}
    >
      <div className="iv-strip-track" ref={track}>
        {parts.map((item, index) => (
          <span
            key={item.part.id}
            className="iv-strip-part"
            data-index={index % 6}
            data-first={index === 0 || undefined}
            data-last={index === parts.length - 1 || undefined}
            data-rest={item.part.portion._tag === 'Rest' || undefined}
            data-hot={hot === item.part.id || undefined}
            data-invalid={item.cents <= 0 || undefined}
            style={
              {
                '--start': `${at(starts[index] ?? 0)}%`,
                '--size': `${at(shares[index] ?? 0)}%`,
              } as CSSProperties
            }
            onPointerEnter={() => !drag && onHot(item.part.id)}
          >
            {item.part._tag === 'Series' &&
              item.payments.slice(1).map((payment, step) => (
                <i
                  key={payment.id}
                  className="iv-strip-tick"
                  style={{
                    left: `${((step + 1) * 100) / item.payments.length}%`,
                  }}
                />
              ))}
            <span className="iv-strip-label iv-num">
              <b>{percent(shares[index] ?? 0)}%</b>
              <small>{money(shares[index] ?? 0)}</small>
            </span>
          </span>
        ))}
        {parts.slice(0, -1).map((item, index) => {
          if (!movable(plan, index)) return null;
          const seam = (starts[index] ?? 0) + (shares[index] ?? 0);
          const held = drag?.index === index;
          return (
            <span
              key={item.part.id}
              role="slider"
              tabIndex={0}
              className="iv-strip-seam"
              data-active={held || undefined}
              data-edge={
                at(seam) < 18 ? 'start' : at(seam) > 82 ? 'end' : undefined
              }
              style={{ left: `${at(seam)}%` }}
              aria-label={`Split between ${item.part.label || `payment ${index + 1}`} and ${parts[index + 1]?.part.label || `payment ${index + 2}`}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent(seam)}
              aria-valuetext={`${money(shares[index] ?? 0)} before, ${money(shares[index + 1] ?? 0)} after`}
              onKeyDown={(event) => nudge(index, event)}
              onPointerDown={(event: PointerEvent<HTMLSpanElement>) => {
                if (event.button !== 0) return;
                event.preventDefault();
                const box = event.currentTarget.getBoundingClientRect();
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.focus();
                setDrag({
                  index,
                  offset: event.clientX - (box.left + box.width / 2),
                });
                onHot(item.part.id);
              }}
              onPointerMove={(event) => {
                if (held && drag) place(index, event.clientX, drag.offset);
              }}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
              onLostPointerCapture={() => setDrag(null)}
            >
              <i className="iv-strip-grip" aria-hidden />
              {held && (
                <span className="iv-strip-readout iv-num" aria-hidden>
                  <span>{money(shares[index] ?? 0)}</span>
                  <i />
                  <span>{money(shares[index + 1] ?? 0)}</span>
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="iv-strip-ruler iv-num" aria-hidden>
        {[0, 25, 50, 75, 100].map((mark) => (
          <span key={mark} style={{ left: `${mark}%` }}>
            {mark}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** A day the chart stands a bar on: what each part asks then, in money. */
type Row = Record<string, unknown> & {
  date: Date;
  paid: number;
  payments: readonly Laid[];
};

const margin = { top: 28, right: 14, bottom: 30, left: 14 };

/**
 * The calendar the customer gets, as bklit's composed chart: a bar per day
 * with payments, stacked by part on the days that have several, over a step
 * that climbs to the total as the customer pays. Days past the invoice's
 * due date are lined, as everywhere else in the studio that marks what is
 * past a limit.
 */
function PlanChart({
  terms,
  payments,
  parts,
  hot,
  onHot,
}: {
  terms: Terms;
  payments: readonly Laid[];
  parts: readonly LaidPart[];
  hot: Part['id'] | null;
  onHot: (part: Part['id'] | null) => void;
}) {
  const year = terms.issueDate.slice(0, 4);
  const indexOf = new Map(parts.map((item, index) => [item.part.id, index]));
  const total = toCents(terms.total);
  const days = new Map<string, Laid[]>();
  for (const payment of payments)
    days.set(payment.date, [...(days.get(payment.date) ?? []), payment]);
  const dates = [...days.keys()];
  const first = Math.min(time(terms.issueDate), ...dates.map(time));
  const last = Math.max(time(terms.dueDate), ...dates.map(time));
  // A margin of days either side, so the first and last bars stand whole
  // and the step starts from nothing and ends at the total.
  const pad = Math.max(3 * day, (last - first) * 0.08);
  const zero = Object.fromEntries(parts.map((_, index) => [`p${index}`, 0]));
  let paid = 0;
  const rows: Row[] = [
    { ...zero, date: new Date(first - pad), paid: 0, payments: [] },
    ...[...days.entries()].map(([date, group]) => {
      const row: Row = {
        ...zero,
        date: new Date(time(date)),
        paid: 0,
        payments: group,
      };
      for (const payment of group) {
        const key = `p${indexOf.get(payment.part) ?? 0}`;
        row[key] =
          (row[key] as number) + Math.max(toCents(payment.amount), 0) / 100;
        paid += Math.max(toCents(payment.amount), 0);
      }
      row.paid = paid / 100;
      return row;
    }),
    { ...zero, date: new Date(last + pad), paid: paid / 100, payments: [] },
  ];
  const domain = [first - pad, last + pad] as const;
  const along = (at: number) => (at - domain[0]) / (domain[1] - domain[0]);
  const due = along(time(terms.dueDate));
  // A label at the start of each month, or of every third or sixth on a
  // long plan; none so near an edge that it would spill out of the plot.
  const months: { key: string; x: number; label: string }[] = [];
  const cursor = new Date(domain[0]);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  const spanMonths = (domain[1] - domain[0]) / (30.44 * day);
  const every = spanMonths > 18 ? 6 : spanMonths > 9 ? 3 : 1;
  while (cursor.getTime() < domain[1]) {
    const x = along(cursor.getTime());
    if (cursor.getUTCMonth() % every === 0 && x > 0.05 && x < 0.95)
      months.push({
        key: cursor.toISOString(),
        x,
        label: new Intl.DateTimeFormat('en-GB', {
          month: 'short',
          ...(cursor.getUTCMonth() === 0 ? { year: '2-digit' } : {}),
          timeZone: 'UTC',
        }).format(cursor),
      });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const frame = {
    '--left': `${margin.left}px`,
    '--right': `${margin.right}px`,
    '--top': `${margin.top}px`,
    '--bottom': `${margin.bottom}px`,
  } as CSSProperties;
  const money = (amount: number) =>
    formatMoney(fromCents(Math.round(amount * 100)), 'en', terms.currency);

  return (
    <div
      className="iv-chart"
      role="img"
      aria-label={`${payments.length} payments between ${shortDate(payments[0]?.date ?? terms.issueDate, year)} and ${shortDate(payments.at(-1)?.date ?? terms.issueDate, year)}`}
    >
      <ComposedChart
        data={rows}
        xDataKey="date"
        aspectRatio="16 / 10"
        margin={margin}
        stacked
        stackGap={2}
        maxBarSize={16}
        barGap={0}
        animationDuration={600}
      >
        <ReferenceArea
          x1={new Date(time(terms.dueDate))}
          pattern="diagonal"
          patternColor="rgb(20 20 20 / 0.1)"
          patternScale={1.2}
          patternStrokeWidth={0.75}
          strokeWidth={0}
          fadeEdges={false}
        />
        <Area
          dataKey="paid"
          yAxisId="paid"
          curve={curveStepAfter}
          fill="var(--part-0)"
          fillOpacity={0.07}
          gradientToOpacity={0.01}
          stroke="rgb(20 20 20 / 0.42)"
          strokeWidth={1.25}
          showHighlight={false}
        />
        {parts.map((item, index) => (
          <SeriesBar
            key={item.part.id}
            dataKey={`p${index}`}
            fill={
              hot && hot !== item.part.id
                ? `color-mix(in oklab, ${tone(index)} 22%, white)`
                : tone(index)
            }
            radius={6}
            fadedOpacity={0.22}
          />
        ))}
        <ChartTooltip
          showDatePill={false}
          showDots={false}
          indicatorColor="var(--iv-ink-3)"
          indicatorDasharray="3,3"
          content={({ point }) => (
            <ChartTip
              row={point as Row}
              total={total}
              terms={terms}
              payments={payments}
              indexOf={indexOf}
              money={money}
              onHot={onHot}
            />
          )}
        />
      </ComposedChart>
      <i className="iv-chart-base" style={frame} aria-hidden />
      <span
        className="iv-chart-due"
        data-side={due > 0.72 ? 'left' : undefined}
        style={{ ...frame, '--x': due } as CSSProperties}
      >
        <small>Due {shortDate(terms.dueDate, year)}</small>
      </span>
      <div className="iv-chart-axis iv-num" style={frame} aria-hidden>
        {months.map((month) => (
          <span key={month.key} style={{ '--x': month.x } as CSSProperties}>
            {month.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartTip({
  row,
  total,
  terms,
  payments,
  indexOf,
  money,
  onHot,
}: {
  row: Row;
  total: number;
  terms: Terms;
  payments: readonly Laid[];
  indexOf: ReadonlyMap<Part['id'], number>;
  money: (amount: number) => string;
  onHot: (part: Part['id'] | null) => void;
}) {
  const group = row.payments ?? [];
  const lead = group[0]?.part ?? null;
  // The bar under the pointer lights its part in the strip and sentences.
  useEffect(() => {
    onHot(lead);
    return () => onHot(null);
  }, [lead, onHot]);
  const year = terms.issueDate.slice(0, 4);
  const share = total ? Math.round((row.paid * 10000) / total) : 0;
  if (!group.length)
    return (
      <div className="iv-chart-tip">
        <p>{row.paid > 0 ? 'Paid in full' : 'Nothing paid yet'}</p>
      </div>
    );
  return (
    <div className="iv-chart-tip">
      <p className="iv-num">
        {shortDate(group[0]?.date ?? terms.issueDate, year)}
      </p>
      <ul>
        {group.map((payment) => (
          <li
            key={payment.id}
            style={
              {
                '--swatch': tone(indexOf.get(payment.part) ?? 0),
              } as CSSProperties
            }
          >
            <span>
              {paymentName(
                payment,
                payments.findIndex((item) => item.id === payment.id),
                payments.length,
              )}
            </span>
            <b className="iv-num">
              {formatMoney(payment.amount, 'en', terms.currency)}
            </b>
          </li>
        ))}
      </ul>
      <p className="iv-chart-tip-paid iv-num">
        {money(row.paid)} paid · {share}%
      </p>
    </div>
  );
}

export function PlanTimeline({
  terms,
  payments,
  parts,
  hot,
  onHot,
}: {
  terms: Terms;
  payments: readonly Laid[];
  parts: readonly LaidPart[];
  hot: Part['id'] | null;
  onHot: (part: Part['id'] | null) => void;
}) {
  const year = terms.issueDate.slice(0, 4);
  const money = (amount: string) => formatMoney(amount, 'en', terms.currency);
  const indexOf = new Map(parts.map((item, index) => [item.part.id, index]));
  const byMonth = new Map<string, { payment: Laid; index: number }[]>();
  payments.forEach((payment, index) => {
    const key = payment.date.slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), { payment, index }]);
  });
  const span = Math.round(
    (time(payments.at(-1)?.date ?? terms.issueDate) - time(terms.issueDate)) /
      (30.44 * day),
  );

  return (
    <div className="iv-timeline" onPointerLeave={() => onHot(null)}>
      <PlanChart
        terms={terms}
        payments={payments}
        parts={parts}
        hot={hot}
        onHot={onHot}
      />
      <div className="iv-timeline-list">
        {[...byMonth.entries()].map(([month, items]) => (
          <section key={month}>
            <h4>
              {new Intl.DateTimeFormat('en-GB', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${month}-01T12:00:00Z`))}
            </h4>
            <ol>
              {items.map(({ payment, index }) => (
                <li
                  key={payment.id}
                  data-index={(indexOf.get(payment.part) ?? 0) % 6}
                  data-hot={hot === payment.part || undefined}
                  data-invalid={toCents(payment.amount) <= 0 || undefined}
                  onPointerEnter={() => onHot(payment.part)}
                >
                  <span className="iv-timeline-swatch" aria-hidden />
                  <span className="iv-timeline-date iv-num">
                    {shortDate(payment.date, year)}
                  </span>
                  <span className="iv-timeline-name">
                    {paymentName(payment, index, payments.length)}
                  </span>
                  <span className="iv-num">
                    <MorphText>{money(payment.amount)}</MorphText>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="iv-timeline-foot iv-num">
        <MorphText>
          {payments.length === 1
            ? `${money(terms.total)} in one payment`
            : `${money(terms.total)} in ${payments.length} payments${span > 0 ? ` over ${span} ${span === 1 ? 'month' : 'months'}` : ''}`}
        </MorphText>
      </p>
    </div>
  );
}
