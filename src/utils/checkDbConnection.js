require("dotenv").config();

const { testConnection, pool } = require("../config/db");

async function main() {
  const ok = await testConnection();
  if (!ok) {
    console.error("Database connection failed. Check DB_USER / DB_PASSWORD / DB_HOST / DB_PORT in .env.");
    process.exit(1);
  }
  console.log("Database connection successful.");
}

main()
  .catch((error) => {
    console.error("DB check failed:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
