import pg from "pg";
import dotenv from "dotenv";
import axios from "axios";
import { createLogger } from "../utils/logger.js";
import fs from "fs";
import path from "path";

// Create logger for this module
const logger = createLogger("currencyExchange");

const { Pool } = pg;
dotenv.config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

// Function to generate random GDP multiplier
const calculate_GDP_Factor = () => {
  return Math.random() * (2000 - 1000) + 1000;
};

// Function to extract currency code - Updated to handle empty arrays
const extractCurrencyCode = (currencies) => {
  if (!currencies || typeof currencies !== "object") {
    return null; // Changed from "USD" to null
  }

  const currencyKeys = Object.keys(currencies);

  if (currencyKeys.length === 0) {
    return null; // Changed from "USD" to null
  }

  // Only log if country has multiple currencies (interesting case)
  if (currencyKeys.length > 1) {
    console.log(
      "🔍 Multiple currencies found:",
      JSON.stringify(currencies, null, 2)
    );
    console.log("🔑 Available currency codes:", currencyKeys);
    console.log("✅ Selected first currency:", currencyKeys[0]);
  }

  // Return the first currency code
  return currencyKeys[0];
};

// Updated validation helper function
const validateCountryData = (country) => {
  const errors = {};

  // Required field: name
  if (
    !country.name ||
    typeof country.name !== "string" ||
    country.name.trim() === ""
  ) {
    errors.name = "is required";
  }

  // Required field: population
  if (
    country.population === undefined ||
    country.population === null ||
    isNaN(country.population) ||
    country.population < 0
  ) {
    errors.population = "is required and must be a valid number";
  }

  // Currency is no longer required - can be null

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// API calls with retry logic - Enhanced for network issues
const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 30000,
        ...options,
      });
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error.message);

      if (i === retries - 1) {
        // Last attempt failed
        throw new Error(
          `Failed to fetch ${url} after ${retries} attempts: ${error.message}`
        );
      }

      // Progressive delay for network issues: 2s, 5s, 10s, 15s, 20s
      const delay = i < 2 ? (i + 1) * 2000 : (i + 1) * 5000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

