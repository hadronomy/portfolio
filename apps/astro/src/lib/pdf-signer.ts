import * as fs from 'node:fs';

import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import forge from 'node-forge';

export interface SigningOptions {
  certificatePath?: string;
  certificatePassword?: string;
  signerName?: string;
  location?: string;
  reason?: string;
}

/**
 * Signs a PDF buffer with an external P12 certificate when one is
 * configured, and falls back to a self-signed certificate otherwise.
 */
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  options: SigningOptions = {},
): Promise<Buffer> {
  try {
    const signPdf = new SignPdf();

    let certificateBuffer: Buffer | null = null;
    let certificatePassword = options.certificatePassword || '';

    if (options.certificatePath && fs.existsSync(options.certificatePath)) {
      certificateBuffer = fs.readFileSync(options.certificatePath);
    } else if (process.env.CERTIFICATE_P12) {
      certificateBuffer = Buffer.from(process.env.CERTIFICATE_P12, 'base64');
      certificatePassword =
        process.env.CERTIFICATE_PASSWORD || certificatePassword;
    }

    if (certificateBuffer) {
      const signer = new P12Signer(certificateBuffer, {
        passphrase: certificatePassword,
      });

      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: options.reason || 'Document Authentication',
        contactInfo: '',
        name: options.signerName || 'Pablo Hernandez',
        location: options.location || '',
      });

      const signedPdf = await signPdf.sign(pdfWithPlaceholder, signer);
      return Buffer.from(signedPdf);
    }

    console.log(
      'No certificate provided, generating self-signed certificate for signing',
    );
    const { certificate, privateKey } = generateSelfSignedCertificate();

    const p12Buffer = createP12Buffer(certificate, privateKey);
    const signer = new P12Signer(p12Buffer, { passphrase: '' });

    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer,
      reason: options.reason || 'Document Authentication',
      contactInfo: '',
      name: options.signerName || 'Pablo Hernandez',
      location: options.location || '',
    });

    const signedPdf = await signPdf.sign(pdfWithPlaceholder, signer);
    return Buffer.from(signedPdf);
  } catch (error) {
    console.error('Error signing PDF:', error);
    throw new Error(
      `Failed to sign PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

function createP12Buffer(
  certificate: forge.pki.Certificate,
  privateKey: forge.pki.rsa.PrivateKey,
): Buffer {
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey,
    [certificate],
    '', // Empty passphrase
    {
      algorithm: '3des',
    },
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, 'binary');
}

/** Development/testing only — use a real certificate in production. */
function generateSelfSignedCertificate() {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: 'Pablo Hernandez' },
    { name: 'countryName', value: 'ES' },
    { shortName: 'ST', value: 'Madrid' },
    { name: 'localityName', value: 'Madrid' },
    { name: 'organizationName', value: 'Portfolio' },
    { shortName: 'OU', value: 'Development' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  return { certificate: cert, privateKey: keys.privateKey };
}
