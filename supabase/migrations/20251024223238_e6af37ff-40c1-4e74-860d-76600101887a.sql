-- Drop and recreate the search_events function with prefix matching support
DROP FUNCTION IF EXISTS public.search_events(text);

CREATE OR REPLACE FUNCTION public.search_events(search_query text)
RETURNS TABLE (
  id uuid,
  name text,
  date_time timestamp with time zone,
  destination text,
  city text,
  description text,
  created_by uuid,
  created_at timestamp with time zone
) 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  processed_query text;
  tsquery_result tsquery;
BEGIN
  -- Clean up the query
  processed_query := TRIM(search_query);
  
  -- For very short queries (1-2 chars), use simple ILIKE pattern matching
  IF LENGTH(processed_query) <= 2 THEN
    RETURN QUERY
    SELECT 
      e.id,
      e.name,
      e.date_time,
      e.destination,
      e.city,
      e.description,
      e.created_by,
      e.created_at
    FROM events e
    WHERE 
      e.date_time >= NOW() AND
      (
        e.name ILIKE '%' || processed_query || '%' OR
        e.destination ILIKE '%' || processed_query || '%' OR
        e.city ILIKE '%' || processed_query || '%' OR
        COALESCE(e.description, '') ILIKE '%' || processed_query || '%'
      )
    ORDER BY e.date_time ASC;
    RETURN;
  END IF;
  
  -- For longer queries, use full-text search with prefix matching
  -- Add :* to the last word to enable prefix matching
  IF processed_query !~ '\s$' THEN
    -- If query doesn't end with space, treat last word as prefix
    processed_query := REGEXP_REPLACE(processed_query, '(\S+)$', '\1:*');
  END IF;
  
  -- Try to create the tsquery, if it fails, fall back to ILIKE
  BEGIN
    tsquery_result := websearch_to_tsquery('english', processed_query);
  EXCEPTION WHEN OTHERS THEN
    -- If tsquery fails, use ILIKE as fallback
    RETURN QUERY
    SELECT 
      e.id,
      e.name,
      e.date_time,
      e.destination,
      e.city,
      e.description,
      e.created_by,
      e.created_at
    FROM events e
    WHERE 
      e.date_time >= NOW() AND
      (
        e.name ILIKE '%' || search_query || '%' OR
        e.destination ILIKE '%' || search_query || '%' OR
        e.city ILIKE '%' || search_query || '%' OR
        COALESCE(e.description, '') ILIKE '%' || search_query || '%'
      )
    ORDER BY e.date_time ASC;
    RETURN;
  END;
  
  -- Execute full-text search with ranking
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.date_time,
    e.destination,
    e.city,
    e.description,
    e.created_by,
    e.created_at
  FROM events e
  WHERE 
    e.date_time >= NOW() AND
    e.search_vector @@ tsquery_result
  ORDER BY 
    ts_rank(e.search_vector, tsquery_result) DESC,
    e.date_time ASC;
END;
$$;