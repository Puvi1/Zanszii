import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const safe = (value) => value ?? "";

export function exportRowsToExcel({ rows, columns, fileName, sheetName = "Report" }) {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label, safe(column.value(row))]))
  );
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportRowsToPdf({ rows, columns, fileName, title, landscape = false }) {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait" });
  doc.setFontSize(18);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
  autoTable(doc, {
    startY: 31,
    head: [columns.map((column) => column.label)],
    body: rows.map((row) => columns.map((column) => String(safe(column.value(row))))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 76, 156] },
    alternateRowStyles: { fillColor: [245, 249, 255] },
  });
  doc.save(`${fileName}.pdf`);
}

