'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitPaymentReceipt, simulatePayment } from '@/features/orders/actions';

type OcrApi = {
  recognize: (image: File, language: string) => Promise<{ data: { text: string } }>;
};
declare global {
  interface Window { Tesseract?: OcrApi }
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

function findReference(text: string): string {
  const labeled = text.match(/(?:transaction|trans|receipt|reference|ref|txn)\\s*(?:id|no\\.?|number|#)?\\s*[:#-]?\\s*([A-Z0-9][A-Z0-9._/-]{5,63})/i);
  if (labeled?.[1]) return labeled[1].replace(/[.,]$/, '');
  const candidates = text.match(/\\b[A-Z0-9][A-Z0-9-]{7,23}\\b/gi) ?? [];
  return candidates.sort((a, b) => b.length - a.length)[0] ?? '';
}

export function PayPanel({ orderId, total, expires, mock, hasPendingReceipt = false }: {
  orderId: string; total: string; expires: string | null; mock: boolean; hasPendingReceipt?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, start] = useTransition();

  async function scanReceipt(selected: File) {
    setError(null); setNotice(null); setReference(''); setOcrText(''); setScanning(true);
    try {
      const ocr = await loadOcr();
      const result = await ocr.recognize(selected, 'eng');
      setOcrText(result.data.text);
      const extracted = findReference(result.data.text);
      setReference(extracted);
      setNotice(extracted
        ? 'We found a possible transaction reference. Check it carefully before submitting.'
        : 'We could not confidently find the reference. Enter it manually from the receipt.');
    } catch {
      setError('Receipt reading could not start. You can still enter the transaction reference manually.');
    } finally {
      setScanning(false);
    }
  }

  function submit() {
    if (!file) { setError('Choose your Telebirr screenshot first.'); return; }
    const data = new FormData();
    data.set('receipt', file);
    data.set('reference', reference.trim());
    setError(null); setNotice(null);
    start(async () => {
      const result = await submitPaymentReceipt(orderId, data);
      if (!result.ok) setError(result.error);
      else {
        setNotice('Receipt submitted. Your payment is pending verification; your order is not marked as paid yet.');
        router.refresh();
      }
    });
  }

  return (
    <section className="card space-y-4 border-accent bg-accent-soft p-5">
      <div>
        <h2 className="text-lg font-bold">The café accepted your order</h2>
        <p className="mt-1 text-sm">Pay {total} using Telebirr, then upload the successful payment receipt.</p>
        {expires && <p className="mt-1 text-xs text-muted">Your ingredients are held until {new Date(expires).toLocaleTimeString('en-GB', { timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' })}.</p>}
      </div>

      {hasPendingReceipt ? (
        <div className="rounded-field border border-warning/30 bg-warning-soft p-4">
          <p className="font-bold text-warning">Receipt submitted · Awaiting verification</p>
          <p className="mt-1 text-sm text-muted">We received your screenshot and transaction reference. We will update this order after payment verification.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label htmlFor="telebirr-receipt" className="block text-sm font-bold">1. Upload your Telebirr receipt screenshot</label>
            <input
              ref={inputRef}
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
            <p className="helper">JPG, PNG or WebP · Maximum 5 MB. Text is read in your browser; the screenshot is uploaded privately to the café.</p>
          </div>

          {file && (
            <div className="space-y-2 rounded-field border border-line bg-surface p-3">
              <p className="text-sm font-semibold">{file.name}</p>
              {scanning ? <p className="text-sm text-muted">Reading receipt text… this can take a few seconds.</p> : null}
              {notice && <p className="text-sm text-muted">{notice}</p>}
              <label htmlFor="telebirr-reference" className="block text-sm font-bold">2. Confirm the transaction reference</label>
              <input
                id="telebirr-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Enter reference from the receipt"
                maxLength={64}
                className="field w-full font-mono"
              />
              {ocrText && <details className="text-xs text-muted"><summary className="cursor-pointer">Show text detected from screenshot</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{ocrText}</pre></details>}
            </div>
          )}

          <button className="btn-primary w-full" disabled={!file || !reference.trim() || scanning || pending} onClick={submit}>
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
      <p className="helper">A screenshot and OCR result are not proof of payment. Your order stays unpaid until the café's authorized Telebirr verification confirms the transaction, amount and recipient.</p>
    </section>
  );
}
