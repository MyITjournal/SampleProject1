import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Heroku provides DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

async function runMigrations() {
  try {
    console.log("Running database migrations...");

    // Run strings table schema
    const stringsSchemaPath = path.join(
      __dirname,
      "../stringManipulation/schema.sql"
    );
    const stringsSchema = fs.readFileSync(stringsSchemaPath, "utf8");
    await pool.query(stringsSchema);
    console.log("✅ Strings table schema applied");

    // Run users table schema
    const usersSchemaPath = path.join(__dirname, "../userDB/schema.sql");
    const usersSchema = fs.readFileSync(usersSchemaPath, "utf8");
    await pool.query(usersSchema);
    console.log("✅ Users table schema applied");

    // Run stored procedures
    const proceduresPath = path.join(__dirname, "../userDB/procedures.sql");
    const procedures = fs.readFileSync(proceduresPath, "utf8");
    await pool.query(procedures);
    console.log("✅ Stored procedures applied");

    // Run currency exchange schema
    const currencySchemaPath = path.join(
      __dirname,
      "../currencyExchange/schema.sql"
    );
    const currencySchema = fs.readFileSync(currencySchemaPath, "utf8");
    await pool.query(currencySchema);
    console.log("✅ Currency exchange schema applied");

    console.log("✅ All migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1); // Exit with error to prevent deployment
  } finally {
    await pool.end();
  }
}

runMigrations();
