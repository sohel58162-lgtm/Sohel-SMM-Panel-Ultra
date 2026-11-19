import pg from "pg";
import dotenv from "dotenv";

// Local development uses server/.env. Render injects environment variables directly.
dotenv.config({ path: process.env.ENV_FILE || ".env" });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is missing. Add it to server/.env or the hosting environment.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
