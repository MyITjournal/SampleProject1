CREATE TABLE IF NOT EXISTS strings (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    length INTEGER NOT NULL,
    vowels INTEGER NOT NULL,
    consonants INTEGER NOT NULL,
    words INTEGER NOT NULL,
    unique_chars INTEGER NOT NULL,
    is_palindrome BOOLEAN NOT NULL,
    starts_with_vowel BOOLEAN NOT NULL,
    ends_with_vowel BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_strings_length ON strings(length);
CREATE INDEX idx_strings_words ON strings(words);
CREATE INDEX idx_strings_palindrome ON strings(is_palindrome);
CREATE INDEX idx_strings_vowel_start ON strings(starts_with_vowel);
CREATE INDEX idx_strings_vowel_end ON strings(ends_with_vowel);
CREATE INDEX idx_strings_created ON strings(created_at DESC);
CREATE INDEX idx_strings_text_search ON strings USING gin(to_tsvector('english', text));
