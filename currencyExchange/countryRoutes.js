import express from "express";
import {
  refreshCountriesData,
  getAllCountries,
  getCountryByName,
  deleteCountry,
  getRefreshStatus,
  getCountriesSummaryImage,
} from "./countryController.js";

const router = express.Router();

// POST /countries/refresh - Refresh countries data
router.post("/countries/refresh", refreshCountriesData);

// GET /countries/image - Summary image (must come before /:name)
router.get("/countries/image", getCountriesSummaryImage);

// GET /status - Refresh status
router.get("/status", getRefreshStatus);

// GET /countries - Get all countries with filters
router.get("/countries", getAllCountries);

// GET /countries/:name - Get country by name
router.get("/countries/:name", getCountryByName);

// DELETE /countries/:name - Delete country
router.delete("/countries/:name", deleteCountry);

export default router;
