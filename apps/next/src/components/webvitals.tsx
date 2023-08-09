'use client';

import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals } from 'next-axiom';

export type WebVitalsProps = Record<string, never>;

export function WebVitals({}: WebVitalsProps) {
  useReportWebVitals((metrics: NextWebVitalsMetric) => {
    reportWebVitals(metrics);
  });
  return <></>;
}
