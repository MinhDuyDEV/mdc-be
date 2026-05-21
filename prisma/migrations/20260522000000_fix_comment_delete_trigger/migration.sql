-- Fix: refresh_post_search_on_comment trigger used NEW.post_id on DELETE,
-- which is NULL in Postgres for DELETE operations. Use OLD.post_id for DELETE.
CREATE OR REPLACE FUNCTION refresh_post_search_on_comment() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET updated_at = NOW()
    WHERE id = OLD.post_id;
  ELSE
    UPDATE posts
    SET updated_at = NOW()
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger (DROP + CREATE to ensure it uses the updated function)
DROP TRIGGER IF EXISTS refresh_post_search_trigger ON comments;
CREATE TRIGGER refresh_post_search_trigger
  AFTER INSERT OR UPDATE OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION refresh_post_search_on_comment();
