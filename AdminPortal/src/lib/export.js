// Excel (.xlsx) export for any admin list.
//
// Paginated lists are re-fetched page by page with the same filters and sort the admin is
// looking at, plus ?export=1 — the backend checks reports.export, allows bigger pages and writes
// one audit entry per export. Lists already fully in memory pass `rows` instead.
//
// columns: [{ header, value: (row) => any, type?: 'date' | 'datetime' | 'number' | 'decimal' | 'money', width? }]

import { api } from './api.js';

const EXPORT_PAGE = 500;
export const EXPORT_MAX_ROWS = 50000;
const IST_OFFSET_MS = 330 * 60000;

const FORMATS = { date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm', money: '#,##0.00', number: '#,##0', decimal: '0.0' };

const toCell = (value, type) => {
  if (value === undefined || value === null || value === '') return null;
  if (type === 'date' || type === 'datetime' || value instanceof Date) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    // Excel dates carry no time zone; write the IST wall-clock time the portal shows.
    return { value: new Date(d.getTime() + IST_OFFSET_MS), format: FORMATS[type === 'date' ? 'date' : 'datetime'] };
  }
  if (type === 'money' || type === 'number' || type === 'decimal') {
    const n = Number(value);
    return Number.isFinite(n) ? { value: n, format: FORMATS[type] } : String(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return toCell(value.filter((v) => v != null && v !== '').join(', '));
  // Excel refuses cells longer than 32,767 characters.
  const s = String(value);
  return s.length > 32000 ? `${s.slice(0, 32000)}…` : s;
};

// Every row of a paginated list. paging: 'page' (?page&limit → {data,total,pages}) or
// 'skip' (?skip&limit → {data,total}). onProgress(done, total) after each page.
export async function fetchAllRows(path, params = {}, { paging = 'page', pageSize = EXPORT_PAGE, onProgress } = {}) {
  const base = { ...params, export: '1', limit: pageSize };
  delete base.page;
  delete base.skip;
  const rows = [];
  let total = 0;
  for (let i = 0; ; i += 1) {
    // skip-paging advances by what actually came back: the server may cap the page size lower.
    const q = paging === 'skip' ? { ...base, skip: rows.length } : { ...base, page: i + 1 };
    // eslint-disable-next-line no-await-in-loop
    const d = await api.get(path, q);
    const batch = d?.data || [];
    total = d?.total ?? rows.length + batch.length;
    if (total > EXPORT_MAX_ROWS) {
      throw new Error(`That is ${total.toLocaleString('en-IN')} rows — more than the ${EXPORT_MAX_ROWS.toLocaleString('en-IN')} an export can hold. Narrow the filters and try again.`);
    }
    rows.push(...batch);
    onProgress?.(rows.length, total);
    if (!batch.length || rows.length >= total) break;
  }
  return rows;
}

const stamp = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Writes rows to an .xlsx and starts the download. The writer is loaded on first use so it
// stays out of the main bundle.
export async function downloadExcel({ rows, columns, filename, sheet = 'Sheet1' }) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = [
    columns.map((c) => ({ value: c.header, fontWeight: 'bold', backgroundColor: '#EEF1F5' })),
    ...rows.map((r) => columns.map((c) => toCell(c.value(r), c.type))),
  ];
  const widths = columns.map((c) => ({ width: c.width || (c.type === 'datetime' ? 18 : c.type === 'date' ? 12 : Math.min(Math.max(String(c.header).length + 4, 14), 40)) }));
  // Sheet names: ≤31 chars, none of : \ / ? * [ ]
  const safeSheet = String(sheet).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';
  await writeXlsxFile(data, { sheet: safeSheet, columns: widths, stickyRowsCount: 1 }).toFile(`${filename}-${stamp()}.xlsx`);
}

export async function exportList({ path, params, paging, rows, columns, filename, sheet, onProgress }) {
  const all = rows || (await fetchAllRows(path, params, { paging, onProgress }));
  await downloadExcel({ rows: all, columns, filename, sheet });
  return all.length;
}
