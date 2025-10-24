-- Drop existing table if it exists
DROP TABLE IF EXISTS countries CASCADE;

CREATE TABLE IF NOT EXISTS countries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    capital VARCHAR(255),
    region VARCHAR(100),
    population BIGINT NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(15,6) NOT NULL,
    estimated_gdp DECIMAL(20,2) NOT NULL,
    flag_url TEXT,
    last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_countries_region ON countries(region);
CREATE INDEX idx_countries_currency ON countries(currency_code);
CREATE INDEX idx_countries_name ON countries(name);
CREATE INDEX idx_countries_estimated_gdp ON countries(estimated_gdp);
CREATE INDEX idx_countries_last_refreshed ON countries(last_refreshed_at);

-- Create a metadata table to track refresh status
CREATE TABLE IF NOT EXISTS refresh_metadata (
    id SERIAL PRIMARY KEY,
    total_countries INTEGER NOT NULL,
    last_refresh_timestamp TIMESTAMP NOT NULL,
    refresh_duration_seconds INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