//Endpoint 1 - POST /countries/refresh - Updated currency handling
export const refreshCountriesData = async (req, res) => {
  const startTime = Date.now();

  try {
    await logger.info("Starting countries data refresh");

    let countries = [];
    let exchangeRates = {};

    // 1. Fetch countries data with retry - CRITICAL API
    try {
      await logger.info("Fetching countries data from external APIs");

      // Try the v3 API first (newer version)
      let countriesResponse;
      try {
        await logger.debug("Attempting REST Countries v3 API");
        countriesResponse = await fetchWithRetry(
          "https://restcountries.com/v3.1/all?fields=name,capital,region,population,flags,currencies",
          { timeout: 45000 },
          3
        );

        // Transform v3 response to match v2 format
        countries = countriesResponse.data.map((country) => ({
          name: country.name?.common || country.name,
          capital: country.capital?.[0] || null,
          region: country.region,
          population: country.population,
          flag: country.flags?.svg || country.flags?.png,
          currencies: country.currencies || {},
        }));

        await logger.success(
          `Fetched ${countries.length} countries from v3 API`
        );
      } catch (v3Error) {
        await logger.warn("v3 API failed, trying v2 API", {
          error: v3Error.message,
        });

        // Fallback to v2 API
        countriesResponse = await fetchWithRetry(
          "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies",
          { timeout: 45000 },
          3
        );
        countries = countriesResponse.data;
        await logger.success(
          `Fetched ${countries.length} countries from v2 API`
        );
      }
    } catch (error) {
      // Countries API failure - CRITICAL, return 503
      await logger.error("Failed to fetch countries data", {
        error: error.message,
        duration: Math.floor((Date.now() - startTime) / 1000),
      });

      const duration = Math.floor((Date.now() - startTime) / 1000);
      await pool.query(
        `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
         VALUES (0, CURRENT_TIMESTAMP, $1, 'failed - countries API unavailable')`,
        [duration]
      );

      return res.status(503).json({
        error: "External data source unavailable",
        details: "Could not fetch data from restcountries.com",
      });
    }

    // 2. Fetch exchange rates - always fetch regardless of currency availability
    try {
      await logger.info("Fetching exchange rates from external API");
      const exchangeResponse = await fetchWithRetry(
        "https://open.er-api.com/v6/latest/USD",
        { timeout: 30000 },
        8
      );

      if (
        !exchangeResponse.data ||
        !exchangeResponse.data.rates ||
        typeof exchangeResponse.data.rates !== "object"
      ) {
        throw new Error("Invalid exchange rates API response structure");
      }

      exchangeRates = exchangeResponse.data.rates;
      const rateCount = Object.keys(exchangeRates).length;

      if (rateCount < 50) {
        throw new Error(
          `Insufficient exchange rates received: only ${rateCount} currencies`
        );
      }

      await logger.success(`Fetched ${rateCount} exchange rates from API`);
    } catch (error) {
      await logger.error("Failed to fetch exchange rates", {
        error: error.message,
        retries: 8,
        timeout: 30000,
      });

      const duration = Math.floor((Date.now() - startTime) / 1000);
      await pool.query(
        `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
         VALUES (0, CURRENT_TIMESTAMP, $1, 'failed - exchange rates API unavailable')`,
        [duration]
      );

      return res.status(503).json({
        error: "External data source unavailable",
        details: "Could not fetch data from open.er-api.com",
      });
    }

    // Process and store countries with updated currency logic
    let processedCount = 0;
    let validationErrors = [];
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (let i = 0; i < countries.length; i++) {
        const country = countries[i];

        // Validate country data (currency no longer required)
        const validation = validateCountryData(country);

        if (!validation.isValid) {
          validationErrors.push({
            country_index: i,
            country_name: country.name || "Unknown",
            errors: validation.errors,
          });
          continue;
        }

        const currencyCode = extractCurrencyCode(country.currencies);
        let exchangeRate = null;
        let estimatedGDP = null;

        // Handle currency and exchange rate logic
        if (currencyCode) {
          // Currency exists, try to get exchange rate
          exchangeRate = exchangeRates[currencyCode] || null;

          if (exchangeRate && exchangeRate > 0) {
            // Valid exchange rate found, calculate GDP
            const gdpMultiplier = calculate_GDP_Factor();
            estimatedGDP = (country.population * gdpMultiplier) / exchangeRate;
          } else {
            // Currency not found in exchange rates API
            await logger.warn(
              `Currency ${currencyCode} not found in exchange rates for ${country.name}`
            );
            estimatedGDP = null;
          }
        } else {
          // No currency available
          estimatedGDP = 0; // Set to 0 as per specification
        }

        // Update query to handle CONFLICT on name using functional index
        const query = `
          INSERT INTO countries (
            name, capital, region, population, currency_code, 
            exchange_rate, estimated_gdp, flag_url, last_refreshed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (LOWER(name)) 
          DO UPDATE SET 
            capital = EXCLUDED.capital,
            region = EXCLUDED.region,
            population = EXCLUDED.population,
            currency_code = EXCLUDED.currency_code,
            exchange_rate = EXCLUDED.exchange_rate,
            estimated_gdp = EXCLUDED.estimated_gdp,
            flag_url = EXCLUDED.flag_url,
            last_refreshed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `;

        const values = [
          country.name,
          country.capital || null,
          country.region || null,
          country.population || 0,
          currencyCode, // Can be null
          exchangeRate, // Can be null
          estimatedGDP, // Can be null or 0
          country.flag || null,
        ];

        await client.query(query, values);
        processedCount++;
      }

      // Generate summary image after successful processing
      await generateSummaryImage();

      // Update global refresh timestamp
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const status = "completed";

      await client.query(
        `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
        [processedCount, duration, status]
      );

      await client.query("COMMIT");

      await logger.success(
        `Successfully processed ${processedCount} countries in ${duration}s`,
        {
          total_fetched: countries.length,
          processed: processedCount,
          failed: validationErrors.length,
          duration_seconds: duration,
        }
      );

      // Log failed countries for debugging
      if (validationErrors.length > 0) {
        await logger.warn(
          `${validationErrors.length} countries failed validation`,
          {
            failed_countries: validationErrors.map((error) => ({
              name: error.country_name,
              errors: error.errors,
            })),
          }
        );
      }

      // Build successful response
      const response = {
        status: "success",
        message: "Countries data refreshed successfully",
        data: {
          total_countries: processedCount,
          duration_seconds: duration,
          timestamp: new Date().toISOString(),
        },
      };

      // Add validation warnings if any countries were skipped
      if (validationErrors.length > 0) {
        response.warnings = {
          type: "validation_errors",
          message: `${validationErrors.length} countries failed validation and were skipped`,
          failed_countries: validationErrors.map((error) => ({
            name: error.country_name,
            errors: error.errors,
          })),
          details: validationErrors.slice(0, 3),
        };
      }

      res.status(200).json(response);
    } catch (error) {
      await client.query("ROLLBACK");
      await logger.error(
        "Database transaction failed during countries processing",
        {
          error: error.message,
          processed_count: processedCount,
        }
      );
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await logger.error("Critical error in refreshCountriesData", {
      error: error.message,
      stack: error.stack,
      duration: Math.floor((Date.now() - startTime) / 1000),
    });

    res.status(500).json({
      error: "Internal server error",
    });
  }
};

// Helper function to generate summary image
async function generateSummaryImage() {
  try {
    // Create cache directory if it doesn't exist
    const cacheDir = path.join(process.cwd(), "cache");
    console.log(`📁 Cache directory path: ${cacheDir}`);

    if (!fs.existsSync(cacheDir)) {
      console.log(`📁 Creating cache directory: ${cacheDir}`);
      fs.mkdirSync(cacheDir, { recursive: true });
      console.log(`✅ Cache directory created successfully`);
    } else {
      console.log(`📁 Cache directory already exists`);
    }

    // Get total countries count
    const totalCountriesQuery = "SELECT COUNT(*) as total FROM countries";
    const totalCountriesResult = await pool.query(totalCountriesQuery);

    // Get top 5 countries by GDP
    const top5Query = `
      SELECT 
        name,
        estimated_gdp
      FROM countries
      WHERE estimated_gdp IS NOT NULL
      ORDER BY estimated_gdp DESC
      LIMIT 5
    `;
    const top5Result = await pool.query(top5Query);

    const totalCountries = totalCountriesResult.rows[0].total;
    const top5Countries = top5Result.rows;

    // Create SVG content
    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f0f8ff"/>
        <text x="400" y="50" text-anchor="middle" font-size="28" font-family="Arial" fill="#2c3e50">
          Countries Summary Report
        </text>
        <text x="50" y="100" font-size="20" font-family="Arial" fill="#34495e">
          Total Countries: ${totalCountries}
        </text>
        <text x="50" y="140" font-size="18" font-family="Arial" fill="#34495e">
          Top 5 Countries by Estimated GDP:
        </text>
        ${top5Countries
          .map(
            (country, index) => `
          <text x="70" y="${
            180 + index * 30
          }" font-size="16" font-family="Arial" fill="#34495e">
            ${index + 1}. ${country.name}: $${
              country.estimated_gdp
                ? Math.round(country.estimated_gdp).toLocaleString()
                : "N/A"
            }
          </text>
        `
          )
          .join("")}
        <text x="400" y="550" text-anchor="middle" font-size="14" font-family="Arial" fill="#7f8c8d">
          Generated: ${new Date().toISOString()}
        </text>
      </svg>
    `;

    console.log(`📊 Generated SVG content (${svg.length} characters)`);

    // Save to cache/summary.svg with debugging
    const filePath = path.join(cacheDir, "summary.svg");
    console.log(`💾 Attempting to write file to: ${filePath}`);

    try {
      fs.writeFileSync(filePath, svg);
      console.log(`✅ File written successfully`);

      // Verify file was created
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(
          `📈 File verification: size=${stats.size} bytes, created=${stats.birthtime}`
        );
      } else {
        console.log(
          `❌ File verification failed: file does not exist after write`
        );
      }
    } catch (writeError) {
      console.error(`❌ File write error:`, writeError);
      throw writeError;
    }

    await logger.success("Summary image generated successfully");
  } catch (error) {
    console.error(`❌ Error in generateSummaryImage:`, error);
    await logger.error("Failed to generate summary image", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// GET /countries/image - Serve summary image
export const getCountriesSummaryImage = async (req, res) => {
  try {
    const imagePath = path.join(process.cwd(), "cache", "summary.svg");

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        error: "Summary image not found",
      });
    }

    const imageContent = fs.readFileSync(imagePath, "utf8");
    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(imageContent);
  } catch (error) {
    console.error("Error serving image:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

//Endpoint 2: GET /countries - Get all countries with filtering and sorting
export const getAllCountries = async (req, res) => {
  try {
    const {
      region,
      currency,
      sort = "name_asc",
      limit,
      offset,
      search,
    } = req.query;

    let query = `
      SELECT id, name, capital, region, population, currency_code, 
             exchange_rate, estimated_gdp, flag_url, last_refreshed_at
      FROM countries
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Filters
    if (region) {
      query += ` AND LOWER(region) = LOWER($${paramCount})`;
      params.push(region);
      paramCount++;
    }

    if (currency) {
      query += ` AND UPPER(currency_code) = UPPER($${paramCount})`;
      params.push(currency);
      paramCount++;
    }

    if (search) {
      query += ` AND (LOWER(name) LIKE LOWER($${paramCount}) OR LOWER(capital) LIKE LOWER($${paramCount}))`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Apply sorting
    const sortOptions = {
      name_asc: "name ASC",
      name_desc: "name DESC",
      population_asc: "population ASC",
      population_desc: "population DESC",
      gdp_asc: "estimated_gdp ASC",
      gdp_desc: "estimated_gdp DESC",
      region_asc: "region ASC",
      region_desc: "region DESC",
    };

    const orderBy = sortOptions[sort] || "name ASC";
    query += ` ORDER BY ${orderBy}`;

    // Apply pagination only if explicitly requested
    if (limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
      paramCount++;

      if (offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));
        paramCount++;
      }
    }

    const result = await pool.query(query, params);

    // Return simplified array format as per specification
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

// GET /countries/:name - Get country by name
export const getCountryByName = async (req, res) => {
  try {
    const { name } = req.params;

    const query = `
      SELECT id, name, capital, region, population, currency_code, 
             exchange_rate, estimated_gdp, flag_url, last_refreshed_at,
             created_at, updated_at
      FROM countries
      WHERE LOWER(name) = LOWER($1)
    `;

    const result = await pool.query(query, [name]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Country not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching country:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

// DELETE /countries/:name - Delete country
export const deleteCountry = async (req, res) => {
  try {
    const { name } = req.params;

    const result = await pool.query(
      "DELETE FROM countries WHERE LOWER(name) = LOWER($1) RETURNING name, id",
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Country not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Country deleted successfully",
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
      },
    });
  } catch (error) {
    console.error("Error deleting country:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

// GET /status - Get refresh status
export const getRefreshStatus = async (req, res) => {
  try {
    // Get total countries
    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM countries"
    );

    // Get latest refresh metadata
    const metadataResult = await pool.query(`
      SELECT total_countries, last_refresh_timestamp, refresh_duration_seconds, status
      FROM refresh_metadata
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const totalCountries = parseInt(countResult.rows[0].total);
    const lastRefresh = metadataResult.rows[0] || null;

    // Return simplified format as per specification
    res.status(200).json({
      total_countries: totalCountries,
      last_refreshed_at: lastRefresh?.last_refresh_timestamp || null,
      details: {
        countries_processed: lastRefresh?.total_countries || 0,
        duration_seconds: lastRefresh?.refresh_duration_seconds || 0,
        refresh_status: lastRefresh?.status || "never_refreshed",
        database_status: totalCountries > 0 ? "populated" : "empty",
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};
