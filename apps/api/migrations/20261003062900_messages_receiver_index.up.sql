CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_receiver_id_read_created_idx ON messages (receiver_id, read, created);
