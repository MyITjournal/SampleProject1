import pg from "pg";
import dotenv from "dotenv";
import axios from "axios";

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

// Helper function to generate random GDP multiplier
const generateGDPMultiplier = () => {
  return Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
};

// Helper function to extract currency code from currencies object
const extractCurrencyCode = (currencies) => {
  if (!currencies || typeof currencies !== "object") return "USD";

  const currencyKeys = Object.keys(currencies);
  if (currencyKeys.length === 0) return "USD";

  // Return the first currency code
  return currencyKeys[0];
};

// POST /countries/refresh - Fetch and cache all countries data
export const refreshCountriesData = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log("🌍 Starting countries data refresh...");

    // Fetch countries data
    const countriesResponse = await axios.get(
      "https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies",
      { timeout: 30000 }
    );

    const countries = countriesResponse.data;
    console.log(`📊 Fetched ${countries.length} countries`);

    // Fetch exchange rates
    const exchangeResponse = await axios.get(
      "https://open.er-api.com/v6/latest/USD",
      { timeout: 10000 }
    );

    const exchangeRates = exchangeResponse.data.rates;
    console.log(
      `💱 Fetched ${Object.keys(exchangeRates).length} exchange rates`
    );

    // Process and store countries
    let processedCount = 0;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const country of countries) {
        const currencyCode = extractCurrencyCode(country.currencies);
        const exchangeRate = exchangeRates[currencyCode] || 1.0;
        const gdpMultiplier = generateGDPMultiplier();
        const estimatedGDP =
          (country.population * gdpMultiplier) / exchangeRate;

        const query = `
          INSERT INTO countries (
            name, capital, region, population, currency_code, 
            exchange_rate, estimated_gdp, flag_url, last_refreshed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
          ON CONFLICT (name) 
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

      // Update metadata
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await client.query(
        `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
         VALUES ($1, CURRENT_TIMESTAMP, $2, 'completed')`,
        [processedCount, duration]
      );

      await client.query("COMMIT");

      console.log(
        `✅ Successfully processed ${processedCount} countries in ${duration}s`
      );

      res.status(200).json({
        status: "success",
        message: "Countries data refreshed successfully",
        data: {
          total_countries: processedCount,
          duration_seconds: duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("❌ Error refreshing countries data:", error.message);

    // Log failed refresh
    try {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await pool.query(
        `INSERT INTO refresh_metadata (total_countries, last_refresh_timestamp, refresh_duration_seconds, status)
         VALUES (0, CURRENT_TIMESTAMP, $1, 'failed')`,
        [duration]
      );
    } catch (logError) {
      console.error("Failed to log error:", logError.message);
    }

    res.status(500).json({
      status: "error",
      message: "Failed to refresh countries data",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

// GET /countries - Get all countries with filtering and sorting
export const getAllCountries = async (req, res) => {
  try {
    const {
      region,
      currency,
      sort = "name_asc",
      limit = 50,
      offset = 0,
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

    // Apply filters
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

    // Apply pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) FROM countries WHERE 1=1";
    const countParams = params.slice(0, -2); // Remove limit and offset

    if (region) countQuery += " AND LOWER(region) = LOWER($1)";
    if (currency)
      countQuery += ` AND UPPER(currency_code) = UPPER($${region ? 2 : 1})`;
    if (search)
      countQuery += ` AND (LOWER(name) LIKE LOWER($${
        (region ? 1 : 0) + (currency ? 1 : 0) + 1
      }) OR LOWER(capital) LIKE LOWER($${
        (region ? 1 : 0) + (currency ? 1 : 0) + 1
      }))`;

    const countResult = await pool.query(countQuery, countParams);

    res.status(200).json({
      status: "success",
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length,
      },
      filters: {
        region: region || null,
        currency: currency || null,
        search: search || null,
        sort: sort,
      },
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch countries",
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
        status: "error",
        message: "Country not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching country:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch country",
      error: error.message,
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
        status: "error",
        message: "Country not found",
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
      status: "error",
      message: "Failed to delete country",
      error: error.message,
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

    res.status(200).json({
      status: "success",
      data: {
        total_countries_in_db: totalCountries,
        last_refresh: lastRefresh
          ? {
              timestamp: lastRefresh.last_refresh_timestamp,
              countries_processed: lastRefresh.total_countries,
              duration_seconds: lastRefresh.refresh_duration_seconds,
              status: lastRefresh.status,
            }
          : null,
        database_status: totalCountries > 0 ? "populated" : "empty",
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get status",
      error: error.message,
    });
  }
};

// GET /countries/image - Generate summary image (placeholder)
export const getCountriesSummaryImage = async (req, res) => {
  try {
    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_countries,
        COUNT(DISTINCT region) as total_regions,
        COUNT(DISTINCT currency_code) as total_currencies,
        AVG(population) as avg_population,
        SUM(estimated_gdp) as total_gdp
      FROM countries
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    // Create a simple SVG image with statistics
    const svg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#f0f8ff"/>
        <text x="400" y="80" text-anchor="middle" font-size="32" font-family="Arial" fill="#2c3e50">
          Countries Database Summary
        </text>
        <text x="100" y="180" font-size="24" font-family="Arial" fill="#34495e">
          📊 Total Countries: ${stats.total_countries}
        </text>
        <text x="100" y="240" font-size="24" font-family="Arial" fill="#34495e">
          🌍 Total Regions: ${stats.total_regions}
        </text>
        <text x="100" y="300" font-size="24" font-family="Arial" fill="#34495e">
          💱 Total Currencies: ${stats.total_currencies}
        </text>
        <text x="100" y="360" font-size="24" font-family="Arial" fill="#34495e">
          👥 Avg Population: ${Math.round(
            stats.avg_population
          ).toLocaleString()}
        </text>
        <text x="100" y="420" font-size="24" font-family="Arial" fill="#34495e">
          💰 Total Est. GDP: $${Math.round(stats.total_gdp).toLocaleString()}
        </text>
        <text x="400" y="520" text-anchor="middle" font-size="16" font-family="Arial" fill="#7f8c8d">
          Generated on ${new Date().toISOString().split("T")[0]}
        </text>
      </svg>
    `;

    res.setHeader("Content-Type", "image/svg+xml");
    res.status(200).send(svg);
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate summary image",
      error: error.message,
    });
  }
};
