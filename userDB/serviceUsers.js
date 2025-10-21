import express from "express";
import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;

// Load environment variables
dotenv.config();

// PostgreSQL connection pool setup
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

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
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY created DESC"
    );
    res.json({
      status: "success",
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching data:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Route to add user
router.post("/add-user", async (req, res) => {
  if (
    !req.body ||
    !req.body.firstname ||
    !req.body.lastname ||
    !req.body.email
  ) {
    return res.status(400).json({
      status: "error",
      message: "Firstname, lastname, and email are required",
    });
  }

  const { firstname, middlename, lastname, email, dateOfBirth } = req.body;
  try {
    const query = `
      INSERT INTO users (firstname, middlename, lastname, email, "dateOfBirth")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING _id, firstname, middlename, lastname, email, "dateOfBirth", created
    `;
    const values = [
      firstname,
      middlename || null,
      lastname,
      email,
      dateOfBirth,
    ];
    const result = await pool.query(query, values);

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

// Update user by email
router.put("/update-user/:email", async (req, res) => {
  if (!req.body || !req.body.firstname || !req.body.lastname) {
    return res.status(400).json({
      status: "error",
      message: "Firstname and lastname are required",
    });
  }

  const { firstname, middlename, lastname, dateOfBirth } = req.body;
  const { email } = req.params;

  try {
    const query = `
      UPDATE users 
      SET firstname = $1, middlename = $2, lastname = $3, "dateOfBirth" = $4, "lastUpdated" = CURRENT_TIMESTAMP
      WHERE email = $5
      RETURNING _id, firstname, middlename, lastname, email, "dateOfBirth", "lastUpdated"
    `;
    const values = [
      firstname,
      middlename || null,
      lastname,
      dateOfBirth,
      email,
    ];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.json({
      status: "success",
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Delete User by email
router.delete("/delete-user/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM users WHERE email = $1 RETURNING _id, email, firstname, lastname",
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
      message: "User deleted successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Error deleting user:", err);
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
