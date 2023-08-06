'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals } from 'next-axiom';
import { type NextWebVitalsMetric } from 'next/app';

export type WebVitalsProps = Record<string, never>;

export function WebVitals({}: WebVitalsProps) {
  useReportWebVitals((metrics: NextWebVitalsMetric) => {
    reportWebVitals(metrics);
  });
  return <></>;
}
