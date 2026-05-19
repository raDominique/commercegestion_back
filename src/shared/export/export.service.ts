import { Injectable, StreamableFile } from '@nestjs/common';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

@Injectable()
export class ExportService {
  async exportCSV(
    data: Record<string, any>[],
    fields: string[],
    filename: string,
  ): Promise<ExportResult> {
    const { Parser } = require('json2csv');
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    const buffer = Buffer.from('\uFEFF', 'utf-8');
    return {
      buffer: Buffer.concat([buffer, Buffer.from(csv, 'utf-8')]),
      filename,
      mimeType: 'text/csv',
    };
  }

  async exportExcel(
    data: Record<string, any>[],
    columns: { header: string; key: string }[],
    sheetName: string,
    filename: string,
  ): Promise<ExportResult> {
    const headerRow = columns.map((c) => c.header);
    const keys = columns.map((c) => c.key);
    const rows = data.map((item) => keys.map((key) => item[key] ?? ''));
    const wsData = [headerRow, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return {
      buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
      filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportPDF(
    title: string,
    headers: string[],
    rows: any[][],
    filename: string,
  ): Promise<ExportResult> {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    return new Promise<ExportResult>((resolve, reject) => {
      doc.on('end', () => {
        try {
          resolve({
            buffer: Buffer.concat(buffers),
            filename,
            mimeType: 'application/pdf',
          });
        } catch (err) {
          reject(err);
        }
      });

      doc.on('error', reject);

      const bom = Buffer.from('\uFEFF', 'utf-8');

      doc.fontSize(16).text(title, { align: 'center' });
      doc.moveDown(1.5);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = pageWidth / headers.length;

      const drawTableHeader = () => {
        let x = doc.page.margins.left;
        const y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        headers.forEach((h, i) => {
          doc.rect(x, y, colWidth, 18).stroke();
          doc.text(h, x + 2, y + 4, { width: colWidth - 4, align: 'left' });
          x += colWidth;
        });
        doc.y = y + 18;
      };

      drawTableHeader();

      doc.font('Helvetica').fontSize(8);
      for (const row of rows) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          drawTableHeader();
          doc.font('Helvetica').fontSize(8);
        }

        let x = doc.page.margins.left;
        const y = doc.y;
        row.forEach((cell) => {
          const text = cell != null ? String(cell) : '';
          doc.rect(x, y, colWidth, 16).stroke();
          doc.text(text, x + 2, y + 3, { width: colWidth - 4, align: 'left' });
          x += colWidth;
        });
        doc.y = y + 16;
      }

      doc.end();
    });
  }

  toStreamableFile(result: ExportResult): StreamableFile {
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
