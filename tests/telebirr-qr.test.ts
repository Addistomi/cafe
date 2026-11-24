import { describe, expect, it } from 'vitest';
import { parseTelebirrQr } from '../src/lib/telebirr/qr';

const SAMPLE_QR = 'ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OQ==';

describe('parseTelebirrQr', () => {
  it('extracts the transaction reference from a valid Telebirr QR', () => {
    expect(parseTelebirrQr(SAMPLE_QR)).toEqual({ ok: true, reference: 'ABC1D2E3F4' });
  });

  it('rejects a QR whose checksum was changed', () => {
    const changed = SAMPLE_QR.slice(0, -4) + 'OTQ==';
    expect(parseTelebirrQr(changed)).toEqual({ ok: false, reason: 'invalid-checksum' });
  });

  it('rejects non-Telebirr QR content', () => {
    expect(parseTelebirrQr('https://example.com')).toEqual({ ok: false, reason: 'invalid-encoding' });
  });

  it('rejects empty input', () => {
    expect(parseTelebirrQr('  ')).toEqual({ ok: false, reason: 'empty' });
  });
});
