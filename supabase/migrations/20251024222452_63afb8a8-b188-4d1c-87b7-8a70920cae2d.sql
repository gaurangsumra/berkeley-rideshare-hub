-- Add full-text search column to events table
ALTER TABLE events 
ADD COLUMN search_vector tsvector;

-- Create function to generate weighted search vector
-- Weight A (highest) for name, B for destination/city, C (lowest) for description
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search vector on insert/update
CREATE TRIGGER events_search_vector_trigger
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION events_search_vector_update();

-- Create GIN index for fast full-text search
CREATE INDEX events_search_vector_idx 
ON events 
USING GIN(search_vector);

-- Populate search vector for existing events
UPDATE events 
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(destination, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(city, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C');

-- Create RPC function for searching events with relevance ranking
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
$$ LANGUAGE plpgsql;