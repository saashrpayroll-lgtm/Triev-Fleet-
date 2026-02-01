import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = (data: any[], fileName: string) => {
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        return true;
    } catch (error) {
        console.error("Export failed", error);
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

export const downloadRiderTemplate = () => {
    const headers = [{
        "Rider Name": "",
        "Triev ID": "",
        "Mobile Number": "",
        "Chassis Number": "",
        "Team Leader": "",
        "Client Name": "",
        "Allotment Date": new Date().toISOString().split('T')[0],
        "Wallet Amount": "0",
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
