BEGIN;

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
  ON "user_sessions" ("expire");

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" text PRIMARY KEY,
  "count" integer NOT NULL DEFAULT 1,
  "expires_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_rate_limit_buckets_expires_at"
  ON "rate_limit_buckets" ("expires_at");

COMMIT;
