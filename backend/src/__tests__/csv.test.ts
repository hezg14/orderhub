import { describe, expect, it } from 'vitest';
import { toCsv, csvFilename, type ReportResult } from '../services/report.service';

const base: ReportResult = {
  type: 'orders',
  title: 'Order detail',
  columns: [
    { key: 'orderNo', label: 'Order no.' },
    { key: 'customer', label: 'Customer' },
    { key: 'total', label: 'Total', align: 'right' },
  ],
  rows: [],
  total: 0,
  range: { from: '2026-10-01', to: '2026-10-31' },
};

describe('CSV export', () => {
  it('starts with a UTF-8 BOM so Excel does not mangle Chinese', () => {
    const csv = toCsv({ ...base, rows: [{ orderNo: '#1', customer: '张三贸易', total: 100 }] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('张三贸易');
  });

  it('emits a header row followed by CRLF rows', () => {
    const csv = toCsv({ ...base, rows: [{ orderNo: '#1', customer: 'A', total: 10 }] });
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Order no.,Customer,Total');
    expect(lines[1]).toBe('#1,A,10');
  });

  it('quotes values containing commas, quotes and newlines', () => {
    const csv = toCsv({
      ...base,
      rows: [{ orderNo: '#1', customer: 'Smith, "Bob" & Co', total: 1 }],
    });
    expect(csv).toContain('"Smith, ""Bob"" & Co"');
  });

  it('neutralises formula injection', () => {
    const csv = toCsv({
      ...base,
      rows: [{ orderNo: '=HYPERLINK("http://evil")', customer: '+1', total: 0 }],
    });
    // A leading apostrophe stops Excel from evaluating the cell.
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain(`'+1`);
  });

  it('keeps an empty result as header only', () => {
    const csv = toCsv(base);
    expect(csv.slice(1)).toBe('Order no.,Customer,Total');
  });

  it('builds a filename with the range', () => {
    expect(csvFilename('customers', base.range)).toBe('customers-2026-10-01_2026-10-31.csv');
  });
});
