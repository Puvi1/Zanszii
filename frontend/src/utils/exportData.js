const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeColumns = (columns = []) =>
  columns.map((column) => {
    if (typeof column === "string") {
      return {
        label: column,
        value: (row) => row?.[column] ?? "",
      };
    }

    return {
      label: column.label || column.key || "Column",
      value:
        typeof column.value === "function"
          ? column.value
          : (row) => row?.[column.value || column.key] ?? "",
    };
  });

const normalizeRows = (rows = [], columns = []) => {
  const normalizedColumns = normalizeColumns(columns);

  return rows.map((row) =>
    normalizedColumns.map((column) => {
      try {
        return column.value(row);
      } catch {
        return "";
      }
    })
  );
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
};

export const exportPdf = (
  title,
  headers,
  rows,
  filename = "report.pdf",
  landscape = false
) => {
  if (!rows?.length) {
    window.alert("No data available to export.");
    return;
  }

  const printableHeaders = headers
    .map(
      (header) => `
        <th>
          ${escapeHtml(header)}
        </th>
      `
    )
    .join("");

  const printableRows = rows
    .map(
      (row) => `
        <tr>
          ${row
            .map(
              (cell) => `
                <td>
                  ${escapeHtml(cell)}
                </td>
              `
            )
            .join("")}
        </tr>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Please allow pop-ups to export the PDF.");
    return;
  }

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />

        <title>${escapeHtml(title)}</title>

        <style>
          @page {
            size: ${landscape ? "A4 landscape" : "A4 portrait"};
            margin: 16mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
          }

          .report-header {
            margin-bottom: 24px;
            border-bottom: 3px solid #0f4c9c;
            padding-bottom: 14px;
          }

          .report-header h1 {
            margin: 0;
            font-size: 24px;
          }

          .report-header p {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          th {
            border: 1px solid #cbd5e1;
            background: #eaf3ff;
            padding: 9px;
            text-align: left;
            font-weight: 700;
          }

          td {
            border: 1px solid #cbd5e1;
            padding: 9px;
            vertical-align: top;
          }

          tr:nth-child(even) {
            background: #f8fafc;
          }

          .footer {
            margin-top: 18px;
            color: #64748b;
            font-size: 10px;
          }
        </style>
      </head>

      <body>
        <div class="report-header">
          <h1>${escapeHtml(title)}</h1>

          <p>
            Generated on ${new Date().toLocaleString("en-IN")}
          </p>
        </div>

        <table>
          <thead>
            <tr>${printableHeaders}</tr>
          </thead>

          <tbody>
            ${printableRows}
          </tbody>
        </table>

        <div class="footer">
          Zanszii Order Management
        </div>

        <script>
          window.onload = function () {
            setTimeout(function () {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};

export const exportExcel = (
  headers,
  rows,
  filename = "report.csv",
  sheetName = "Sheet1"
) => {
  if (!rows?.length) {
    window.alert("No data available to export.");
    return;
  }

  const escapeCsv = (value) => {
    const text = String(value ?? "").replaceAll('"', '""');
    return `"${text}"`;
  };

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\r\n");

  const finalFileName = String(filename)
    .replace(/\.xlsx$/i, ".csv")
    .replace(/\.xls$/i, ".csv");

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });

  downloadBlob(
    blob,
    finalFileName.endsWith(".csv")
      ? finalFileName
      : `${finalFileName}.csv`
  );
};

export const exportRowsToPdf = (...args) => {
  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0])
  ) {
    const {
      rows = [],
      columns = [],
      fileName = "report",
      title = "Report",
      landscape = false,
    } = args[0];

    const normalizedColumns = normalizeColumns(columns);
    const headers = normalizedColumns.map((column) => column.label);
    const normalizedRows = normalizeRows(rows, columns);

    return exportPdf(
      title,
      headers,
      normalizedRows,
      fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`,
      landscape
    );
  }

  const [
    title,
    headers,
    rows,
    filename = "report.pdf",
    landscape = false,
  ] = args;

  return exportPdf(title, headers, rows, filename, landscape);
};

export const exportRowsToExcel = (...args) => {
  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0])
  ) {
    const {
      rows = [],
      columns = [],
      fileName = "report",
      sheetName = "Sheet1",
    } = args[0];

    const normalizedColumns = normalizeColumns(columns);
    const headers = normalizedColumns.map((column) => column.label);
    const normalizedRows = normalizeRows(rows, columns);

    return exportExcel(
      headers,
      normalizedRows,
      fileName,
      sheetName
    );
  }

  const [
    headers,
    rows,
    filename = "report.csv",
    sheetName = "Sheet1",
  ] = args;

  return exportExcel(headers, rows, filename, sheetName);
};
