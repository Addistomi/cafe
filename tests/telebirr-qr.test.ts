import { describe, expect, it } from 'vitest';
import { parseTelebirrQr } from '../src/lib/telebirr/qr';

const SAMPLE_QR = 'ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OQ==';
const BAD_CHECKSUM_QR = 'ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OA==';

describe('parseTelebirrQr', () => {
  it('extracts the transaction reference from a valid Telebirr QR', () => {
    expect(parseTelebirrQr(SAMPLE_QR)).toEqual({ ok: true, reference: 'ABC1D2E3F4' });
  });

  it('rejects a QR whose checksum was changed', () => {
    expect(parseTelebirrQr(BAD_CHECKSUM_QR)).toEqual({ ok: false, reason: 'invalid-checksum' });
  });

  it('rejects non-Telebirr QR content', () => {
    expect(parseTelebirrQr('https://example.com')).toEqual({ ok: false, reason: 'invalid-encoding' });
  });

  it('rejects empty input', () => {
    expect(parseTelebirrQr('  ')).toEqual({ ok: false, reason: 'empty' });
  });
});
