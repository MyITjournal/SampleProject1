/*****************************************************************************
 *Modification History
 *v0.1: A.ADEBAYO: 2015-10-18: Added /me endpoint that selects a user and randomly
 *v0.2: A.ADEBAYO: 2015-10-18: Added database version under /dbuser/me
 ******************************************************************************/
import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import dbUserRouter from './dbUser.js';

//load the environment variables
dotenv.config();

const app = express();

//Add middlewares
app.use(express.json());

const port = process.env.PORT || 3000;

// Add database user routes under /dbuser prefix
app.use('/dbuser', dbUserRouter);

// Original hardcoded /me route
app.get("/me", async (req, res) => {
  try {
    // Use hard-coded user info instead of querying the database
    const user = {
      user_name: "Adeyoola Adebayo",
      email: "adeaboyade@gmail.com",
    };

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
        stack: "Node.js / Express / PostgreSQL",
      },
      timestamp: new Date().toISOString(),
      fact: catFactResponse.data?.fact || null,
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
