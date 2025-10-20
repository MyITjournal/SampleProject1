import express from "express";
import axios from "axios";

const router = express.Router();

// Original hardcoded /me route
router.get("/me", async (req, res) => {
  try {
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

export default router;
