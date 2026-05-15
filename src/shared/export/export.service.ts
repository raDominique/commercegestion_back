import { Injectable } from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import * as path from 'node:path';

@Injectable()
export class ExportService {
  constructor(private readonly uploadService: UploadService) {}

  async exportCSV(
    data: Record<string, any>[],
    fields: string[],
    subfolder: string,
    filename?: string,
  ): Promise<string> {
    const { Parser } = require('json2csv');
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    const name = filename || `export_${subfolder}_${Date.now()}.csv`;
    const fakeFile = {
      buffer: Buffer.from(csv, 'utf-8'),
      originalname: name,
      mimetype: 'text/csv',
    } as Express.Multer.File;
    return this.uploadService.saveFile(fakeFile, subfolder);
  }

  async exportExcel(
    data: Record<string, any>[],
    columns: { header: string; key: string }[],
    sheetName: string,
    subfolder: string,
    filename?: string,
  ): Promise<string> {
    const headerRow = columns.map((c) => c.header);
    const keys = columns.map((c) => c.key);
    const rows = data.map((item) => keys.map((key) => item[key] ?? ''));
    const wsData = [headerRow, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const name = filename || `export_${subfolder}_${Date.now()}.xlsx`;
    const fakeFile = {
      buffer,
      originalname: name,
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as Express.Multer.File;
    return this.uploadService.saveFile(fakeFile, subfolder);
  }

  async exportPDF(
    title: string,
    headers: string[],
    rows: any[][],
    subfolder: string,
    filename?: string,
  ): Promise<string> {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));

    return new Promise<string>((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const buffer = Buffer.concat(buffers);
          const name = filename || `export_${subfolder}_${Date.now()}.pdf`;
          const fakeFile = {
            buffer,
            originalname: name,
            mimetype: 'application/pdf',
          } as Express.Multer.File;
          const url = await this.uploadService.saveFile(fakeFile, subfolder);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });
      doc.on('error', reject);

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
          doc.text(h, x + 2, y + 4, {
            width: colWidth - 4,
            align: 'left',
          });
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
        row.forEach((cell, i) => {
          const text = cell != null ? String(cell) : '';
          doc.rect(x, y, colWidth, 16).stroke();
          doc.text(text, x + 2, y + 3, {
            width: colWidth - 4,
            align: 'left',
          });
          x += colWidth;
        });
        doc.y = y + 16;
      }

      doc.end();
    });
  }
}
