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
  const consonants = (text.match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g) || []).length;
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const uniqueChars = new Set(text).size;
  const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isPalindrome = cleanText === cleanText.split('').reverse().join('');
  
  return {
    length,
    vowels,
    consonants,
    words,
    uniqueChars,
    isPalindrome,
    startsWithVowel: /^[aeiouAEIOU]/.test(text),
    endsWithVowel: /[aeiouAEIOU]$/.test(text)
  };
};

// Create string entry
export const createString = async (req, res) => {
  try {
    const { text } = req.body;

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        status: "error",
        message: "Invalid input: 'text' field is required and must be a string",
        timestamp: new Date().toISOString()
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid input: 'text' cannot be empty",
        timestamp: new Date().toISOString()
      });
    }

    const analysis = analyzeString(text);
    
    const query = `
      INSERT INTO strings (text, length, vowels, consonants, words, unique_chars, is_palindrome, starts_with_vowel, ends_with_vowel)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, text, length, vowels, consonants, words, unique_chars as "uniqueChars", 
                is_palindrome as "isPalindrome", starts_with_vowel as "startsWithVowel", 
                ends_with_vowel as "endsWithVowel", created_at as "createdAt"
    `;
    
    const values = [
      text,
      analysis.length,
      analysis.vowels,
      analysis.consonants,
      analysis.words,
      analysis.uniqueChars,
      analysis.isPalindrome,
      analysis.startsWithVowel,
      analysis.endsWithVowel
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      status: "success",
      message: "String created successfully",
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error creating string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: "success",
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error fetching string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
};

// Get all strings with optional filtering
export const getAllStrings = async (req, res) => {
  try {
    const { 
      minLength, 
      maxLength, 
      isPalindrome, 
      startsWithVowel,
      endsWithVowel,
      minWords,
      maxWords,
      query: searchQuery,
      sortBy = 'createdAt',
      order = 'DESC',
      limit = 100,
      offset = 0
    } = req.query;

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
    if (minLength) {
      queryText += ` AND length >= $${paramCount}`;
      params.push(parseInt(minLength));
      paramCount++;
    }

    if (maxLength) {
      queryText += ` AND length <= $${paramCount}`;
      params.push(parseInt(maxLength));
      paramCount++;
    }

    // Word count filters
    if (minWords) {
      queryText += ` AND words >= $${paramCount}`;
      params.push(parseInt(minWords));
      paramCount++;
    }

    if (maxWords) {
      queryText += ` AND words <= $${paramCount}`;
      params.push(parseInt(maxWords));
      paramCount++;
    }

    // Boolean filters
    if (isPalindrome !== undefined) {
      queryText += ` AND is_palindrome = $${paramCount}`;
      params.push(isPalindrome === 'true');
      paramCount++;
    }

    if (startsWithVowel !== undefined) {
      queryText += ` AND starts_with_vowel = $${paramCount}`;
      params.push(startsWithVowel === 'true');
      paramCount++;
    }

    if (endsWithVowel !== undefined) {
      queryText += ` AND ends_with_vowel = $${paramCount}`;
      params.push(endsWithVowel === 'true');
      paramCount++;
    }

    // Text search
    if (searchQuery) {
      queryText += ` AND text ILIKE $${paramCount}`;
      params.push(`%${searchQuery}%`);
      paramCount++;
    }

    // Sorting
    const validSortFields = ['createdAt', 'length', 'words', 'vowels', 'consonants'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    const sortFieldMap = {
      'createdAt': 'created_at',
      'length': 'length',
      'words': 'words',
      'vowels': 'vowels',
      'consonants': 'consonants'
    };

    queryText += ` ORDER BY ${sortFieldMap[sortField]} ${sortOrder}`;

    // Pagination
    queryText += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(queryText, params);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM strings WHERE 1=1${queryText.split('WHERE 1=1')[1].split('ORDER BY')[0]}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    return res.status(200).json({
      status: "success",
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      data: result.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error fetching strings:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString()
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
        timestamp: new Date().toISOString()
      });
    }

    const result = await pool.query(
      'DELETE FROM strings WHERE id = $1 RETURNING id, text', 
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `String with id ${id} not found`,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: "success",
      message: `String with id ${id} deleted successfully`,
      data: {
        id: result.rows[0].id,
        text: result.rows[0].text
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error deleting string:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
};

// Natural language query processing
export const processNaturalQuery = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        status: "error",
        message: "Invalid input: 'query' field is required and must be a string",
        timestamp: new Date().toISOString()
      });
    }

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

    // Parse natural language queries
    if (queryLower.includes('palindrome')) {
      sqlQuery += ` AND is_palindrome = true`;
    }

    if (queryLower.includes('not palindrome') || queryLower.includes('non-palindrome')) {
      sqlQuery += ` AND is_palindrome = false`;
    }

    if (queryLower.includes('starts with vowel') || queryLower.includes('beginning with vowel')) {
      sqlQuery += ` AND starts_with_vowel = true`;
    }

    if (queryLower.includes('ends with vowel') || queryLower.includes('ending with vowel')) {
      sqlQuery += ` AND ends_with_vowel = true`;
    }

    // Extract length requirements
    const longerMatch = queryLower.match(/longer than (\d+)/i);
    if (longerMatch) {
      sqlQuery += ` AND length > $${paramCount}`;
      params.push(parseInt(longerMatch[1]));
      paramCount++;
    }

    const shorterMatch = queryLower.match(/shorter than (\d+)/i);
    if (shorterMatch) {
      sqlQuery += ` AND length < $${paramCount}`;
      params.push(parseInt(shorterMatch[1]));
      paramCount++;
    }

    const exactLengthMatch = queryLower.match(/exactly (\d+) characters?/i);
    if (exactLengthMatch) {
      sqlQuery += ` AND length = $${paramCount}`;
      params.push(parseInt(exactLengthMatch[1]));
      paramCount++;
    }

    const lengthBetweenMatch = queryLower.match(/between (\d+) and (\d+) characters?/i);
    if (lengthBetweenMatch) {
      sqlQuery += ` AND length BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(parseInt(lengthBetweenMatch[1]), parseInt(lengthBetweenMatch[2]));
      paramCount += 2;
    }

    // Extract word count requirements
    const moreWordsMatch = queryLower.match(/more than (\d+) words?/i);
    if (moreWordsMatch) {
      sqlQuery += ` AND words > $${paramCount}`;
      params.push(parseInt(moreWordsMatch[1]));
      paramCount++;
    }

    const lessWordsMatch = queryLower.match(/less than (\d+) words?/i);
    if (lessWordsMatch) {
      sqlQuery += ` AND words < $${paramCount}`;
      params.push(parseInt(lessWordsMatch[1]));
      paramCount++;
    }

    // Extract text contains
    const containsMatch = queryLower.match(/contains? ['""]([^'""]+)['""]?/i);
    if (containsMatch) {
      sqlQuery += ` AND text ILIKE $${paramCount}`;
      params.push(`%${containsMatch[1]}%`);
      paramCount++;
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(sqlQuery, params);

    return res.status(200).json({
      status: "success",
      query: query,
      interpretation: {
        filters: params.length > 0 ? "Applied filters based on query" : "No specific filters detected",
        resultsFound: result.rows.length
      },
      count: result.rows.length,
      data: result.rows,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error processing query:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      timestamp: new Date().toISOString()
    });
  }
};
