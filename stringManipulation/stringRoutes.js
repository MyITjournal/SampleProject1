import express from "express";
import {
  createString,
  getStringByValue,
  getAllStrings,
  deleteString,
  processNaturalQuery,
  processNaturalQueryGet,
} from "./stringController.js";

const router = express.Router();

// IMPORTANT: Specific routes MUST come before parameterized routes
// Natural query route (specific path)
router.get("/strings/filter-by-natural-language", processNaturalQueryGet);

// POST natural query (specific path)
router.post("/strings/query", processNaturalQuery);

// Create string
router.post("/strings", createString);

// Get all strings (with optional filters)
router.get("/strings", getAllStrings);

// Parameterized routes MUST come last
// Get by string value (the actual string, not hash)
router.get("/strings/:string_value", getStringByValue);
router.delete("/strings/:string_value", deleteString);

export default router;
