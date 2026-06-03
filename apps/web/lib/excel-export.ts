/**
 * Minimal XLSX generator — zero dependencies, runs in the browser.
 * Produces a valid .xlsx (OOXML SpreadsheetML) file using only built-in APIs.
 *
 * Supports: headers, rows, column widths, bold header row, frozen first row,
 * alternating row colours, number/date cell types.
 */

// ─── Public types ──────────────────────────────────────────────────────────────

export type CellValue = string | number | Date | null | undefined;

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;            // characters
  type?: 'text' | 'number' | 'date';
};

export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, CellValue>[];
  /** Optional totals row appended at the bottom (bold) */
  totals?: Record<string, CellValue>;
};

// ─── Entry point ──────────────────────────────────────────────────────────────

export function downloadExcel(sheets: ExcelSheet[], filename: string) {
  const blob = buildXlsx(sheets);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

// ─── XLSX builder ─────────────────────────────────────────────────────────────

function buildXlsx(sheets: ExcelSheet[]): Blob {
  // Collect shared strings
  const sst = new SharedStringTable();

  // Build sheet XML for each sheet
  const sheetXmls = sheets.map((sheet) => buildSheet(sheet, sst));

  // Build the package
  const files: Record<string, string | Uint8Array> = {};

  // [Content_Types].xml
  files['[Content_Types].xml'] = contentTypes(sheets.length);

  // _rels/.rels
  files['_rels/.rels'] = rootRels();

  // xl/workbook.xml
  files['xl/workbook.xml'] = workbookXml(sheets);

  // xl/_rels/workbook.xml.rels
  files['xl/_rels/workbook.xml.rels'] = workbookRels(sheets.length);

  // xl/sharedStrings.xml
  files['xl/sharedStrings.xml'] = sst.toXml();

  // xl/styles.xml
  files['xl/styles.xml'] = stylesXml();

  // xl/worksheets/sheet{n}.xml
  sheetXmls.forEach((xml, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = xml;
  });

  return zipFiles(files);
}

// ─── Sheet XML ────────────────────────────────────────────────────────────────

function buildSheet(sheet: ExcelSheet, sst: SharedStringTable): string {
  const cols = sheet.columns;
  const colCount = cols.length;

  // Column widths
  const colsXml = cols.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 15}" bestFit="1" customWidth="1"/>`,
  ).join('');

  const rows: string[] = [];

  // Header row (style 1 = bold + fill)
  const headerCells = cols.map((c, ci) => {
    const addr = cellAddress(ci, 0);
    const si = sst.add(c.header);
    return `<c r="${addr}" t="s" s="1"><v>${si}</v></c>`;
  });
  rows.push(`<row r="1" s="1" customFormat="1">${headerCells.join('')}</row>`);

  // Data rows
  sheet.rows.forEach((row, ri) => {
    const rowNum = ri + 2;
    const styleIdx = ri % 2 === 0 ? 2 : 3; // alternating: white / light grey
    const cells = cols.map((col, ci) => {
      const addr = cellAddress(ci, ri + 1);
      const val  = row[col.key];
      return buildCell(addr, val, col.type ?? 'text', sst, styleIdx);
    });
    rows.push(`<row r="${rowNum}">${cells.join('')}</row>`);
  });

  // Totals row (if provided)
  if (sheet.totals) {
    const rowNum = sheet.rows.length + 2;
    const cells = cols.map((col, ci) => {
      const addr = cellAddress(ci, sheet.rows.length + 1);
      const val  = sheet.totals![col.key];
      return buildCell(addr, val, col.type ?? 'text', sst, 4); // bold style
    });
    rows.push(`<row r="${rowNum}" s="1" customFormat="1">${cells.join('')}</row>`);
  }

  const lastRow = sheet.rows.length + (sheet.totals ? 2 : 1);
  const lastCol = colNumberToLetter(colCount - 1);
  const dimension = `A1:${lastCol}${lastRow}`;

  return [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`,
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`,
    `<dimension ref="${dimension}"/>`,
    `<sheetViews><sheetView tabSelected="1" workbookViewId="0">`,
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`,
    `</sheetView></sheetViews>`,
    `<sheetFormatPr defaultRowHeight="15"/>`,
    `<cols>${colsXml}</cols>`,
    `<sheetData>${rows.join('')}</sheetData>`,
    `</worksheet>`,
  ].join('');
}

function buildCell(
  addr: string,
  val: CellValue,
  type: 'text' | 'number' | 'date',
  sst: SharedStringTable,
  styleIdx: number,
): string {
  if (val === null || val === undefined || val === '') {
    return `<c r="${addr}" s="${styleIdx}"/>`;
  }
  if (val instanceof Date) {
    // Excel serial date
    const serial = dateToSerial(val);
    return `<c r="${addr}" s="5"><v>${serial}</v></c>`; // style 5 = date format
  }
  if (type === 'number' || typeof val === 'number') {
    return `<c r="${addr}" s="${styleIdx}"><v>${Number(val)}</v></c>`;
  }
  // String
  const si = sst.add(String(val));
  return `<c r="${addr}" t="s" s="${styleIdx}"><v>${si}</v></c>`;
}

// ─── Shared strings ───────────────────────────────────────────────────────────

class SharedStringTable {
  private map = new Map<string, number>();
  private list: string[] = [];

  add(s: string): number {
    if (this.map.has(s)) return this.map.get(s)!;
    const idx = this.list.length;
    this.list.push(s);
    this.map.set(s, idx);
    return idx;
  }

  toXml(): string {
    const items = this.list
      .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`
      + ` count="${this.list.length}" uniqueCount="${this.list.length}">`
      + items
      + `</sst>`;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0F4FA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD0D8E4"/></left>
      <right style="thin"><color rgb="FFD0D8E4"/></right>
      <top style="thin"><color rgb="FFD0D8E4"/></top>
      <bottom style="thin"><color rgb="FFD0D8E4"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <!-- 0: default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <!-- 1: header (dark blue bg, white bold) -->
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <!-- 2: even row (white bg) -->
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <!-- 3: odd row (light blue-grey bg) -->
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <!-- 4: totals row (bold) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <!-- 5: date format -->
    <xf numFmtId="14" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;
}

