require("dotenv").config();

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const csvParser = require("csv-parser");
const { pool } = require("../config/db");
const { knownTables } = require("../constants/tableConfig");

const datasetRoot = process.env.DATASET_PATH || "D:/Dodge/sap-o2c-data";
const batchSize = Number(process.env.LOADER_BATCH_SIZE || 500);
const preferredFolderOrder = [
  "business_partners",
  "business_partner_addresses",
  "products",
  "product_descriptions",
  "plants",
  "sales_order_headers",
  "sales_order_items",
  "sales_order_schedule_lines",
  "outbound_delivery_headers",
  "outbound_delivery_items",
  "billing_document_headers",
  "billing_document_items",
  "billing_document_cancellations",
  "journal_entry_items_accounts_receivable",
  "payments_accounts_receivable",
  "customer_company_assignments",
  "customer_sales_area_assignments",
  "product_plants",
  "product_storage_locations",
];

function toSnakeCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeValue(value) {
  if (value === undefined || value === "") return null;
  if (value === null) return null;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

async function getExistingColumns(tableName) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field));
}

async function createGenericTableIfMissing(tableName) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      raw_data JSON NULL
    )
  `);
}

async function ensureColumns(tableName, columns, columnCache) {
  let existing = columnCache.get(tableName);
  if (!existing) {
    existing = await getExistingColumns(tableName);
    columnCache.set(tableName, existing);
  }

  for (const column of columns) {
    if (!existing.has(column)) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${column}\` LONGTEXT NULL`);
      existing.add(column);
    }
  }
}

async function insertBatch(tableName, batchRows, columnCache) {
  if (!batchRows.length) return;

  const allColumns = new Set(["raw_data"]);
  for (const row of batchRows) {
    Object.keys(row).forEach((key) => allColumns.add(key));
  }
  const columns = Array.from(allColumns);

  await ensureColumns(tableName, columns, columnCache);

  const placeholders = batchRows
    .map(() => `(${columns.map(() => "?").join(", ")})`)
    .join(", ");
  const values = [];

  for (const row of batchRows) {
    const rawData = {};
    for (const [key, value] of Object.entries(row)) {
      rawData[key] = value;
    }
    for (const column of columns) {
      if (column === "raw_data") {
        values.push(JSON.stringify(rawData));
      } else {
        values.push(row[column] ?? null);
      }
    }
  }

  const sql = `INSERT IGNORE INTO \`${tableName}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES ${placeholders}`;
  await pool.query(sql, values);
}

function normalizeRecord(record) {
  const output = {};
  for (const [key, value] of Object.entries(record)) {
    output[toSnakeCase(key)] = normalizeValue(value);
  }
  return output;
}

async function ingestJsonlFile(filePath, tableName, columnCache) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let batch = [];

  for await (const line of rl) {
    if (!line || !line.trim()) continue;
    const parsed = JSON.parse(line);
    batch.push(normalizeRecord(parsed));
    if (batch.length >= batchSize) {
      await insertBatch(tableName, batch, columnCache);
      batch = [];
    }
  }

  if (batch.length) {
    await insertBatch(tableName, batch, columnCache);
  }
}

function ingestCsvFile(filePath, tableName, columnCache) {
  return new Promise((resolve, reject) => {
    const batch = [];
    const readStream = fs.createReadStream(filePath).pipe(csvParser());

    readStream.on("data", async (row) => {
      readStream.pause();
      try {
        batch.push(normalizeRecord(row));
        if (batch.length >= batchSize) {
          const copy = batch.splice(0, batch.length);
          await insertBatch(tableName, copy, columnCache);
        }
        readStream.resume();
      } catch (error) {
        reject(error);
      }
    });

    readStream.on("end", async () => {
      try {
        if (batch.length) {
          await insertBatch(tableName, batch, columnCache);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    readStream.on("error", reject);
  });
}

async function ingestFolder(folderPath, folderName, columnCache) {
  const tableName = toSnakeCase(folderName);
  if (!knownTables.has(tableName)) {
    console.log(`Skipping unknown folder: ${folderName}`);
    return;
  }

  await createGenericTableIfMissing(tableName);

  const files = fs
    .readdirSync(folderPath)
    .filter((name) => name.endsWith(".jsonl") || name.endsWith(".csv"));

  for (const fileName of files) {
    const filePath = path.join(folderPath, fileName);
    console.log(`Loading ${filePath} -> ${tableName}`);

    if (fileName.endsWith(".jsonl")) {
      await ingestJsonlFile(filePath, tableName, columnCache);
    } else {
      await ingestCsvFile(filePath, tableName, columnCache);
    }
  }
}

async function loadData() {
  if (!fs.existsSync(datasetRoot)) {
    throw new Error(`Dataset path not found: ${datasetRoot}`);
  }

  let folderEntries = fs
    .readdirSync(datasetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  const orderIndex = new Map(preferredFolderOrder.map((name, idx) => [name, idx]));
  folderEntries = folderEntries.sort((a, b) => {
    const ai = orderIndex.has(a.name) ? orderIndex.get(a.name) : 9999;
    const bi = orderIndex.has(b.name) ? orderIndex.get(b.name) : 9999;
    return ai - bi;
  });

  const columnCache = new Map();
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const entry of folderEntries) {
      await ingestFolder(path.join(datasetRoot, entry.name), entry.name, columnCache);
    }
  } finally {
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  }

  console.log("Data loading completed.");
}

loadData()
  .catch((error) => {
    console.error("Data loading failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
