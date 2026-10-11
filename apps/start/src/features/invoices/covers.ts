import ember from '@portfolio/invoices/covers/ember.jpg?url';
import emberBackdrop from '@portfolio/invoices/covers/ember-backdrop.jpg?url';
import moss from '@portfolio/invoices/covers/moss.jpg?url';
import mossBackdrop from '@portfolio/invoices/covers/moss-backdrop.jpg?url';
import rose from '@portfolio/invoices/covers/rose.jpg?url';
import roseBackdrop from '@portfolio/invoices/covers/rose-backdrop.jpg?url';
import tide from '@portfolio/invoices/covers/tide.jpg?url';
import tideBackdrop from '@portfolio/invoices/covers/tide-backdrop.jpg?url';
import type { Cover } from '@portfolio/invoices/model';

/**
 * The same art the PDF prints. The banner is what the document shows; the
 * backdrop is a soft crop of it that fills the workspace behind the page, so
 * the page always sits in its own light.
 */
export const coverArt: Record<
  Exclude<Cover, 'none'>,
  { label: string; banner: string; backdrop: string }
> = {
  ember: { label: 'Ember', banner: ember, backdrop: emberBackdrop },
  tide: { label: 'Tide', banner: tide, backdrop: tideBackdrop },
  moss: { label: 'Moss', banner: moss, backdrop: mossBackdrop },
  rose: { label: 'Rose', banner: rose, backdrop: roseBackdrop },
};

export const coverOptions = [
  'none',
  ...Object.keys(coverArt),
] as readonly Cover[];

export function coverLabel(cover: Cover) {
  return cover === 'none' ? 'No cover' : coverArt[cover].label;
}
