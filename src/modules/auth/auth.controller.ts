
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "./auth.types.js";

import {
  signupSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
} from "./auth.schema.js";

import { authService } from "./auth.service.js";

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const validation = signupSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid signup data",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    try {
      const data = await authService.signup(validation.data);

      res.status(201).json({
        success: true,
        message: data.session
          ? "Account created successfully"
          : "Account created. Please check your email to verify your account.",
        data: {
          user: data.user
            ? {
                id: data.user.id,
                email: data.user.email,
              }
            : null,
          session: data.session
            ? {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresIn: data.session.expires_in,
                tokenType: data.session.token_type,
              }
            : null,
        },
      });
    } catch (error: unknown) {
      const authError = error as {
        name?: string;
        message?: string;
        status?: number;
        code?: string;
      };

      // Log useful diagnostics on the server only.
      console.error("Supabase signup error:", {
        name: authError.name,
        message: authError.message,
        status: authError.status,
        code: authError.code,
      });

      // Keep the client response generic.
      res.status(400).json({
        success: false,
        error: {
          code: "SIGNUP_FAILED",
          message: "Unable to create account with the provided information",
        },
      });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid login data",
          details: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    try {
      const data = await authService.login(validation.data);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
            tokenType: data.session.token_type,
          },
        },
      });
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const validation = refreshSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid refresh token is required",
        },
      });
      return;
    }

    try {
      const data = await authService.refresh(validation.data);

      if (!data.session || !data.user) {
        res.status(401).json({
          success: false,
          error: {
            code: "REFRESH_FAILED",
            message: "Unable to refresh authentication session",
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Session refreshed successfully",
        data: {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresIn: data.session.expires_in,
            tokenType: data.session.token_type,
          },
        },
      });
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: "REFRESH_FAILED",
          message: "Refresh token is invalid or expired",
        },
      });
    }
  },

  async me(req: Request, res: Response): Promise<void> {
    const authenticatedReq = req as AuthenticatedRequest;
    
    res.status(200).json({
      success: true,
      data: {
        user: authenticatedReq.user,
      },
    });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const validation = forgotPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid email address",
        },
      });
      return;
    }

    try {
      await authService.forgotPassword(validation.data);
    } catch {
      // Intentionally avoid exposing whether the email exists.
    }

    res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, password recovery instructions will be sent.",
    });
  },
};
