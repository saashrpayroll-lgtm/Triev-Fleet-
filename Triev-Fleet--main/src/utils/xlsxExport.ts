/**
 * xlsxExport.ts — Shared ExcelJS export helper
 * ─────────────────────────────────────────────
 * Replaces the vulnerable `xlsx` (SheetJS) package.
 * Use this instead of XLSX.utils.json_to_sheet + XLSX.writeFile in all pages.
 *
 * Usage:
 *   import { jsonToExcel } from '@/utils/xlsxExport';
 *   await jsonToExcel(data, 'Sheet Name', 'filename');
 */

import ExcelJS from 'exceljs';

/**
 * Export an array of objects to an xlsx file and trigger browser download.
 * @param data        Array of plain objects (keys become column headers)
 * @param sheetName   Name of the worksheet tab
 * @param fileName    Download file name (without .xlsx extension)
 */
export const jsonToExcel = async (
    data: Record<string, any>[],
    sheetName: string,
    fileName: string
): Promise<void> => {
    if (!data.length) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triev Fleet';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    // Derive columns from first row
    const columns = Object.keys(data[0]);
    worksheet.columns = columns.map(key => ({
        header: key,
        key,
        width: Math.max(15, key.length + 4)
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF090924' }  // Triev dark navy
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFF97316' } }  // Orange accent
        };
    });
    headerRow.height = 20;

    // Add data rows with alternating fill
    data.forEach((row, idx) => {
        const addedRow = worksheet.addRow(row);
        if (idx % 2 === 0) {
            addedRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8FAFC' }
                };
            });
        }
    });

    // Trigger browser download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName}.xlsx`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};
