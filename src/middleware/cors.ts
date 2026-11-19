
import cors from "cors";

const configuredOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8100",
  "http://127.0.0.1:8100",
];

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? configuredOrigins
    : [...configuredOrigins, ...developmentOrigins];

export const corsMiddleware = cors({
  origin(origin, callback) {
    // Requests without an Origin header may come from tools, CLI,
    // server-to-server requests, or health checks.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origin not allowed by CORS") as Error & {
    statusCode: number;
    code: string;
    };

    error.statusCode = 403;
    error.code = "CORS_ORIGIN_FORBIDDEN";

    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
});
