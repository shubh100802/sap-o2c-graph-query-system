require("dotenv").config();

const { pool } = require("../config/db");
const { schemaStatements } = require("../schema/schemaSql");

async function ensureDatabase() {
  const dbName = process.env.DB_NAME || "sap_o2c";
  const adminPool = require("mysql2/promise").createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await adminPool.end();
}

async function initSchema() {
  await ensureDatabase();
  for (const statement of schemaStatements) {
    await pool.query(statement);
  }
  console.log("Schema initialized successfully.");
}

initSchema()
  .catch((error) => {
    console.error("Schema initialization failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
