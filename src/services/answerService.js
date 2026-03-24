function formatValue(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

function summarizeGenericRows(rows) {
  if (!rows.length) return "No records matched your query.";
  const sample = rows[0];
  const columns = Object.keys(sample).slice(0, 4);
  const preview = columns.map((c) => `${c}: ${formatValue(sample[c])}`).join(", ");
  return `Found ${rows.length} record(s). First row -> ${preview}`;
}

module.exports = {
  summarizeGenericRows,
};
