import express from "express";
import mysql from "mysql2";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

// Load environment variables
dotenv.config();

const app = express();
// Add middlewares
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 3000;

// MySQL connection setup
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err.message);
    return;
  }
  console.log("Connected to MySQL database!");
});

// Define a route to fetch data
app.get("/users", (req, res) => {
  const query = "SELECT * FROM users";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

//Route to update data
app.post("/add-user", (req, res) => {
  if (!req.body || !req.body.name || !req.body.email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const { name, email } = req.body;
  const query = "INSERT INTO users (name, email) VALUES (?, ?)";
  db.query(query, [name, email], (err, result) => {
    if (err) {
      console.error("Error adding user:", err);
      return res.status(500).json({ error: err.message });
    }
    res
      .status(201)
      .json({ message: "User added successfully", id: result.insertId });
  });
});

//Upodate data
app.put("/update-user/:id", (req, res) => {
  if (!req.body || !req.body.name || !req.body.email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const { name, email } = req.body;
  const query = "UPDATE users SET name = ?, email = ? WHERE id = ?";
  db.query(query, [name, email, req.params.id], (err, result) => {
    if (err) {
      console.error("Error updating user:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User updated successfully",
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      id: req.params.id,
    });
  });
});

//Delete User
app.delete("/delete-user/:id", (req, res) => {
  const query = "DELETE FROM users WHERE id = ?";
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      console.error("Error deleting user:", err);
      return res.status(500).json({ error: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      affectedRows: result.affectedRows,
      id: req.params.id,
    });
  });
});

// Helper function to get random user
const getRandomUser = () => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM users ORDER BY RAND() LIMIT 1";
    db.query(query, (err, results) => {
      if (err) reject(err);
      resolve(results[0]);
    });
  });
};

// Profile endpoint
app.get("/me", async (req, res) => {
  try {
    // Fetch cat fact and random user in parallel
    const [catFactResponse, randomUser] = await Promise.all([
      axios.get("https://catfact.ninja/fact"),
      getRandomUser(),
    ]);

    if (!randomUser) {
      throw new Error("No users found in database");
    }

    const profile = {
      status: "success",
      user: {
        email: randomUser.email,
        name: randomUser.name,
        stack: "Node.js, Express, MySQL", // Keep this static or add to your users table
      },
      timestamp: new Date().toISOString(),
      fact: catFactResponse.data.fact,
    };

    res.json(profile);
  } catch (error) {
    console.error("Error fetching profile data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch profile data",
    });
  }
});

// Export the app for use in other files
export default app;
