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

// 5. GET /status :- Refresh status (specific route)
router.get("/status", getRefreshStatus);

// 6. GET /countries/image - Summary image (specific route)
router.get("/countries/image", getCountriesSummaryImage);

// 1. POST /countries/refresh - Refresh countries data (specific route)
router.post("/countries/refresh", refreshCountriesData);

// 2. GET /countries - Get all countries with filters (specific route)
router.get("/countries", getAllCountries);

// 3. GET /countries/:name - Get country by name
router.get("/countries/:name", getCountryByName);

// 4. DELETE /countries/:name - Delete country
router.delete("/countries/:name", deleteCountry);

export default router;
