'use client';

import { reportWebVitals } from 'next-axiom';
import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metrics: NextWebVitalsMetric) => {
    reportWebVitals(metrics);
  });
  return <></>;
}
