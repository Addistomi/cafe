import 'server-only';

export type TelebirrReceipt = {
  receiptNo?: string;
  transactionStatus?: string;
  creditedPartyName?: string;
  creditedPartyAccountNo?: string;
  settledAmount?: number;
  totalPaidAmount?: number;
  paymentDate?: string;
};

export type TelebirrLookup =
  | { kind: 'receipt'; receipt: TelebirrReceipt }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

export type TelebirrVerification =
  | { outcome: 'VERIFIED'; receipt: TelebirrReceipt }
  | { outcome: 'REJECTED'; reason: string; receipt?: TelebirrReceipt }
  | { outcome: 'PENDING'; reason: string; receipt?: TelebirrReceipt };

const RECEIPT_HOST = 'transactioninfo.ethiotelecom.et';
const MAX_HTML_BYTES = 512 * 1024;
const REFERENCE_PATTERN = /^[A-Z0-9]{10}$/;

type ReceiptField =
  | 'payerName'
  | 'creditedPartyName'
  | 'creditedPartyAccountNo'
  | 'transactionStatus'
  | 'receiptNo'
  | 'paymentDate'
  | 'settledAmount'
  | 'totalPaidAmount';

const LABELS: Record<ReceiptField, string[]> = {
  payerName: ['payer name'],
  creditedPartyName: ['credited party name'],
  creditedPartyAccountNo: ['credited party account no', 'credited party account number'],
  transactionStatus: ['transaction status'],
  receiptNo: ['receipt no', 'invoice no', 'payment number', 'receipt number'],
  paymentDate: ['payment date', 'transaction date'],
  settledAmount: ['settled amount', 'transferred amount'],
  totalPaidAmount: ['total amount paid', 'total paid amount'],
};

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  };

  return value
    .replace(/&#(\d+);?/g, (_, code: string) => {
      const point = Number(code);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : '';
    })
    .replace(/&#x([0-9a-f]+);?/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : '';
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function htmlCellText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  ).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function extractCells(html: string): string[] {
  const cells: string[] = [];
  // Telebirr has historically emitted one malformed table cell (missing closing td).
  const pattern = /<td\b[^>]*>([\s\S]*?)(?=<\/td\s*>|<td\b[^>]*>|<\/tr\b|$)/gi;
  for (const match of html.matchAll(pattern)) {
    cells.push(htmlCellText(match[1]));
  }
  return cells;
}

function normalizeLabel(value: string): string {
  const englishPart = value.includes('/') ? value.slice(value.lastIndexOf('/') + 1) : value;
  return englishPart.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function findLabel(value: string): ReceiptField | null {
  const label = normalizeLabel(value);
  for (const [field, aliases] of Object.entries(LABELS) as [ReceiptField, string[]][]) {
    if (aliases.some((alias) => label === alias || label.endsWith(alias))) return field;
  }
  return null;
}

function parseBirrAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(/,/g, '').match(/(?:^|\s)(\d+(?:\.\d{1,2})?)(?=\s|$)/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

/**
 * Parse fields from Telebirr's public bilingual HTML receipt.
 * Returns null for unknown layouts so the caller can keep the payment pending.
 */
export function parseTelebirrReceiptHtml(html: string): TelebirrReceipt | null {
  if (!html || html.length > MAX_HTML_BYTES) return null;

  const cells = extractCells(html);
  const values = new Map<ReceiptField, string>();

  for (let index = 0; index < cells.length; index += 1) {
    const field = findLabel(cells[index]);
    if (!field || values.has(field)) continue;

    // Skip other header cells. This handles the invoice header row where
    // Invoice No., Payment Date and Settled Amount precede their values.
    for (let next = index + 1; next < Math.min(cells.length, index + 5); next += 1) {
      if (!cells[next]) continue;
      if (findLabel(cells[next])) continue;
      values.set(field, cells[next]);
      break;
    }
  }

  const raw: Record<ReceiptField, string | undefined> = {
    payerName: values.get('payerName'),
    creditedPartyName: values.get('creditedPartyName'),
    creditedPartyAccountNo: values.get('creditedPartyAccountNo'),
    transactionStatus: values.get('transactionStatus'),
    receiptNo: values.get('receiptNo'),
    paymentDate: values.get('paymentDate'),
    settledAmount: values.get('settledAmount'),
    totalPaidAmount: values.get('totalPaidAmount'),
  };

  if (!Object.values(raw).some(Boolean)) return null;

  return {
    receiptNo: raw.receiptNo?.toUpperCase(),
    transactionStatus: raw.transactionStatus,
    creditedPartyName: raw.creditedPartyName,
    creditedPartyAccountNo: raw.creditedPartyAccountNo,
    paymentDate: raw.paymentDate,
    settledAmount: parseBirrAmount(raw.settledAmount),
    totalPaidAmount: parseBirrAmount(raw.totalPaidAmount),
  };
}

export async function fetchTelebirrReceipt(reference: string): Promise<TelebirrLookup> {
  if (!REFERENCE_PATTERN.test(reference)) {
    return { kind: 'not_found' };
  }

  const url = 'https://' + RECEIPT_HOST + '/receipt/' + encodeURIComponent(reference);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; FanaCafePaymentCheck/1.0)',
      },
    });

    if (response.status === 404) return { kind: 'not_found' };
    if (!response.ok) {
      return { kind: 'unavailable', reason: 'Telebirr receipt service returned HTTP ' + response.status + '.' };
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      return { kind: 'unavailable', reason: 'Telebirr returned an unexpectedly large receipt page.' };
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return { kind: 'unavailable', reason: 'Telebirr returned an unexpectedly large receipt page.' };
    }

    const receipt = parseTelebirrReceiptHtml(html);
    if (receipt) return { kind: 'receipt', receipt };

    const plain = htmlCellText(html).toLowerCase();
    if (/(receipt|transaction|record)\s+(was\s+)?not found|no receipt exists|invalid receipt number/.test(plain)) {
      return { kind: 'not_found' };
    }

    return { kind: 'unavailable', reason: 'Telebirr responded, but its receipt page could not be read. The payment remains pending.' };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      kind: 'unavailable',
      reason: timedOut
        ? 'Telebirr receipt lookup timed out. Try checking again in a few seconds.'
        : 'The website could not reach Telebirr. The payment remains pending.',
    };
  }
}