// ─── Package XML ──────────────────────────────────────────────────────────────

function contentTypes(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
</Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(sheets: ExcelSheet[]): string {
  const sheetEls = sheets.map((s, i) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="16384" windowHeight="8192"/></bookViews>
  <sheets>${sheetEls}</sheets>
  <definedNames/>
  <calcPr calcId="162913"/>
</workbook>`;
}

function workbookRels(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

// ─── ZIP writer ───────────────────────────────────────────────────────────────

function zipFiles(files: Record<string, string | Uint8Array>): Blob {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const data    = typeof content === 'string' ? strToBytes(content) : content;
    const nameBytes = strToBytes(name);
    const crc     = crc32(data);
    const size    = data.length;

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + size);
    const dv    = new DataView(local.buffer);
    let p = 0;
    dv.setUint32(p, 0x04034b50, true); p += 4; // sig
    dv.setUint16(p, 20, true);          p += 2; // version needed
    dv.setUint16(p, 0, true);           p += 2; // flags
    dv.setUint16(p, 0, true);           p += 2; // compression (stored)
    dv.setUint16(p, 0, true);           p += 2; // mod time
    dv.setUint16(p, 0, true);           p += 2; // mod date
    dv.setUint32(p, crc, true);         p += 4; // crc32
    dv.setUint32(p, size, true);        p += 4; // compressed size
    dv.setUint32(p, size, true);        p += 4; // uncompressed size
    dv.setUint16(p, nameBytes.length, true); p += 2;
    dv.setUint16(p, 0, true);           p += 2; // extra field length
    local.set(nameBytes, p); p += nameBytes.length;
    local.set(data, p);

    parts.push(local);

    // Central directory entry
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv2 = new DataView(cd.buffer);
    let q = 0;
    dv2.setUint32(q, 0x02014b50, true); q += 4;
    dv2.setUint16(q, 20, true);          q += 2;
    dv2.setUint16(q, 20, true);          q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint32(q, crc, true);         q += 4;
    dv2.setUint32(q, size, true);        q += 4;
    dv2.setUint32(q, size, true);        q += 4;
    dv2.setUint16(q, nameBytes.length, true); q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint16(q, 0, true);           q += 2;
    dv2.setUint32(q, 0, true);           q += 4;
    dv2.setUint32(q, offset, true);      q += 4;
    cd.set(nameBytes, q);
    centralDir.push(cd);

    offset += local.length;
  }

  const cdBytes  = concat(centralDir);
  const cdOffset = offset;
  const cdSize   = cdBytes.length;
  const fileCount = centralDir.length;

  // End of central directory
  const eocd = new Uint8Array(22);
  const dv3  = new DataView(eocd.buffer);
  dv3.setUint32(0, 0x06054b50, true);
  dv3.setUint16(4, 0, true);
  dv3.setUint16(6, 0, true);
  dv3.setUint16(8, fileCount, true);
  dv3.setUint16(10, fileCount, true);
  dv3.setUint32(12, cdSize, true);
  dv3.setUint32(16, cdOffset, true);
  dv3.setUint16(20, 0, true);

  const all = concat([...parts, cdBytes, eocd]);
  return new Blob([toArrayBuffer(all)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function cellAddress(col: number, row: number): string {
  return `${colNumberToLetter(col)}${row + 1}`;
}

function colNumberToLetter(n: number): string {
  let result = '';
  n += 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** CRC-32 (IEEE 802.3) */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Excel date serial (days since 1900-01-00, with the 1900 leap year bug) */
function dateToSerial(d: Date): number {
  const epoch = Date.UTC(1899, 11, 30);
  return (d.getTime() - epoch) / 86_400_000;
}
