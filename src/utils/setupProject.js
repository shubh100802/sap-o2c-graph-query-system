require("dotenv").config();

const { execSync } = require("child_process");

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit" });
}

function validateEnv() {
  const missing = [];
  if (!process.env.DB_HOST) missing.push("DB_HOST");
  if (!process.env.DB_PORT) missing.push("DB_PORT");
  if (!process.env.DB_USER) missing.push("DB_USER");
  if (process.env.DB_PASSWORD === undefined) missing.push("DB_PASSWORD");
  if (!process.env.DB_NAME) missing.push("DB_NAME");

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
}

function main() {
  validateEnv();
  run("npm run init-db");
  run("npm run check-db");
  run("npm run load-data");
  console.log("\nSetup completed successfully. You can now run: npm start");
}

try {
  main();
} catch (error) {
  console.error("\nSetup failed:", error.message);
  process.exit(1);
}
