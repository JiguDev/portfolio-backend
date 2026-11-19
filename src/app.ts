
import express from "express";
import helmet from "helmet";

import { corsMiddleware } from "./middleware/cors.js";
import { requestLogger } from "./middleware/request-logger.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import apiRouter from "./routes/index.js";

const app = express();

// Security headers
app.use(helmet());

// Request logging
app.use(requestLogger);

// CORS
app.use(corsMiddleware);

// Request body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Root endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to JiguDev Portfolio API",
    version: "1.0.0",
    health: "/api/v1/health",
  });
});

// Versioned API routes
app.use("/api/v1", apiRouter);

// 404 handler - must be after routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;
