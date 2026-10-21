import { utils, writeFile } from 'xlsx';

// Expose only the writer so the deferred chunk can still tree-shake readers.
export function writeSpreadsheet(rows: (string | number)[][], sheetName: string, filename: string, bookType: 'xlsx' | 'biff8' = 'xlsx') {
  const sheet = utils.aoa_to_sheet(rows);
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, sheetName);
  writeFile(book, filename, { bookType });
}
