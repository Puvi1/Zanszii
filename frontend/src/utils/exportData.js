export const exportPdf = (
  title,
  headers,
  rows,
  filename = "report.pdf"
) => {
  const printableRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="border:1px solid #ddd;padding:8px;">${
                cell ?? ""
              }</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  const printableHeaders = headers
    .map(
      (header) =>
        `<th style="border:1px solid #ddd;padding:8px;background:#f5f5f5;">${header}</th>`
    )
    .join("");

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Please allow pop-ups to export the PDF.");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
      </head>

      <body style="font-family:Arial,sans-serif;padding:24px;">
        <h1>${title}</h1>

        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>${printableHeaders}</tr>
          </thead>

          <tbody>
            ${printableRows}
          </tbody>
        </table>

        <script>
          window.onload = function () {
            window.print();
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
  const escapeValue = (value) => {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  };

  const csvContent = [
    headers.map(escapeValue).join(","),
    ...rows.map((row) => row.map(escapeValue).join(",")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  const csvFilename = filename
    .replace(/\.xlsx$/i, ".csv")
    .replace(/\.xls$/i, ".csv");

  link.href = url;

  link.download = csvFilename.endsWith(".csv")
    ? csvFilename
    : `${csvFilename}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
};

export const exportRowsToPdf = (
  title,
  headers,
  rows,
  filename = "report.pdf"
) => {
  return exportPdf(title, headers, rows, filename);
};

export const exportRowsToExcel = (
  headers,
  rows,
  filename = "report.xlsx",
  sheetName = "Sheet1"
) => {
  return exportExcel(headers, rows, filename, sheetName);
};
