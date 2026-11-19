
import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
) => {
  if (res.headersSent) {
    return;
  }

  const statusCode =
    typeof err.statusCode === "number" &&
    err.statusCode >= 400 &&
    err.statusCode <= 599
      ? err.statusCode
      : typeof err.status === "number" &&
          err.status >= 400 &&
          err.status <= 599
        ? err.status
        : 500;

  const code =
    typeof err.code === "string"
      ? err.code
      : statusCode === 500
        ? "INTERNAL_SERVER_ERROR"
        : "REQUEST_ERROR";

  const message =
    statusCode === 500
      ? "An unexpected error occurred"
      : err.message || "Request failed";

  if (statusCode >= 500) {
    console.error({
      type: "application_error",
      method: req.method,
      path: req.originalUrl,
      error: err,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};
