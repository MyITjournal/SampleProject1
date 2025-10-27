import pg from "pg";
import dotenv from "dotenv";
import axios from "axios";
import { createLogger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";

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

// Function to extract currency code
const extractCurrencyCode = (currencies) => {
  if (!currencies || typeof currencies !== "object") {
    return null;
  }

  const currencyKeys = Object.keys(currencies);

  if (currencyKeys.length === 0) {
    return null;
  }

  // This will only log if country has multiple currencies
  if (currencyKeys.length > 1) {
    console.log(
      "Multiple currencies found:",
      JSON.stringify(currencies, null, 2)
    );
    console.log("Available currency codes:", currencyKeys);
    console.log("Selected first currency:", currencyKeys[0]);
  }

  // Return the first currency code
  return currencyKeys[0];
};

// Validation helper function
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

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// API call to fetch country data
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
        // Last attempt failed - use consistent error message format
        if (url.includes("restcountries.com")) {
          throw new Error("Could not fetch data from restcountries.com");
        } else if (url.includes("open.er-api.com")) {
          throw new Error("Could not fetch data from open.er-api.com");
        } else {
          throw new Error(`Could not fetch data from ${url}`);
        }
      }

      // Handling network delays: 2s, 5s, 10s, 15s, 20s
      const delay = i < 2 ? (i + 1) * 2000 : (i + 1) * 5000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Function to get top 5 countries by GDP
const getTop5CountriesByGDP = async () => {
  const query = `
    SELECT 
      name,
      estimated_gdp,
      currency_code,
      population
    FROM countries
    WHERE estimated_gdp IS NOT NULL
    ORDER BY estimated_gdp DESC
    LIMIT 5
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Function to get total countries count
const getTotalCountriesCount = async () => {
  const query = "SELECT COUNT(*) as total FROM countries";
  const result = await pool.query(query);
  return parseInt(result.rows[0].total);
};

// Function to get last refresh timestamp
const getLastRefreshTimestamp = async () => {
  const query = `
    SELECT last_refresh_timestamp
    FROM refresh_metadata
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await pool.query(query);
  return result.rows[0]?.last_refresh_timestamp || new Date().toISOString();
};

// Function to format top 5 countries for response
const formatTop5CountriesForResponse = (countries) => {
  return countries.map((country) => ({
    name: country.name,
    estimated_gdp: country.estimated_gdp
      ? Math.round(country.estimated_gdp)
      : null,
    currency_code: country.currency_code,
    population: country.population,
  }));
};