function normalizeMerchantName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9\u1200-\u137f ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function verifyTelebirrReceiptForOrder(
  reference: string,
  expectedAmount: number,
): Promise<TelebirrVerification> {
  const configuredNames = (process.env.TELEBIRR_VERIFIED_RECIPIENT_NAMES ?? '')
    .split(/[;,|]/)
    .map(normalizeMerchantName)
    .filter(Boolean);

  if (configuredNames.length === 0) {
    return {
      outcome: 'PENDING',
      reason: 'Automatic verification is not configured yet. Set TELEBIRR_VERIFIED_RECIPIENT_NAMES to the exact recipient name shown on Fana Cafe receipts.',
    };
  }

  const expectedAccount = (process.env.TELEBIRR_VERIFIED_RECIPIENT_ACCOUNT ?? '').replace(/\D/g, '');
  const lookup = await fetchTelebirrReceipt(reference);

  if (lookup.kind === 'not_found') {
    return { outcome: 'REJECTED', reason: 'Telebirr has no receipt for this transaction reference.' };
  }
  if (lookup.kind === 'unavailable') {
    return { outcome: 'PENDING', reason: lookup.reason };
  }

  const receipt = lookup.receipt;
  if (!receipt.receiptNo || receipt.receiptNo.toUpperCase() !== reference) {
    return { outcome: 'PENDING', reason: 'Telebirr returned a receipt, but its reference could not be matched safely.', receipt };
  }
  if (!receipt.transactionStatus) {
    return { outcome: 'PENDING', reason: 'Telebirr did not provide a transaction status. The payment remains pending.', receipt };
  }
  if (receipt.transactionStatus.trim().toLowerCase() !== 'completed') {
    return { outcome: 'REJECTED', reason: 'Telebirr reports this transaction as "' + receipt.transactionStatus + '", not Completed.', receipt };
  }
  if (!receipt.creditedPartyName) {
    return { outcome: 'PENDING', reason: 'Telebirr did not provide the recipient name. The payment remains pending.', receipt };
  }

  const actualRecipient = normalizeMerchantName(receipt.creditedPartyName);
  if (!configuredNames.includes(actualRecipient)) {
    return {
      outcome: 'REJECTED',
      reason: 'This receipt is for "' + receipt.creditedPartyName + '", not Fana Cafe\\'s configured merchant recipient.',
      receipt,
    };
  }

  if (expectedAccount) {
    const actualAccount = (receipt.creditedPartyAccountNo ?? '').replace(/\D/g, '');
    if (!actualAccount || actualAccount !== expectedAccount) {
      return {
        outcome: actualAccount ? 'REJECTED' : 'PENDING',
        reason: actualAccount
          ? 'The credited account on the Telebirr receipt does not match Fana Cafe.'
          : 'Telebirr masked or omitted the credited account number, so the configured account could not be confirmed.',
        receipt,
      };
    }
  }

  if (receipt.settledAmount === undefined) {
    return { outcome: 'PENDING', reason: 'Telebirr did not provide a readable settled amount.', receipt };
  }
  if (receipt.settledAmount.toFixed(2) !== Number(expectedAmount).toFixed(2)) {
    return {
      outcome: 'REJECTED',
      reason: 'The receipt shows ' + receipt.settledAmount.toFixed(2) + ' ETB, but this order requires ' + Number(expectedAmount).toFixed(2) + ' ETB.',
      receipt,
    };
  }

  return { outcome: 'VERIFIED', receipt };
}
