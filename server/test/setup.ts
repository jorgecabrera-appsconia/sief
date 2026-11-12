process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/sief_test?sslmode=disable";
process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-characters";
