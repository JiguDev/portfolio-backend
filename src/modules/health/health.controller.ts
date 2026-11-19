
import type { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database.js";

export function getApiHealth(
  _req: Request,
  res: Response,
): void {
  res.status(200).json({
    success: true,
    data: {
      status: "healthy",
      service: "portfolio-api",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getDatabaseHealth(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
        databaseTime: result.rows[0].database_time,
      },
    });
  } catch (error) {
    next(error);
  }
}
