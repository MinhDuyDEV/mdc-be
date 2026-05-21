-- Company search_vector trigger (weighted: name A, industry B, description C)
CREATE OR REPLACE FUNCTION companies_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.industry, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS companies_search_vector_trigger ON companies;
CREATE TRIGGER companies_search_vector_trigger
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION companies_search_vector_update();

-- Post search_vector trigger (content only)
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts;
CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION posts_search_vector_update();

-- Refresh post search_vector when comments are added/updated/deleted
CREATE OR REPLACE FUNCTION refresh_post_search_on_comment() RETURNS trigger AS $$
BEGIN
  UPDATE posts
  SET updated_at = NOW()
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_post_search_trigger ON comments;
CREATE TRIGGER refresh_post_search_trigger
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION refresh_post_search_on_comment();

-- Backfill existing companies (only non-deleted)
UPDATE companies
SET updated_at = NOW()
WHERE deleted_at IS NULL;
