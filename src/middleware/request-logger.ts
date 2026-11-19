
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = randomUUID();
  const startTime = Date.now();

  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;

    console.log(
      JSON.stringify({
        level: "info",
        type: "http_request",
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  next();
}
