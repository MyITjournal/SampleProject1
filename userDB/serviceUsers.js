import express from "express";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// MySQL connection pool setup (use createPool, not createConnection)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  idleTimeout: 30000,
  connectTimeout: 2000,
});

const router = express.Router();

// Test DB connection
pool.getConnection()
  .then(connection => {
    console.log("Connected to MySQL database!");
    connection.release();
  })
  .catch(err => {
    console.error("Error connecting to MySQL:", err.message);
  });

// Define a route to fetch data
router.get("/users", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM users");
    res.json(results);
  } catch (err) {
    console.error("Error fetching data:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Route to add user
router.post("/add-user", async (req, res) => {
  if (!req.body || !req.body.name || !req.body.email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const { name, email } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email]
    );
    res.status(201).json({ 
      message: "User added successfully", 
      id: result.insertId 
    });
  } catch (err) {
    console.error("Error adding user:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Update user
router.put("/update-user/:id", async (req, res) => {
  if (!req.body || !req.body.name || !req.body.email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const { name, email } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE users SET name = ?, email = ? WHERE id = ?",
      [name, email, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User updated successfully",
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      id: req.params.id,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete User
router.delete("/delete-user/:id", async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM users WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      affectedRows: result.affectedRows,
      id: req.params.id,
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Export the router for use in other files
export default router;
