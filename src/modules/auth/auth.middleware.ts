
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.types.js";
import { authService } from "./auth.service.js";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication token is required",
        },
      });
      return;
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication token is invalid",
        },
      });
      return;
    }

    const user = await authService.getUser(accessToken);

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired authentication token",
        },
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired authentication token",
      },
    });
  }
}
