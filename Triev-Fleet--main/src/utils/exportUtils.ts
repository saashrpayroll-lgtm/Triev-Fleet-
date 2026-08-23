import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Helper: trigger browser download of an ExcelJS workbook.
 * Works in all browsers — creates a Blob URL and auto-clicks it.
 */
const downloadWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportToExcel = async (data: any[], fileName: string) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        if (data.length === 0) return false;

        // Auto-detect columns from first row keys
        const columns = Object.keys(data[0]);
        worksheet.columns = columns.map(key => ({ header: key, key, width: 20 }));

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        data.forEach(row => worksheet.addRow(row));

        await downloadWorkbook(workbook, fileName);
        return true;
    } catch (error) {
        console.error('Export failed', error);
        return false;
    }
};

export const exportRidersToCSV = (data: any[], fileName: string) => {
    try {
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${fileName}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        return true;
    } catch (error) {
        console.error("CSV Export failed", error);
        return false;
    }
};

export const exportRidersToExcel = exportToExcel;
export const exportToCSV = exportRidersToCSV;

export const exportRidersToPDF = (data: any[], fileName: string, title: string) => {
    try {
        const doc = new jsPDF();

        doc.text(title, 14, 22);

        const tableColumn = ["Triev ID", "Name", "Mobile", "Client", "Status", "Wallet"];
        const tableRows = data.map(rider => [
            rider.trievId,
            rider.riderName,
            rider.mobileNumber,
            rider.clientName,
            rider.status,
            rider.walletAmount
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
        });

        doc.save(`${fileName}.pdf`);
        return true;
    } catch (error) {
        console.error("PDF Export failed", error);
        return false;
    }
};

export const exportGenericToPDF = (data: any[], columns: string[], fileName: string, title: string) => {
    try {
        const doc = new jsPDF();
        doc.text(title, 14, 22);

        // Map data to rows based on columns
        const tableRows = data.map(item => columns.map(col => item[col]));

        autoTable(doc, {
            head: [columns], // Use columns as-is, they are already formatted
            body: tableRows,
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`${fileName}.pdf`);
        return true;
    } catch (error) {
        console.error("PDF Export failed", error);
        return false;
    }
};

export const exportToPDF = exportGenericToPDF;

/**
 * Premium Branded Performance PDF Exporter
 * Includes Triev Header, Date Stamp, Watermark, and Styled Summary Tables
 */
export const exportBrandedPerformancePDF = (
    title: string,
    summaryKpis: { label: string; value: string }[],
    columns: string[],
    rows: (string | number)[][],
    fileName: string
) => {
    try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const todayStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date());

        // Header Background Banner
        doc.setFillColor(9, 9, 36); // #090924 Cyber Dark
        doc.rect(0, 0, 297, 28, 'F');

        // Brand Accent Line
        doc.setFillColor(249, 115, 22); // Orange accent
        doc.rect(0, 28, 297, 2, 'F');

        // Header Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("TRIEV RIDER TECHNOLOGIES", 14, 12);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(249, 115, 22);
        doc.text("FLEET PERFORMANCE & ANALYTICS REPORT V2.5", 14, 18);

        doc.setTextColor(180, 185, 200);
        doc.setFontSize(8);
        doc.text(`Generated: ${todayStr}`, 200, 12);
        doc.text(`Report: ${title}`, 200, 18);

        // KPI Summary Cards Bar
        let currentX = 14;
        const cardWidth = 52;
        const startY = 35;

        summaryKpis.slice(0, 5).forEach((kpi) => {
            doc.setFillColor(245, 247, 250);
            doc.setDrawColor(220, 225, 235);
            doc.roundedRect(currentX, startY, cardWidth, 16, 2, 2, 'FD');

            doc.setTextColor(100, 110, 135);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.label.toUpperCase(), currentX + 4, startY + 5);

            doc.setTextColor(15, 23, 42);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.value, currentX + 4, startY + 12);

            currentX += cardWidth + 5;
        });

        // Main Performance Data Table
        autoTable(doc, {
            head: [columns],
            body: rows as any,
            startY: startY + 22,
            styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
            headStyles: {
                fillColor: [9, 9, 36],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'left'
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 35, bottom: 15, left: 14, right: 14 },
            didDrawPage: () => {
                // Page Footer
                const str = `Page ${doc.getNumberOfPages()}`;
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(str, 270, 202);
                doc.text("Confidential — Triev Fleet Internal Operations", 14, 202);
            }
        });

        doc.save(`${fileName}.pdf`);
        return true;
    } catch (err) {
        console.error("Branded PDF export failed", err);
        return false;
    }
};

export const downloadRiderTemplate = () => {
    const headers = [{
        "Triev ID": "",
        "Rider Name": "",
        "Mobile Number": "",
        "Chassis Number": "",
        "Wallet Amount": "0",
        "Team Leader": "",
        "Allotment Date": new Date().toISOString().split('T')[0],
        "Client Name": "",
        "Status": "active",
        "Remarks": ""
    }];
    exportRidersToCSV(headers, "Rider_Import_Template");
};

export const downloadWalletTemplate = () => {
    const headers = [{
        "Triev ID": "",
        "Mobile Number": "",
        "Wallet Amount": ""
    }];
    exportRidersToCSV(headers, "Wallet_Update_Template");
};

export const downloadRentCollectionTemplate = () => {
    const headers = [{
        "Triev ID": "",
        "Rider Name": "",
        "Mobile Number": "",
        "Type": "Rent",
        "Amount": "0",
        "Transaction ID": "" // Added for duplicate check
    }];
    exportRidersToCSV(headers, "Rent_Collection_Template");
};
