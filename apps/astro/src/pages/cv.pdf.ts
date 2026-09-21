import { renderCV } from '~/lib/cv';

export async function GET() {
  const pdf = await renderCV();

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Pablo_Hernandez-CV.pdf"',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Length': pdf.length.toString(),
    },
  });
}
