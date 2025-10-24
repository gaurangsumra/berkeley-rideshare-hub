-- Recreate search_events with robust prefix matching using to_tsquery
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
  tokens text[];
  terms_count int;
  last_term text;
  initial_terms text;
  tsquery_text text;
  tsq tsquery;
BEGIN
  processed_query := trim(search_query);

  -- Very short queries: simple ILIKE
  IF length(processed_query) <= 2 THEN
    RETURN QUERY
    SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
    FROM events e
    WHERE e.date_time >= now()
      AND (
        e.name ILIKE '%' || processed_query || '%'
        OR e.destination ILIKE '%' || processed_query || '%'
        OR e.city ILIKE '%' || processed_query || '%'
        OR COALESCE(e.description, '') ILIKE '%' || processed_query || '%'
      )
    ORDER BY e.date_time ASC;
    RETURN;
  END IF;

  -- Split into words and sanitize tokens to avoid tsquery syntax errors
  tokens := regexp_split_to_array(processed_query, '\\s+');
  terms_count := COALESCE(array_length(tokens, 1), 0);

  IF terms_count = 0 THEN
    -- Nothing to search: return upcoming events (same as empty search)
    RETURN QUERY
    SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
    FROM events e
    WHERE e.date_time >= now()
    ORDER BY e.date_time ASC;
    RETURN;
  END IF;

  -- Clean reserved tsquery characters from each token
  FOR i IN 1..terms_count LOOP
    tokens[i] := regexp_replace(tokens[i], '[!&|:\\(\\)\'']', ' ', 'g');
    tokens[i] := btrim(tokens[i]);
  END LOOP;

  -- Build tsquery string: combine all but last with AND, last as prefix
  IF terms_count = 1 THEN
    last_term := tokens[1];
    IF length(last_term) <= 2 THEN
      -- Too short last token, use ILIKE
      RETURN QUERY
      SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
      FROM events e
      WHERE e.date_time >= now()
        AND (
          e.name ILIKE '%' || processed_query || '%'
          OR e.destination ILIKE '%' || processed_query || '%'
          OR e.city ILIKE '%' || processed_query || '%'
          OR COALESCE(e.description, '') ILIKE '%' || processed_query || '%'
        )
      ORDER BY e.date_time ASC;
      RETURN;
    END IF;
    tsquery_text := last_term || ':*';
  ELSE
    initial_terms := array_to_string(tokens[1:terms_count-1], ' & ');
    last_term := tokens[terms_count];

    IF length(btrim(last_term)) <= 2 THEN
      -- If last term is too short, fallback to ILIKE for the whole query
      RETURN QUERY
      SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
      FROM events e
      WHERE e.date_time >= now()
        AND (
          e.name ILIKE '%' || processed_query || '%'
          OR e.destination ILIKE '%' || processed_query || '%'
          OR e.city ILIKE '%' || processed_query || '%'
          OR COALESCE(e.description, '') ILIKE '%' || processed_query || '%'
        )
      ORDER BY e.date_time ASC;
      RETURN;
    END IF;

    IF btrim(initial_terms) = '' THEN
      tsquery_text := last_term || ':*';
    ELSE
      tsquery_text := initial_terms || ' & ' || last_term || ':*';
    END IF;
  END IF;

  -- Try to parse tsquery and run FTS; on any error, fallback to ILIKE
  BEGIN
    tsq := to_tsquery('english', tsquery_text);
  EXCEPTION WHEN others THEN
    RETURN QUERY
    SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
    FROM events e
    WHERE e.date_time >= now()
      AND (
        e.name ILIKE '%' || processed_query || '%'
        OR e.destination ILIKE '%' || processed_query || '%'
        OR e.city ILIKE '%' || processed_query || '%'
        OR COALESCE(e.description, '') ILIKE '%' || processed_query || '%'
      )
    ORDER BY e.date_time ASC;
    RETURN;
  END;

  RETURN QUERY
  SELECT e.id, e.name, e.date_time, e.destination, e.city, e.description, e.created_by, e.created_at
  FROM events e
  WHERE e.date_time >= now()
    AND e.search_vector @@ tsq
  ORDER BY ts_rank(e.search_vector, tsq) DESC, e.date_time ASC;
END;
$$;