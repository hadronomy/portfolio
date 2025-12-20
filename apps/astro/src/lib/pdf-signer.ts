/**
 * PDF Digital Signature Library
 *
 * This module provides functionality to digitally sign PDF documents using @signpdf/signpdf.
 * It supports both self-signed certificates for testing and external P12 certificates for production use.
 *
 * Key features:
 * - PKCS#7 detached signatures using @signpdf/signpdf
 * - Self-signed certificate generation with node-forge
 * - P12 certificate loading
 * - Proper PDF signature field creation
 * - Adobe Acrobat compatible signatures
 */

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
 * Signs a PDF buffer with a digital signature using @signpdf/signpdf
 * @param pdfBuffer The PDF buffer to sign
 * @param options Signing options including certificate path and password
 * @returns Signed PDF buffer
 */
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  options: SigningOptions = {},
): Promise<Buffer> {
  try {
    const signPdf = new SignPdf();

    // Check for certificate from file path first, then environment variable
    let certificateBuffer: Buffer | null = null;
    let certificatePassword = options.certificatePassword || '';

    if (options.certificatePath && fs.existsSync(options.certificatePath)) {
      // Use P12 certificate from file
      certificateBuffer = fs.readFileSync(options.certificatePath);
    } else if (process.env.CERTIFICATE_P12) {
      // Use P12 certificate from environment variable (base64 encoded)
      certificateBuffer = Buffer.from(process.env.CERTIFICATE_P12, 'base64');
      certificatePassword =
        process.env.CERTIFICATE_PASSWORD || certificatePassword;
    }

    if (certificateBuffer) {
      const signer = new P12Signer(certificateBuffer, {
        passphrase: certificatePassword,
      });

      // Add placeholder to PDF
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: options.reason || 'Document Authentication',
        contactInfo: '',
        name: options.signerName || 'Pablo Hernandez',
        location: options.location || '',
      });

      // Sign the PDF
      const signedPdf = await signPdf.sign(pdfWithPlaceholder, signer);
      return Buffer.from(signedPdf);
    }

    // Generate self-signed certificate and create P12 buffer
    console.log(
      'No certificate provided, generating self-signed certificate for signing',
    );
    const { certificate, privateKey } = generateSelfSignedCertificate();

    // Convert to P12 format for @signpdf/signpdf
    const p12Buffer = createP12Buffer(certificate, privateKey);
    const signer = new P12Signer(p12Buffer, { passphrase: '' });

    // Add placeholder to PDF
    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer,
      reason: options.reason || 'Document Authentication',
      contactInfo: '',
      name: options.signerName || 'Pablo Hernandez',
      location: options.location || '',
    });

    // Sign the PDF
    const signedPdf = await signPdf.sign(pdfWithPlaceholder, signer);
    return Buffer.from(signedPdf);
  } catch (error) {
    console.error('Error signing PDF:', error);
    throw new Error(
      `Failed to sign PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Creates a P12 buffer from certificate and private key for use with @signpdf/signpdf
 * @param certificate The certificate
 * @param privateKey The private key
 * @returns P12 buffer
 */
function createP12Buffer(
  certificate: forge.pki.Certificate,
  privateKey: forge.pki.PrivateKey,
): Buffer {
  // Create a PKCS#12 container
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey as any,
    [certificate],
    '', // Empty passphrase
    {
      algorithm: '3des',
    },
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, 'binary');
}

/**
 * Generates a self-signed certificate for testing purposes
 * @returns Certificate and private key pair
 * @note This is intended for development/testing only. Use proper certificates in production.
 */
function generateSelfSignedCertificate() {
  // Generate a key pair using the correct API
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create a certificate
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
