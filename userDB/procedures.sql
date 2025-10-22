-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_user_dynamic(VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE);

-- Create dynamic user update stored procedure
CREATE OR REPLACE FUNCTION update_user_dynamic(
    p_email VARCHAR(25),
    p_firstname VARCHAR(25) DEFAULT NULL,
    p_middlename VARCHAR(25) DEFAULT NULL,
    p_lastname VARCHAR(25) DEFAULT NULL,
    p_dateOfBirth DATE DEFAULT NULL
)
RETURNS TABLE(
    _id UUID,
    firstname VARCHAR(25),
    middlename VARCHAR(25),
    lastname VARCHAR(25),
    email VARCHAR(25),
    "dateOfBirth" DATE,
    "lastUpdated" TIMESTAMP
) 
LANGUAGE plpgsql
AS $$
DECLARE
    update_query TEXT := 'UPDATE users SET "lastUpdated" = CURRENT_TIMESTAMP';
    field_count INTEGER := 0;
BEGIN
    -- Build dynamic UPDATE query based on non-null parameters
    IF p_firstname IS NOT NULL THEN
        update_query := update_query || ', firstname = ''' || p_firstname || '''';
        field_count := field_count + 1;
    END IF;
    
    IF p_middlename IS NOT NULL THEN
        update_query := update_query || ', middlename = ''' || p_middlename || '''';
        field_count := field_count + 1;
    END IF;
    
    IF p_lastname IS NOT NULL THEN
        update_query := update_query || ', lastname = ''' || p_lastname || '''';
        field_count := field_count + 1;
    END IF;
    
    IF p_dateOfBirth IS NOT NULL THEN
        update_query := update_query || ', "dateOfBirth" = ''' || p_dateOfBirth || '''';
        field_count := field_count + 1;
    END IF;
    
    -- Check if at least one field was provided
    IF field_count = 0 THEN
        RAISE EXCEPTION 'At least one field must be provided for update';
    END IF;
    
    -- Complete the query with WHERE clause and RETURNING
    update_query := update_query || ' WHERE email = ''' || p_email || ''' 
                     RETURNING _id, firstname, middlename, lastname, email, "dateOfBirth", "lastUpdated"';
    
    -- Execute the dynamic query and return results
    RETURN QUERY EXECUTE update_query;
    
    -- Check if any row was updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with email % not found', p_email;
    END IF;
END;
$$;

-- Create user insertion stored procedure
CREATE OR REPLACE FUNCTION insert_user(
    p_firstname VARCHAR(25),
    p_middlename VARCHAR(25),
    p_lastname VARCHAR(25),
    p_email VARCHAR(25),
    p_dateOfBirth DATE
)
RETURNS TABLE(
    _id UUID,
    firstname VARCHAR(25),
    middlename VARCHAR(25),
    lastname VARCHAR(25),
    email VARCHAR(25),
    "dateOfBirth" DATE,
    created TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (firstname, middlename, lastname, email, "dateOfBirth")
    VALUES (p_firstname, p_middlename, p_lastname, p_email, p_dateOfBirth)
    RETURNING users._id, users.firstname, users.middlename, users.lastname, users.email, users."dateOfBirth", users.created;
END;
$$;

-- Create user deletion stored procedure
CREATE OR REPLACE FUNCTION delete_user_by_email(p_email VARCHAR(25))
RETURNS TABLE(
    _id UUID,
    email VARCHAR(25),
    firstname VARCHAR(25),
    lastname VARCHAR(25)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    DELETE FROM users 
    WHERE users.email = p_email
    RETURNING users._id, users.email, users.firstname, users.lastname;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with email % not found', p_email;
    END IF;
END;
$$;
