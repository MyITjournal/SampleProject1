/*****************************************************************************
 *Modification History
 * v0.1: A.ADEY: 2025-10-18:  Initial Design - with select, create, update, delete
 *v0.2: A.ADEBAYO: 2015-10-18: Added /me endpoint that selects a user and randomly
 *                            ...fetches a cat fact
 *v0.3: A.ADEBAYO: 2015-10-18: Optimizations to only return my details
 * ******************************************************************************/
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2";
import axios from "axios";

//load the environment variables
dotenv.config();

const app = express();

//Add middlewares
app.use(express.json());

const port = process.env.PORT || 3000;

// Setup MySQL connection
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
  console.log(`Connected to MySQL database: ${process.env.DB_NAME}`);
});

// Function to get just one user
const getUser = () => {
  return new Promise((resolve, reject) => {
    // First verify if table exists
    db.query("SHOW TABLES LIKE 'user_profiles'", (err, tables) => {
      if (err) {
        console.error("Error checking table:", err);
        return reject(err);
      }

      if (tables.length === 0) {
        console.error("Table 'user_profiles' does not exist");
        return reject(new Error("Table does not exist"));
      }

      // If table exists, get the user
      const query = "SELECT user_name, email FROM user_profiles LIMIT 1";
      db.query(query, (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          return reject(err);
        }
        if (!results || results.length === 0) {
          return resolve(null);
        }
        resolve(results[0]);
      });
    });
  });
};

// Route to get the user with a random cat fact
app.get("/me", async (req, res) => {
  try {
    let user;
    try {
      user = await getUser();
    } catch (dbError) {
      console.error("Database error:", dbError);
      return res.status(500).json({
        status: "error",
        message: "Database error: " + dbError.message,
        timestamp: new Date().toISOString(),
      });
    }

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No user found in database",
        timestamp: new Date().toISOString(),
      });
    }

    let catFactResponse;
    try {
      catFactResponse = await axios.get("https://catfact.ninja/fact");
    } catch (apiError) {
      console.error("Cat API error:", apiError);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch cat fact",
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: "success",
      user: {
        email: user.email,
        name: user.user_name,
        stack: "Node.js / Express / MySQL",
      },
      timestamp: new Date().toISOString(),
      fact: catFactResponse.data.fact,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      status: "error",
      message: "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    });
  }
});

// Export the app for use in other files
export default app;
