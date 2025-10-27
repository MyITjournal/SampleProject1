import express from "express";
import pg from "pg";
import dotenv from "dotenv";
import { createLogger } from "../utils/logger.js";

// Create logger for this module
const logger = createLogger("userDB");

const { Pool } = pg;

// Load environment variables
dotenv.config();

// PostgreSQL connection pool setup
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);
const router = express.Router();

// Test DB connection
pool
  .connect()
  .then((client) => {
    console.log("Connected to PostgreSQL database!");
    client.release();
  })
  .catch((err) => {
    console.error("Error connecting to PostgreSQL:", err.message);
  });

// Define a route to fetch all users
router.get("/users", async (req, res) => {
  const startTime = Date.now();

  try {
    await logger.info("Fetching all users");

    const result = await pool.query(
      "SELECT * FROM users ORDER BY created DESC"
    );

    const duration = Date.now() - startTime;

    await logger.success(`Retrieved ${result.rows.length} users`, {
      count: result.rows.length,
      duration_ms: duration,
    });

    await logger.dbLog("SELECT", "users", duration, result.rows.length);

    res.json({
      status: "success",
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    await logger.error("Error fetching users", {
      error: err.message,
      duration_ms: duration,
    });

    console.error("Error fetching data:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Route to add user using stored procedure
router.post("/add-user", async (req, res) => {
  if (
    !req.body ||
    !req.body.firstname ||
    !req.body.lastname ||
    !req.body.email
  ) {
    return res.status(400).json({
      status: "error",
      message: "Firstname, lastname, email and dateOfBirth are required",
    });
  }

  const { firstname, middlename, lastname, email, dateOfBirth } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM insert_user($1, $2, $3, $4, $5)",
      [firstname, middlename || null, lastname, email, dateOfBirth]
    );

    res.status(201).json({
      status: "success",
      message: "User added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error adding user:", err);
    if (err.code === "23505") {
      // Unique violation
      return res.status(409).json({
        status: "error",
        message: "Email already exists",
      });
    }
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Update user by email using stored procedure
router.put("/update-user/:email", async (req, res) => {
  const { email } = req.params;
  const { firstname, middlename, lastname, dateOfBirth } = req.body;

  // Check if at least one field is provided for update
  if (
    firstname === undefined &&
    middlename === undefined &&
    lastname === undefined &&
    dateOfBirth === undefined
  ) {
    return res.status(400).json({
      status: "error",
      message:
        "At least one field (firstname, middlename, lastname, dateOfBirth) must be provided for update",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM update_user_dynamic($1, $2, $3, $4, $5)",
      [
        email,
        firstname || null,
        middlename || null,
        lastname || null,
        dateOfBirth || null,
      ]
    );

    res.json({
      status: "success",
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating user:", err);
    if (err.message.includes("not found")) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    if (err.message.includes("At least one field")) {
      return res.status(400).json({
        status: "error",
        message: "At least one field must be provided for update",
      });
    }
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Delete User by email using stored procedure
router.delete("/delete-user/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await pool.query("SELECT * FROM delete_user_by_email($1)", [
      email,
    ]);

    res.json({
      status: "success",
      message: "User deleted successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    if (err.message.includes("not found")) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Get user by email
router.get("/user/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await pool.query(
      `SELECT _id, firstname, middlename, lastname, email, "dateOfBirth", created, "lastUpdated"
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Export the router for use in other files
export default router;
