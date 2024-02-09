'use client';

import type { NextWebVitalsMetric } from 'next/app';
import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals } from 'next-axiom';

export function WebVitals() {
  useReportWebVitals((metrics: NextWebVitalsMetric) => {
    reportWebVitals(metrics);
  });
  return <></>;
}
