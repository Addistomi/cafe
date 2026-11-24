import 'server-only';
import { parseTelebirrReceiptHtml, type TelebirrReceipt } from './receipt-parser';

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

    const plain = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').toLowerCase();
    if (/(receipt|transaction|record)\s+(was\s+)?not found|no\s+(receipt|transaction|record)\b|invalid receipt number/.test(plain)) {
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
    .split(/[,;|]/)
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
      reason: 'This receipt is for "' + receipt.creditedPartyName + '", not the configured Fana Cafe recipient.',
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
