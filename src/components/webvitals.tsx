'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals } from 'next-axiom';

export type WebVitalsProps = {};

export function WebVitals({}: WebVitalsProps) {
  useReportWebVitals((metrics) => {
    reportWebVitals(metrics);
  });
  return <></>;
}
