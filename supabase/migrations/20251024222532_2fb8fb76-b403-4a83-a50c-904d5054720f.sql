-- Fix search_path for events_search_vector_update function
CREATE OR REPLACE FUNCTION events_search_vector_update() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.destination, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for search_events function
CREATE OR REPLACE FUNCTION search_events(search_query TEXT)
RETURNS TABLE (
  id uuid,
  name text,
  date_time timestamptz,
  destination text,
  city text,
  description text,
  created_by uuid,
  created_at timestamptz
) AS $$
BEGIN
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
    e.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY 
    ts_rank(e.search_vector, websearch_to_tsquery('english', search_query)) DESC,
    e.date_time ASC;
END;
$$ LANGUAGE plpgsql SET search_path = public;