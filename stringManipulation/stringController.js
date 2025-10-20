import pg from "pg";
import dotenv from "dotenv";

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper function to analyze string properties
const analyzeString = (text) => {
  const length = text.length;
  const vowels = (text.match(/[aeiouAEIOU]/g) || []).length;
  const consonants = (
    text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []
  ).length;
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const uniqueChars = new Set(text).size;
  const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isPalindrome = cleanText === cleanText.split("").reverse().join("");

  return {
    length,
    vowels,
    consonants,
    words,
    uniqueChars,
    isPalindrome,
    startsWithVowel: /^[aeiouAEIOU]/.test(text),
    endsWithVowel: /[aeiouAEIOU]$/.test(text),
  };
};

// Create string entry
export const createString = async (req, res) => {
  try {
    // Accept both "value" (per spec) and "text" (for backward compatibility)
    const value = req.body.value || req.body.text;

    // Validation
    if (!value || typeof value !== "string") {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid input: 'value' field is required and must be a string",
        timestamp: new Date().toISOString(),
      });
    }

    if (value.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid input: 'value' cannot be empty",
        timestamp: new Date().toISOString(),
      });
    }

    const analysis = analyzeString(value);

    const query = `
      INSERT INTO strings (text, length, vowels, consonants, words, unique_chars, is_palindrome, starts_with_vowel, ends_with_vowel)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, text, length, vowels, consonants, words, unique_chars as "uniqueChars", 
                is_palindrome as "isPalindrome", starts_with_vowel as "startsWithVowel", 
                ends_with_vowel as "endsWithVowel", created_at as "createdAt"
    `;

    const values = [
      value,
      analysis.length,
      analysis.vowels,
      analysis.consonants,
      analysis.words,
      analysis.uniqueChars,
      analysis.isPalindrome,
      analysis.startsWithVowel,
      analysis.endsWithVowel,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      status: "success",
      message: "String created successfully",
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Get string by ID
export const getStringById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    if (isNaN(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
        timestamp: new Date().toISOString(),
      });
    }

    const query = `
      SELECT id, text, length, vowels, consonants, words, unique_chars as "uniqueChars",
             is_palindrome as "isPalindrome", starts_with_vowel as "startsWithVowel",
             ends_with_vowel as "endsWithVowel", created_at as "createdAt"
      FROM strings
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `String with id ${id} not found`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: "success",
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Get all strings with optional filtering
export const getAllStrings = async (req, res) => {
  try {
    // Support both camelCase and snake_case for compatibility
    const {
      minLength,
      min_length,
      maxLength,
      max_length,
      isPalindrome,
      is_palindrome,
      startsWithVowel,
      starts_with_vowel,
      endsWithVowel,
      ends_with_vowel,
      minWords,
      min_words,
      maxWords,
      max_words,
      wordCount,
      word_count,
      query: searchQuery,
      containsCharacter,
      contains_character,
      sortBy = "createdAt",
      order = "DESC",
      limit = 100,
      offset = 0,
    } = req.query;

    // Normalize parameters
    const minLen = minLength || min_length;
    const maxLen = maxLength || max_length;
    const palindrome = isPalindrome || is_palindrome;
    const startsVowel = startsWithVowel || starts_with_vowel;
    const endsVowel = endsWithVowel || ends_with_vowel;
    const minWrd = minWords || min_words;
    const maxWrd = maxWords || max_words;
    const exactWords = wordCount || word_count;
    const containsChar = containsCharacter || contains_character;

    // Check if at least one filter is provided
    const hasFilters = !!(
      minLen ||
      maxLen ||
      palindrome !== undefined ||
      startsVowel !== undefined ||
      endsVowel !== undefined ||
      minWrd ||
      maxWrd ||
      exactWords ||
      searchQuery ||
      containsChar
    );

    // If no filters provided, return empty result or all (based on your preference)
    if (!hasFilters) {
      return res.status(200).json({
        status: "success",
        count: 0,
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        data: [],
        message:
          "No filters provided. Please specify at least one filter parameter.",
        timestamp: new Date().toISOString(),
      });
    }

    let queryText = `
      SELECT id, text, length, vowels, consonants, words, unique_chars as "uniqueChars",
             is_palindrome as "isPalindrome", starts_with_vowel as "startsWithVowel",
             ends_with_vowel as "endsWithVowel", created_at as "createdAt"
      FROM strings
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Length filters
    if (minLen) {
      queryText += ` AND length >= $${paramCount}`;
      params.push(parseInt(minLen));
      paramCount++;
    }

    if (maxLen) {
      queryText += ` AND length <= $${paramCount}`;
      params.push(parseInt(maxLen));
      paramCount++;
    }

    // Word count filters
    if (exactWords) {
      queryText += ` AND words = $${paramCount}`;
      params.push(parseInt(exactWords));
      paramCount++;
    } else {
      if (minWrd) {
        queryText += ` AND words >= $${paramCount}`;
        params.push(parseInt(minWrd));
        paramCount++;
      }

      if (maxWrd) {
        queryText += ` AND words <= $${paramCount}`;
        params.push(parseInt(maxWrd));
        paramCount++;
      }
    }

    // Boolean filters
    if (palindrome !== undefined) {
      queryText += ` AND is_palindrome = $${paramCount}`;
      params.push(palindrome === "true");
      paramCount++;
    }

    if (startsVowel !== undefined) {
      queryText += ` AND starts_with_vowel = $${paramCount}`;
      params.push(startsVowel === "true");
      paramCount++;
    }

    if (endsVowel !== undefined) {
      queryText += ` AND ends_with_vowel = $${paramCount}`;
      params.push(endsVowel === "true");
      paramCount++;
    }

    // Text search
    if (searchQuery) {
      queryText += ` AND text ILIKE $${paramCount}`;
      params.push(`%${searchQuery}%`);
      paramCount++;
    }

    // Contains character filter
    if (containsChar) {
      queryText += ` AND text ILIKE $${paramCount}`;
      params.push(`%${containsChar}%`);
      paramCount++;
    }

    // Sorting
    const validSortFields = [
      "createdAt",
      "length",
      "words",
      "vowels",
      "consonants",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const sortFieldMap = {
      createdAt: "created_at",
      length: "length",
      words: "words",
      vowels: "vowels",
      consonants: "consonants",
    };

    queryText += ` ORDER BY ${sortFieldMap[sortField]} ${sortOrder}`;

    // Pagination
    queryText += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(queryText, params);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM strings WHERE 1=1${
      queryText.split("WHERE 1=1")[1].split("ORDER BY")[0]
    }`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    return res.status(200).json({
      status: "success",
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching strings:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Delete string by ID
export const deleteString = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (isNaN(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid ID format",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await pool.query(
      "DELETE FROM strings WHERE id = $1 RETURNING id, text",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `String with id ${id} not found`,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: "success",
      message: `String with id ${id} deleted successfully`,
      data: {
        id: result.rows[0].id,
        text: result.rows[0].text,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Natural language query processing (GET endpoint)
export const processNaturalQueryGet = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid input: 'query' parameter is required and must be a string",
        timestamp: new Date().toISOString(),
      });
    }

    const { sqlQuery, params, parsedFilters } =
      parseNaturalLanguageQuery(query);
    const result = await pool.query(sqlQuery, params);

    return res.status(200).json({
      data: result.rows,
      count: result.rows.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
    });
  } catch (error) {
    console.error("Error processing query:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};

// Helper function to parse natural language queries
const parseNaturalLanguageQuery = (query) => {
  let sqlQuery = `
    SELECT id, text, length, vowels, consonants, words, unique_chars as "uniqueChars",
           is_palindrome as "isPalindrome", starts_with_vowel as "startsWithVowel",
           ends_with_vowel as "endsWithVowel", created_at as "createdAt"
    FROM strings
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;
  const queryLower = query.toLowerCase();
  const parsedFilters = {};

  // Parse word count
  if (queryLower.includes("single word") || queryLower.includes("one word")) {
    sqlQuery += ` AND words = $${paramCount}`;
    params.push(1);
    paramCount++;
    parsedFilters.word_count = 1;
  }

  const exactWordsMatch = queryLower.match(/exactly (\d+) words?/i);
  if (exactWordsMatch) {
    sqlQuery += ` AND words = $${paramCount}`;
    params.push(parseInt(exactWordsMatch[1]));
    paramCount++;
    parsedFilters.word_count = parseInt(exactWordsMatch[1]);
  }

  const moreWordsMatch = queryLower.match(/more than (\d+) words?/i);
  if (moreWordsMatch) {
    sqlQuery += ` AND words > $${paramCount}`;
    params.push(parseInt(moreWordsMatch[1]));
    paramCount++;
    parsedFilters.word_count_greater_than = parseInt(moreWordsMatch[1]);
  }

  const lessWordsMatch = queryLower.match(/(?:less|fewer) than (\d+) words?/i);
  if (lessWordsMatch) {
    sqlQuery += ` AND words < $${paramCount}`;
    params.push(parseInt(lessWordsMatch[1]));
    paramCount++;
    parsedFilters.word_count_less_than = parseInt(lessWordsMatch[1]);
  }

  // Parse palindrome
  if (queryLower.includes("palindrome") || queryLower.includes("palindromic")) {
    if (
      queryLower.includes("not palindrome") ||
      queryLower.includes("non-palindrome")
    ) {
      sqlQuery += ` AND is_palindrome = false`;
      parsedFilters.is_palindrome = false;
    } else {
      sqlQuery += ` AND is_palindrome = true`;
      parsedFilters.is_palindrome = true;
    }
  }

  // Parse vowel conditions
  if (
    queryLower.includes("starts with vowel") ||
    queryLower.includes("beginning with vowel")
  ) {
    sqlQuery += ` AND starts_with_vowel = true`;
    parsedFilters.starts_with_vowel = true;
  }

  if (
    queryLower.includes("ends with vowel") ||
    queryLower.includes("ending with vowel")
  ) {
    sqlQuery += ` AND ends_with_vowel = true`;
    parsedFilters.ends_with_vowel = true;
  }

  // Parse length requirements
  const longerMatch = queryLower.match(/longer than (\d+)/i);
  if (longerMatch) {
    sqlQuery += ` AND length > $${paramCount}`;
    params.push(parseInt(longerMatch[1]));
    paramCount++;
    parsedFilters.length_greater_than = parseInt(longerMatch[1]);
  }

  const shorterMatch = queryLower.match(/shorter than (\d+)/i);
  if (shorterMatch) {
    sqlQuery += ` AND length < $${paramCount}`;
    params.push(parseInt(shorterMatch[1]));
    paramCount++;
    parsedFilters.length_less_than = parseInt(shorterMatch[1]);
  }

  const exactLengthMatch = queryLower.match(/exactly (\d+) characters?/i);
  if (exactLengthMatch) {
    sqlQuery += ` AND length = $${paramCount}`;
    params.push(parseInt(exactLengthMatch[1]));
    paramCount++;
    parsedFilters.length = parseInt(exactLengthMatch[1]);
  }

  const lengthBetweenMatch = queryLower.match(
    /between (\d+) and (\d+) characters?/i
  );
  if (lengthBetweenMatch) {
    sqlQuery += ` AND length BETWEEN $${paramCount} AND $${paramCount + 1}`;
    params.push(
      parseInt(lengthBetweenMatch[1]),
      parseInt(lengthBetweenMatch[2])
    );
    paramCount += 2;
    parsedFilters.length_between = [
      parseInt(lengthBetweenMatch[1]),
      parseInt(lengthBetweenMatch[2]),
    ];
  }

  // Parse text contains
  const containsMatch = queryLower.match(/contains? ['""]([^'""]+)['""]?/i);
  if (containsMatch) {
    sqlQuery += ` AND text ILIKE $${paramCount}`;
    params.push(`%${containsMatch[1]}%`);
    paramCount++;
    parsedFilters.contains = containsMatch[1];
  }

  // Parse minimum vowels/consonants
  const minVowelsMatch = queryLower.match(
    /(?:at least|minimum) (\d+) vowels?/i
  );
  if (minVowelsMatch) {
    sqlQuery += ` AND vowels >= $${paramCount}`;
    params.push(parseInt(minVowelsMatch[1]));
    paramCount++;
    parsedFilters.min_vowels = parseInt(minVowelsMatch[1]);
  }

  const minConsonantsMatch = queryLower.match(
    /(?:at least|minimum) (\d+) consonants?/i
  );
  if (minConsonantsMatch) {
    sqlQuery += ` AND consonants >= $${paramCount}`;
    params.push(parseInt(minConsonantsMatch[1]));
    paramCount++;
    parsedFilters.min_consonants = parseInt(minConsonantsMatch[1]);
  }

  sqlQuery += ` ORDER BY created_at DESC LIMIT 100`;

  return { sqlQuery, params, parsedFilters };
};

// Natural language query processing (POST endpoint - keep for backward compatibility)
export const processNaturalQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid input: 'query' field is required and must be a string",
        timestamp: new Date().toISOString(),
      });
    }

    const { sqlQuery, params, parsedFilters } =
      parseNaturalLanguageQuery(query);
    const result = await pool.query(sqlQuery, params);

    return res.status(200).json({
      status: "success",
      data: result.rows,
      count: result.rows.length,
      interpreted_query: {
        original: query,
        parsed_filters: parsedFilters,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing query:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
};
