'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseTelebirrQr } from '@/lib/telebirr/qr';
import { submitPaymentReceipt, simulatePayment } from '@/features/orders/actions';

type OcrApi = {
  recognize: (image: File, language: string) => Promise<{ data: { text: string } }>;
};
type JsQrResult = { data: string };
type JsQrApi = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => JsQrResult | null;

declare global {
  interface Window {
    Tesseract?: OcrApi;
    jsQR?: JsQrApi;
  }
}

function loadOcr(): Promise<OcrApi> {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tesseract]');
    if (existing) {
      existing.addEventListener('load', () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR could not load.')));
      existing.addEventListener('error', () => reject(new Error('OCR could not load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.async = true;
    script.dataset.tesseract = 'true';
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR could not load.'));
    script.onerror = () => reject(new Error('OCR could not load.'));
    document.head.appendChild(script);
  });
}

function loadQrDecoder(): Promise<JsQrApi> {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jsqr]');
    if (existing) {
      existing.addEventListener('load', () => window.jsQR ? resolve(window.jsQR) : reject(new Error('QR scanner could not load.')));
      existing.addEventListener('error', () => reject(new Error('QR scanner could not load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.dataset.jsqr = 'true';
    script.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('QR scanner could not load.'));
    script.onerror = () => reject(new Error('QR scanner could not load.'));
    document.head.appendChild(script);
  });
}

async function scanQrImage(file: File): Promise<string | null> {
  const decode = await loadQrDecoder();
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    return decode(pixels.data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  } finally {
    bitmap.close();
  }
}

function findReference(text: string): string {
  const labeled = text.match(/(?:transaction|trans|receipt|reference|ref|txn)\s*(?:id|no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{5,63})/i);
  if (labeled?.[1]) return labeled[1].replace(/[.,]$/, '').toUpperCase();
  const candidates = text.match(/\b[A-Z0-9][A-Z0-9-]{7,23}\b/gi) ?? [];
  return candidates.sort((a, b) => b.length - a.length)[0]?.toUpperCase() ?? '';
}

export function PayPanel({ orderId, total, expires, mock, hasPendingReceipt = false, merchantName, merchantAccount }: {
  orderId: string; total: string; expires: string | null; mock: boolean; hasPendingReceipt?: boolean;
  merchantName: string; merchantAccount: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();

  async function scanReceipt(selected: File) {
    setError(null);
    setNotice(null);
    setReference('');
    setOcrText('');
    setScanning(true);

    try {
      // Prefer the payment QR because its embedded reference is more reliable
      // than OCR. The QR is still only a reference, never payment proof.
      try {
        const qrText = await scanQrImage(selected);
        if (qrText) {
          const decoded = parseTelebirrQr(qrText);
          if (decoded.ok) {
            setReference(decoded.reference);
            setNotice('Telebirr QR read successfully and its checksum is valid. The transaction still needs to be checked against Telebirr.');
            return;
          }
        }
      } catch {
        // QR scanning can fail on blurry or cropped images; OCR is the fallback.
      }

      const ocr = await loadOcr();
      const result = await ocr.recognize(selected, 'eng');
      setOcrText(result.data.text);
      const extracted = findReference(result.data.text);
      setReference(extracted);
      setNotice(extracted
        ? 'We found a possible reference in the receipt text. Check it carefully before submitting.'
        : 'We could not confidently read the reference. Enter the 10-character number manually from the receipt.');
    } catch {
      setError('Automatic reading could not start. You can still enter the transaction reference manually.');
    } finally {
      setScanning(false);
    }
  }

  function submit() {
    if (!file) { setError('Choose your Telebirr screenshot first.'); return; }
    const data = new FormData();
    data.set('receipt', file);
    data.set('reference', reference.trim().toUpperCase());
    setError(null);
    setNotice(null);
    start(async () => {
      const result = await submitPaymentReceipt(orderId, data);
      if (!result.ok) {
        setError(result.error);
      } else {
        setNotice(result.message);
        router.refresh();
      }
    });
  }

  return (
    <section className="card space-y-4 border-accent bg-accent-soft p-5">
      <div>
        <h2 className="text-lg font-bold">The café accepted your order</h2>
        <p className="mt-1 text-sm">Transfer {total} to Fana Cafe using Telebirr, then upload the successful payment receipt.</p>
        {expires && <p className="mt-1 text-xs text-muted">Your ingredients are held until {new Date(expires).toLocaleTimeString('en-GB', { timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}.</p>}
      </div>

      <div className="rounded-field border border-line bg-surface p-4">
        <p className="text-sm font-bold">Transfer to Fana Cafe's Telebirr merchant account</p>
        <p className="mt-2 text-sm text-muted">Merchant name</p>
        <p className="font-semibold">{merchantName}</p>
        <p className="mt-2 text-sm text-muted">Merchant number / short code</p>
        {merchantAccount ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-mono text-lg font-bold tracking-wide">{merchantAccount}</p>
            <button type="button" className="btn-secondary" onClick={() => {
              if (!navigator.clipboard) { setError('Copy is unavailable in this browser. Please copy the number manually.'); return; }
              void navigator.clipboard.writeText(merchantAccount)
                .then(() => setNotice('Merchant number copied.'))
                .catch(() => setError('Could not copy the merchant number. Please copy it manually.'));
            }}>Copy number</button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-danger">The café has not configured its merchant number yet. Please contact the café before paying.</p>
        )}
        <p className="helper mt-3">Transfer the exact order total shown above. Upload the completed Telebirr receipt after the transfer succeeds.</p>
      </div>

      {hasPendingReceipt ? (
        <div className="rounded-field border border-warning/30 bg-warning-soft p-4">
          <p className="font-bold text-warning">Receipt submitted · Awaiting verification</p>
          <p className="mt-1 text-sm text-muted">We received your screenshot and transaction reference. Your order will only be marked paid after The Telebirr receipt matched the transaction reference, recipient and amount.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="telebirr-receipt" className="block text-sm font-bold">1. Upload your Telebirr receipt screenshot</label>
            <input
              id="telebirr-receipt"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="block w-full rounded-field border border-line bg-surface p-3 text-sm"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setReference('');
                setOcrText('');
                setNotice(null);
                if (selected) {
                  if (selected.size > 5 * 1024 * 1024) { setError('The screenshot must be 5 MB or smaller.'); setFile(null); return; }
                  void scanReceipt(selected);
                }
              }}
            />
            <p className="helper">JPG, PNG or WebP · Maximum 5 MB. The website first scans the payment QR, then tries text recognition if needed.</p>
          </div>

          {file && (
            <div className="space-y-2 rounded-field border border-line bg-surface p-3">
              <p className="text-sm font-semibold">{file.name}</p>
              {scanning ? <p className="text-sm text-muted">Reading the QR code or receipt text…</p> : null}
              {notice && <p className="text-sm text-muted">{notice}</p>}
              <label htmlFor="telebirr-reference" className="block text-sm font-bold">2. Confirm the 10-character transaction reference</label>
              <input
                id="telebirr-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value.toUpperCase())}
                placeholder="e.g. DET0SAMPLE"
                maxLength={10}
                className="field w-full font-mono uppercase"
              />
              {ocrText && <details className="text-xs text-muted"><summary className="cursor-pointer">Show text detected from screenshot</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{ocrText}</pre></details>}
            </div>
          )}

          <button className="btn-primary w-full" disabled={!merchantAccount || !file || !/^[A-Z0-9]{10}$/.test(reference.trim()) || scanning || pending} onClick={submit}>
            {pending ? 'Submitting receipt…' : '3. Submit payment receipt'}
          </button>
        </>
      )}

      {mock && !hasPendingReceipt && (
        <div className="border-t border-line pt-3">
          <p className="helper mb-2">Local development only — this does not contact Telebirr.</p>
          <button className="btn-secondary w-full" disabled={pending} onClick={() => start(async () => {
            const result = await simulatePayment(orderId);
            if (!result.ok) setError(result.error); else router.refresh();
          })}>Simulate payment (development)</button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      <p className="helper">A screenshot, QR code or OCR result is not proof of payment. Your order stays unpaid until the café's server has confirmed the actual Telebirr receipt.</p>
    </section>
  );
}
