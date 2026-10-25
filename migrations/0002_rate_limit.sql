-- Durable per-IP-hash hourly counters for public submissions (create, resend). Rows older than 24 h are pruned opportunistically.
CREATE TABLE IF NOT EXISTS rate_limit (
  ip_hash TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('create', 'resend')),
  hour INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, bucket, hour)
);
