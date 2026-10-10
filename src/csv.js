import Papa from "papaparse";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — plenty for a hackathon demo CSV
const PREVIEW_ROWS = 8;

export class CsvValidationError extends Error {}

const isNumeric = value => value !== "" && value !== null && Number.isFinite(Number(value));

// A column counts as numeric only if every non-empty cell in it parses as a
// number — one stray label in an otherwise numeric column disqualifies it,
// which is what the ml pipeline's own select_dtypes check effectively needs.
function detectNumericColumns(columns, rows) {
  return columns.filter(col => rows.every(row => row[col] === "" || isNumeric(row[col])));
}

function parseRecords(columns, rows) {
  const numericColumns = detectNumericColumns(columns, rows);
  return {
    columns,
    numericColumns,
    rowCount: rows.length,
    rows,
    preview: rows.slice(0, PREVIEW_ROWS),
  };
}

function finish(text, fileName) {
  if (!text || !text.trim()) {
    throw new CsvValidationError(`"${fileName}" is empty.`);
  }

  const parsed = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: h => h.trim(),
  });

  if (parsed.errors?.length) {
    const first = parsed.errors[0];
    throw new CsvValidationError(`Couldn't parse "${fileName}": ${first.message} (row ${first.row ?? "?"}).`);
  }

  const columns = (parsed.meta.fields || []).filter(Boolean);
  if (columns.length === 0) {
    throw new CsvValidationError(`"${fileName}" has no header row.`);
  }
  if (new Set(columns).size !== columns.length) {
    throw new CsvValidationError(`"${fileName}" has duplicate column names.`);
  }

  const rows = parsed.data.filter(row => Object.values(row).some(v => v !== "" && v != null));
  if (rows.length === 0) {
    throw new CsvValidationError(`"${fileName}" has a header row but no data.`);
  }

  return { fileName, ...parseRecords(columns, rows) };
}

export function parseCsvFile(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Promise.reject(new CsvValidationError("Only .csv files are supported right now."));
  }
  if (file.size === 0) {
    return Promise.reject(new CsvValidationError(`"${file.name}" is empty.`));
  }
  if (file.size > MAX_FILE_BYTES) {
    return Promise.reject(
      new CsvValidationError(`"${file.name}" is larger than the 5 MB limit for this demo.`)
    );
  }

  return file.text().then(text => finish(text, file.name));
}

export function parseCsvText(text, fileName) {
  return Promise.resolve().then(() => finish(text, fileName));
}
