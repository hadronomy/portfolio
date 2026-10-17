import type { Locale } from '~/i18n/locales';
import { renderCV } from '~/lib/cv';

export async function cvResponse(locale: Locale) {
  const pdf = await renderCV(locale);

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Language': locale,
      'Content-Disposition': `inline; filename="Pablo_Hernandez-CV-${locale}.pdf"`,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Length': pdf.length.toString(),
    },
  });
}
