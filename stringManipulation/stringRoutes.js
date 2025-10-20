import express from 'express';
import {
  createString,
  getStringById,
  getAllStrings,
  deleteString,
  processNaturalQuery
} from './stringController.js';

const router = express.Router();

router.post('/strings', createString);
router.get('/strings/:id', getStringById);
router.get('/strings', getAllStrings);
router.delete('/strings/:id', deleteString);
router.post('/strings/query', processNaturalQuery);

export default router;
