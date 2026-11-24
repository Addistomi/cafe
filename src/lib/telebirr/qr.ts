/**
 * Decoder for the transaction reference inside a Telebirr receipt QR.
 *
 * A valid QR only gives us a reference number. It is NOT evidence that
 * the transaction completed or that Fana Cafe received the money.
 */
export type TelebirrQrResult =
  | { ok: true; reference: string }
  | { ok: false; reason: 'empty' | 'invalid-encoding' | 'invalid-structure' | 'invalid-checksum' | 'reference-not-found' };

type TlvEntry = { tag: string; value: string; valueStart: number };

const HEX = /^[0-9a-f]+$/i;
const REFERENCE = /^[A-Z0-9]{10}$/;
const MAX_QR_TEXT = 1024;
const MAX_HEX_TEXT = 512;

function crc16CcittFalse(value: string): number {
  let crc = 0xffff;
  for (let index = 0; index < value.length; index += 1) {
    crc ^= (value.charCodeAt(index) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function decodePayload(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    const remainder = normalized.length % 4;
    if (remainder !== 1) {
      const padded = remainder === 0
        ? normalized
        : normalized + '='.repeat(4 - remainder);
      try {
        const decoded = atob(padded);
        if (decoded.length <= MAX_HEX_TEXT && decoded.length % 2 === 0 && HEX.test(decoded)) {
          return decoded;
        }
      } catch {
        // Try the raw-hex fallback below.
      }
    }
  }

  // Some camera/scanner apps return the decoded hex rather than the QR's
  // original base64 text. Accept that representation too.
  if (input.length <= MAX_HEX_TEXT && input.length % 2 === 0 && HEX.test(input)) {
    return input;
  }
  return null;
}

function parseTopLevel(hex: string): TlvEntry[] | null {
  const entries: TlvEntry[] = [];
  let offset = 0;

  while (offset < hex.length) {
    if (entries.length >= 16 || offset + 4 > hex.length) return null;

    const tag = hex.slice(offset, offset + 2).toUpperCase();
    const lengthText = hex.slice(offset + 2, offset + 4);
    if (!/^\\d{2}$/.test(lengthText)) return null;

    const length = Number(lengthText);
    const valueStart = offset + 4;
    if (length < 1 || valueStart + length > hex.length) return null;

    entries.push({
      tag,
      value: hex.slice(valueStart, valueStart + length),
      valueStart,
    });
    offset = valueStart + length;
  }

  return entries;
}

function parseReference(containerHex: string): string | null {
  if (containerHex.length % 2 !== 0 || !HEX.test(containerHex)) return null;
  const bytes: number[] = [];
  for (let index = 0; index < containerHex.length; index += 2) {
    bytes.push(Number.parseInt(containerHex.slice(index, index + 2), 16));
  }

  const tags = new Map<number, number[]>();
  let offset = 0;
  while (offset < bytes.length) {
    if (tags.size >= 16 || offset + 2 > bytes.length) return null;
    const tag = bytes[offset];
    const length = bytes[offset + 1];
    const valueStart = offset + 2;
    if (length >= 0x80 || valueStart + length > bytes.length || tags.has(tag)) return null;
    tags.set(tag, bytes.slice(valueStart, valueStart + length));
    offset = valueStart + length;
  }

  const referenceBytes = tags.get(0x00);
  if (!referenceBytes || referenceBytes.length !== 10) return null;
  const reference = String.fromCharCode(...referenceBytes);
  return REFERENCE.test(reference) ? reference : null;
}

/**
 * Parse the Telebirr "Payment QR Code" payload and validate its CRC.
 * Success means only that the QR is structurally valid and yields a
 * 10-character transaction reference; server-side receipt verification
 * is still required before an order can become paid.
 */
export function parseTelebirrQr(input: unknown): TelebirrQrResult {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid-encoding' };
  const raw = input.replace(/\\s+/g, '');
  if (!raw) return { ok: false, reason: 'empty' };
  if (raw.length > MAX_QR_TEXT) return { ok: false, reason: 'invalid-encoding' };

  const hex = decodePayload(raw);
  if (!hex) return { ok: false, reason: 'invalid-encoding' };

  const entries = parseTopLevel(hex);
  if (!entries || entries.length < 2) return { ok: false, reason: 'invalid-structure' };

  const checksum = entries[entries.length - 1];
  if (checksum.tag !== '63' || checksum.value.length !== 4 || !HEX.test(checksum.value)) {
    return { ok: false, reason: 'invalid-structure' };
  }
  const expected = Number.parseInt(checksum.value, 16);
  if (crc16CcittFalse(hex.slice(0, checksum.valueStart)) !== expected) {
    return { ok: false, reason: 'invalid-checksum' };
  }

  const referenceContainers = entries.filter((entry) => entry.tag === '81');
  if (referenceContainers.length !== 1) {
    return { ok: false, reason: 'reference-not-found' };
  }
  const reference = parseReference(referenceContainers[0].value);
  if (!reference) return { ok: false, reason: 'reference-not-found' };

  return { ok: true, reference };
}
