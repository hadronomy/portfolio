'use client';

import { ParentSize } from '@visx/responsive';
import type { Transition } from 'motion/react';
import {
  Children,
  type CSSProperties,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';
import { Area, type AreaProps } from './area';
import type { LineConfig, Margin } from './chart-context';
import { ChartLoadingLabel } from './chart-loading-label';
import {
  type ChartPhase,
  type ChartStatus,
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  resolveRestingChartPhase,
} from './chart-phase';
import { PatternArea } from './pattern-area';
import { TimeSeriesChartInner } from './time-series-chart-shell';

export interface AreaChartProps {
  /** Data array - each item should have a date field and numeric values */
  data: Record<string, unknown>[];
  /** Key in data for the x-axis (date). Default: "date" */
  xDataKey?: string | undefined;
  /** Chart margins */
  margin?: Partial<Margin> | undefined;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number | undefined;
  /** CSS easing for clip-reveal. Default: cubic-bezier(0.85, 0, 0.15, 1) */
  animationEasing?: string | undefined;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition | undefined;
  /** Signature of motion URL state — triggers reveal replay when it changes. */
  revealSignature?: string | undefined;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string | undefined;
  /** Additional class name for the container */
  className?: string | undefined;
  /** Loading vs ready — drives chart phase and loading chrome. Default: `"ready"`. */
  status?: ChartStatus | undefined;
  /** Centered shimmer label while loading. */
  loadingLabel?: string | undefined;
  /** Animate y-domain over this duration (ms) on status transitions. Default: 500. */
  yDomainTweenDuration?: number | undefined;
  /** Animate y-domain when status or target domain changes. Default: true */
  yDomainTween?: boolean | undefined;
  /** Visible x-domain for brush zoom. */
  xDomain?: [Date, Date] | undefined;
  /** Full dataset length for x-scale padding when `xDomain` is set. */
  xDomainSlotCount?: number | undefined;
  /** Tween y-domain when brush changes the visible x-range. Default: false */
  tweenYDomainOnXDomainChange?: boolean | undefined;
  /** Inline container styles (e.g. fixed height for brush strip). */
  style?: CSSProperties | undefined;
  /** Fires when the internal chart phase changes (e.g. OG capture readiness). */
  onPhaseChange?: ((phase: ChartPhase) => void) | undefined;
  /** Child components (Area, Grid, ChartTooltip, etc.) */
  children: ReactNode;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 40, bottom: 40, left: 40 };

function extractAreaConfigs(children: ReactNode): LineConfig[] {
  const configs: LineConfig[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const childType = child.type as {
      displayName?: string | undefined;
      name?: string | undefined;
    };
    const componentName =
      typeof child.type === 'function'
        ? childType.displayName || childType.name || ''
        : '';

    const props = child.props as AreaProps | undefined;
    const isPatternArea =
      componentName === 'PatternArea' || child.type === PatternArea;
    const isAreaComponent =
      componentName === 'Area' ||
      child.type === Area ||
      (props &&
        typeof props.dataKey === 'string' &&
        props.dataKey.length > 0 &&
        !isPatternArea);

    if (isAreaComponent && props?.dataKey) {
      configs.push({
        dataKey: props.dataKey,
        stroke: props.stroke || props.fill || 'var(--chart-line-primary)',
        strokeWidth: props.strokeWidth || 2,
        yAxisId: props.yAxisId,
      });
    }
  });

  return configs;
}

interface ChartInnerProps {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  xDataKey: string;
  margin: Margin;
  animationDuration: number;
  animationEasing?: string | undefined;
  enterTransition?: Transition | undefined;
  revealSignature?: string | undefined;
  chartStatus: ChartStatus;
  loadingLabel?: string | undefined;
  yDomainTweenDuration: number;
  yDomainTween: boolean;
  xDomain?: [Date, Date] | undefined;
  xDomainSlotCount?: number | undefined;
  tweenYDomainOnXDomainChange?: boolean | undefined;
  children: ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPhaseChange: (phase: ChartPhase) => void;
}

function ChartInner({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  animationEasing,
  enterTransition,
  revealSignature,
  chartStatus,
  loadingLabel,
  yDomainTweenDuration,
  yDomainTween,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange,
  children,
  containerRef,
  onPhaseChange,
}: ChartInnerProps) {
  const lines = useMemo(() => extractAreaConfigs(children), [children]);

  return (
    <TimeSeriesChartInner
      animationDuration={animationDuration}
      animationEasing={animationEasing}
      chartStatus={chartStatus}
      clipPathId="chart-area-grow-clip"
      containerRef={containerRef}
      data={data}
      enterTransition={enterTransition}
      height={height}
      lines={lines}
      loadingLabel={loadingLabel}
      margin={margin}
      onPhaseChange={onPhaseChange}
      revealSignature={revealSignature}
      tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
      width={width}
      xDataKey={xDataKey}
      xDomain={xDomain}
      xDomainSlotCount={xDomainSlotCount}
      yDomainTween={yDomainTween}
      yDomainTweenDuration={yDomainTweenDuration}
    >
      {children}
    </TimeSeriesChartInner>
  );
}

export function AreaChart({
  data,
  xDataKey = 'date',
  margin: marginProp,
  animationDuration = 1100,
  animationEasing,
  enterTransition,
  revealSignature,
  aspectRatio = '2 / 1',
  className = '',
  status = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  yDomainTween = true,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  style,
  onPhaseChange,
  children,
}: AreaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const margin = { ...DEFAULT_MARGIN, ...marginProp };
  const [chartPhase, setChartPhase] = useState<ChartPhase>(() =>
    resolveRestingChartPhase(status),
  );
  const handlePhaseChange = useCallback(
    (phase: ChartPhase) => {
      setChartPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  const showLoadingLabel = Boolean(
    loadingLabel?.trim() &&
      (chartPhase === 'loading' ||
        chartPhase === 'exiting' ||
        chartPhase === 'gridTweenReady' ||
        chartPhase === 'revealingLoading'),
  );

  return (
    <div
      className={cn('relative w-full', className)}
      ref={containerRef}
      style={{ aspectRatio, touchAction: 'none', ...style }}
    >
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <ChartInner
            animationDuration={animationDuration}
            animationEasing={animationEasing}
            chartStatus={status}
            containerRef={containerRef}
            data={data}
            enterTransition={enterTransition}
            height={height}
            loadingLabel={loadingLabel}
            margin={margin}
            onPhaseChange={handlePhaseChange}
            revealSignature={revealSignature}
            tweenYDomainOnXDomainChange={tweenYDomainOnXDomainChange}
            width={width}
            xDataKey={xDataKey}
            xDomain={xDomain}
            xDomainSlotCount={xDomainSlotCount}
            yDomainTween={yDomainTween}
            yDomainTweenDuration={yDomainTweenDuration}
          >
            {children}
          </ChartInner>
        )}
      </ParentSize>
      {showLoadingLabel ? (
        <ChartLoadingLabel
          exiting={chartPhase !== 'loading'}
          text={loadingLabel}
        />
      ) : null}
    </div>
  );
}

export { Area, type AreaProps } from './area';

export default AreaChart;
