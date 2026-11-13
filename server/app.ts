import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { pool } from "./db.js";
import { registerRoutes } from "./routes.js";
import { storage as defaultStorage, type IStorage } from "./storage.js";
import { isAllowedMutationOrigin } from "./security.js";
import { createRateLimitMiddleware } from "./rate-limit.js";

export interface CreateAppOptions {
  storage?: IStorage;
  sessionStore?: session.Store;
  sessionSecret?: string;
  isProduction?: boolean;
}

function createPostgresSessionStore(): session.Store {
  const PostgresSessionStore = connectPgSimple(session);
  return new PostgresSessionStore({
    pool: pool as never,
    tableName: "user_sessions",
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
  });
}

function validateSessionSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const storage = options.storage ?? defaultStorage;
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  const sessionSecret = validateSessionSecret(
    options.sessionSecret ?? process.env.SESSION_SECRET,
  );

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  const limitPublicReads = createRateLimitMiddleware({
    scope: "public-read",
    limit: 300,
    windowMs: 15 * 60 * 1000,
    consume: (key, expiresAt) => storage.consumeRateLimit(key, expiresAt),
  });
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (
      !isAllowedMutationOrigin(
        req.get("origin") ?? undefined,
        req.get("host") ?? "",
        req.protocol,
      )
    ) {
      return res.status(403).json({ error: "Origin not allowed" });
    }
    next();
  });

  app.use(
    session({
      store: options.sessionStore ?? createPostgresSessionStore(),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: "sief.sid",
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(
    "/api/auth/login",
    createRateLimitMiddleware({
      scope: "login",
      limit: 10,
      windowMs: 15 * 60 * 1000,
      consume: (key, expiresAt) => storage.consumeRateLimit(key, expiresAt),
    }),
  );
  app.use(
    "/api/public/registrations",
    createRateLimitMiddleware({
      scope: "registration",
      limit: 20,
      windowMs: 60 * 60 * 1000,
      consume: (key, expiresAt) => storage.consumeRateLimit(key, expiresAt),
    }),
  );
  app.use(
    [
      "/api/public/students",
      "/api/public/teacher-portal",
      "/api/exam-schedules",
      "/api/exam-calls",
      "/api/teachers",
      "/api/subjects",
      "/api/maintenance/status",
    ],
    (req, res, next) => {
      if (req.session.user || !["GET", "HEAD"].includes(req.method)) return next();
      return limitPublicReads(req, res, next);
    },
  );
  app.use(
    "/api/inscriptions/status",
    createRateLimitMiddleware({
      scope: "registration-status",
      limit: 30,
      windowMs: 15 * 60 * 1000,
      consume: (key, expiresAt) => storage.consumeRateLimit(key, expiresAt),
    }),
  );

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        console.info(
          JSON.stringify({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - startedAt,
          }),
        );
      }
    });
    next();
  });

  registerRoutes(app, storage);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled request error", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return app;
}
