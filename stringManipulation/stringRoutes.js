import express from 'express';
import {
  createString,
  getStringById,
  getAllStrings,
  deleteString,
  processNaturalQuery
} from './stringController.js';

const router = express.Router();

// Natural query route MUST come before /:id route
router.post('/strings/query', processNaturalQuery);

// Create string
router.post('/strings', createString);

// Get all strings (with optional filters)
router.get('/strings', getAllStrings);

// Get string by ID
router.get('/strings/:id', getStringById);

// Delete string by ID
router.delete('/strings/:id', deleteString);

export default router;
