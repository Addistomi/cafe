import { describe, expect, it } from 'vitest';
import { parseTelebirrReceiptHtml } from '../src/lib/telebirr/receipt';

const receiptHtml = '<table>' +
  '<tr><td>Payer Name</td><td>Test Payer</td></tr>' +
  '<tr><td>Credited party name</td><td>Fana Cafe</td></tr>' +
  '<tr><td>Credited party account no</td><td>251900000000</td></tr>' +
  '<tr><td>Transaction Status</td><td>Completed</td></tr>' +
  '<tr><td>Receipt No.</td><td>Payment date</td><td>Settled Amount</td></tr>' +
  '<tr><td>ABC1234567</td><td>24-11-2026 16:30:00</td><td>51.51 Birr</td></tr>' +
  '<tr><td>Total Amount Paid</td><td>51.51 Birr</td></tr>' +
  '</table>';

describe('parseTelebirrReceiptHtml', () => {
  it('extracts the reference, recipient, status and settled amount', () => {
    expect(parseTelebirrReceiptHtml(receiptHtml)).toMatchObject({
      receiptNo: 'ABC1234567',
      creditedPartyName: 'Fana Cafe',
      creditedPartyAccountNo: '251900000000',
      transactionStatus: 'Completed',
      settledAmount: 51.51,
      totalPaidAmount: 51.51,
      paymentDate: '24-11-2026 16:30:00',
    });
  });

  it('returns null for an unknown page instead of treating it as a receipt', () => {
    expect(parseTelebirrReceiptHtml('<html><body>Service temporarily unavailable</body></html>')).toBeNull();
  });

  it('handles malformed Telebirr status cells that close at the next td', () => {
    const malformed = receiptHtml.replace(
      '<td>Transaction Status</td><td>Completed</td>',
      '<td>Transaction Status<td>Completed</td>',
    );
    expect(parseTelebirrReceiptHtml(malformed)?.transactionStatus).toBe('Completed');
  });
});
