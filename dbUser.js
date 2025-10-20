/*****************************************************************************
 *Modification History
 * v0.1: A.ADEYOLA: 2025-10-18:  Initial Design - with select, create, update, delete
 *v0.2: A.ADEBAYO: 2015-10-18: Added /me endpoint that selects a user and randomly
 *                            ...fetches a cat fact
 *v0.3: A.ADEBAYO: 2015-10-18: Optimizations to only return my details
 *v0.4: A.ADEBAYO: 2015-10-18: Changed database from MySQL to PostgreSQL
 *v0.5: A.ADEBAYO: 2015-10-18: Updated to use new PostgreSQL users table schema.
 * ******************************************************************************/
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import pg from "pg";

const { Pool } = pg;

//load the environment variables
dotenv.config();

const app = express();

//Add middlewares
app.use(express.json());

const port = process.env.PORT || 3000;

// Setup PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  // Add connection pool optimization
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const router = express.Router();

// Function to get just one user
const getUser = async () => {
  const query = `
    SELECT 
      CONCAT(firstname, ' ', COALESCE(middlename || ' ', ''), lastname) as user_name,
      email,
      "dateOfBirth"
    FROM public.users 
    ORDER BY RANDOM()
    LIMIT 1
  `;
  const result = await pool.query(query);
  return result.rows[0];
};

// Optimize route handler to run operations in parallel
router.get("/me", async (req, res) => {
  try {
    // Run database query and cat fact fetch in parallel
    const [user, catFactResponse] = await Promise.all([
      getUser(),
      axios.get("https://catfact.ninja/fact"),
    ]);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No user found in database",
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: "success",
      user: {
        email: user.email,
        name: user.user_name,
        dateOfBirth: user.dateOfBirth,
        stack: "Node.js / Express / PostgreSQL",
      },
      timestamp: new Date().toISOString(),
      fact: catFactResponse.data.fact,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    });
  }
});

// Export router instead of app
export default router;
