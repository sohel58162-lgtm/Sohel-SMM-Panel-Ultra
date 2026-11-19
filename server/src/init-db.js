import { pool } from "./db.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");

try {
  await pool.query(sql);
  console.log("Database schema initialized successfully.");
} catch (error) {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
