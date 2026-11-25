const MAX_HTML_BYTES = 512 * 1024;

export type TelebirrReceipt = {
  receiptNo?: string;
  transactionStatus?: string;
  creditedPartyName?: string;
  creditedPartyAccountNo?: string;
  settledAmount?: number;
  totalPaidAmount?: number;
  paymentDate?: string;
};

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
  const compact = label.replace(/ /g, '');
  for (const [field, aliases] of Object.entries(LABELS) as [ReceiptField, string[]][]) {
    if (aliases.some((alias) => label === alias || label.endsWith(alias) || compact === alias.replace(/ /g, ''))) {
      return field;
    }
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

    // Telebirr's invoice header is a three-column row: receipt number,
    // payment date, and settled amount. Their values appear in the same
    // columns on the following row, not immediately after each header cell.
    const isInvoiceColumn = field === 'receiptNo' || field === 'paymentDate' || field === 'settledAmount';
    const preferred = cells[index + (isInvoiceColumn ? 3 : 1)];
    if (preferred && !findLabel(preferred)) {
      values.set(field, preferred);
      continue;
    }

    // Fallback for receipt variants where a field is displayed as a simple
    // label/value pair in its own row.
    for (let next = index + 1; next < Math.min(cells.length, index + 5); next += 1) {
      if (!cells[next] || findLabel(cells[next])) continue;
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