// Function to log refresh metadata
const logRefreshMetadata = async (totalCountries, duration, status) => {
  await pool.query(
    `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
     VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
    [totalCountries, duration, status]
  );
};

//Endpoint 1 - POST /countries/refresh
export const refreshCountriesData = async (req, res) => {
  const startTime = Date.now();

  try {
    await logger.info("Starting countries data refresh");

    let countries = [];
    let exchangeRates = {};

    // 1. Fetch countries data with retry
    try {
      await logger.info("Fetching countries data from external APIs");

      let countriesResponse;
      try {
        await logger.debug("Attempting REST Countries v2 API");
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
      // Countries API failure
      await logger.error("Failed to fetch countries data", {
        error: error.message,
        duration: Math.floor((Date.now() - startTime) / 1000),
      });

      const duration = Math.floor((Date.now() - startTime) / 1000);

      await logRefreshMetadata(
        0,
        duration,
        "failed - countries API unavailable"
      );

      return res.status(503).json({
        error: "External data source unavailable",
        details: "Could not fetch data from restcountries.com",
      });
    }

    // 2. Fetch exchange rates - this runs always, irrespective of currency availability
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
      //const rateCount = Object.keys(exchangeRates).length;

      // if (rateCount < 50) {
      //   throw new Error(
      //     `Insufficient exchange rates received: only ${rateCount} currencies`
      //   );
      // }

      // await logger.success(`Fetched ${rateCount} exchange rates from API`);
    } catch (error) {
      await logger.error("Failed to fetch exchange rates", {
        error: error.message,
        retries: 8,
        timeout: 30000,
      });

      const duration = Math.floor((Date.now() - startTime) / 1000);

      await logRefreshMetadata(
        0,
        duration,
        "failed - exchange rates API unavailable"
      );

      return res.status(503).json({
        error: "External data source unavailable",
        details: "Could not fetch data from open.er-api.com",
      });
    }

    // 3. Database operations will only proceed if BOTH APIs succeed
    let processedCount = 0;
    let validationErrors = [];
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Save countries to database first
      for (let i = 0; i < countries.length; i++) {
        const country = countries[i];

        // Validate country data
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

        if (currencyCode) {
          exchangeRate = exchangeRates[currencyCode] || null;

          if (exchangeRate && exchangeRate > 0) {
            const gdpMultiplier = calculate_GDP_Factor();
            estimatedGDP = (country.population * gdpMultiplier) / exchangeRate;
          } else {
            exchangeRate = null;
            estimatedGDP = null;
            await logger.warn(
              `Currency ${currencyCode} not found in exchange rates for ${country.name}`
            );
          }
        } else {
          exchangeRate = null;
          estimatedGDP = 0;
        }

        const query = `
          INSERT INTO countries (
            name, capital, region, population, currency_code, 
            exchange_rate, estimated_gdp, flag_url, last_refreshed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (lower(name))
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
          currencyCode,
          exchangeRate,
          estimatedGDP,
          country.flag || null,
        ];

        await client.query(query, values);
        processedCount++;
      }

      if (validationErrors.length > 0 && processedCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Validation failed",
        });
      }

      // Summary image generation (after successful processing)
      await generateSummaryImage();

      // Update global refresh timestamp
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const status = "completed";

      await logRefreshMetadata(processedCount, duration, status);

      await client.query("COMMIT");

      // Get top 5 countries from the successfully processed countries only
      const top5Countries = await getTop5CountriesByGDP();

      await logger.success(
        `Successfully processed ${processedCount} countries in ${duration}s`,
        {
          total_fetched: countries.length,
          processed: processedCount,
          failed: validationErrors.length,
          duration_seconds: duration,
          total_in_db: processedCount,
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

      // Build response using successfully processed count
      const response = {
        status: "success",
        message: "Countries data refreshed successfully",
        data: {
          total_countries: processedCount, // Use processedCount (250) instead of actualTotalCountries
          countries_processed_this_refresh: processedCount,
          duration_seconds: duration,
          timestamp: new Date().toISOString(),
          top_5_countries_by_gdp: formatTop5CountriesForResponse(top5Countries),
        },
      };

      // Validation warnings (in case any countries are skipped)
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

// Function to generate summary image
async function generateSummaryImage() {
  try {
    // 1. Create cache directory if it doesn't exist
    const cacheDir = path.join(process.cwd(), "cache");
    console.log(`Cache directory path: ${cacheDir}`);

    if (!fs.existsSync(cacheDir)) {
      console.log(`Creating cache directory: ${cacheDir}`);
      fs.mkdirSync(cacheDir, { recursive: true });
      console.log(`Cache directory created successfully`);
    } else {
      console.log(`Cache directory already exists`);
    }

    // 2. Get data - use the count that was just processed in this refresh
    const [top5Countries, lastRefreshTime] = await Promise.all([
      getTop5CountriesByGDP(),
      getLastRefreshTimestamp(),
    ]);

    // Get the processed count from the latest refresh metadata
    const processedCountQuery = `
      SELECT total_countries
      FROM refresh_metadata
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const processedCountResult = await pool.query(processedCountQuery);
    const totalCountries = processedCountResult.rows[0]?.total_countries || 0;

    // Create SVG content using the processed count
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
        <text x="50" y="400" font-size="16" font-family="Arial" fill="#34495e">
          Last Refresh: ${new Date(lastRefreshTime).toLocaleString()}
        </text>
        <text x="400" y="550" text-anchor="middle" font-size="14" font-family="Arial" fill="#7f8c8d">
          Generated: ${new Date().toISOString()}
        </text>
      </svg>
    `;

    console.log(`Generated SVG content (${svg.length} characters)`);

    // Convert SVG to PNG using Sharp package
    const filePath = path.join(cacheDir, "summary.png");
    console.log(`Attempting to convert SVG to PNG: ${filePath}`);

    try {
      const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

      fs.writeFileSync(filePath, pngBuffer);
      console.log(`PNG file written successfully`);

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(
          `File verification: size=${stats.size} bytes, created=${stats.birthtime}`
        );
      } else {
        console.log(
          `File verification failed: file does not exist after write`
        );
      }
    } catch (writeError) {
      console.error(`PNG conversion/write error:`, writeError);
      throw writeError;
    }

    await logger.success("Summary image generated successfully as PNG");
  } catch (error) {
    console.error(`Error in generateSummaryImage:`, error);
    await logger.error("Failed to generate summary image", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// Endpoint 6: GET /countries/image - Serve summary image
export const getCountriesSummaryImage = async (req, res) => {
  try {
    const imagePath = path.join(process.cwd(), "cache", "summary.png");

    // Return error if no image exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        error: "Summary image not found",
      });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", imageBuffer.length);
    res.status(200).send(imageBuffer);
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

    // Sorting
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

    // Pagination
    if (limit) {
      query += `LIMIT $${paramCount}`;
      params.push(parseInt(limit));
      paramCount++;

      if (offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));
        paramCount++;
      }
    }

    const result = await pool.query(query, params);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};

// Endpoint 3: GET /countries/:name - Get country by name
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

// Endpoint 4: DELETE /countries/:name - Delete country
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

// Endpoint 5: GET /status - Get refresh status
export const getRefreshStatus = async (req, res) => {
  try {
    // Get processed countries count from latest refresh metadata instead of total DB count
    const metadataResult = await pool.query(`
      SELECT total_countries, last_refresh_timestamp, refresh_duration_seconds, status
      FROM refresh_metadata
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const lastRefresh = metadataResult.rows[0] || null;
    const processedCountries = lastRefresh?.total_countries || 0;

    res.status(200).json({
      total_countries: processedCountries, // Use processed count instead of DB count
      last_refreshed_at: lastRefresh?.last_refresh_timestamp || null,
      details: {
        countries_processed: processedCountries,
        duration_seconds: lastRefresh?.refresh_duration_seconds || 0,
        refresh_status: lastRefresh?.status || "never_refreshed",
        database_status: processedCountries > 0 ? "populated" : "empty",
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
};
