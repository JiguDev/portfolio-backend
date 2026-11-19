
import type { Request } from "express";
import type { User } from "@supabase/supabase-js";

export interface AuthenticatedUser {
  id: string;
  email: string | undefined;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number | null;
  tokenType: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string | undefined;
  };
  tokens: AuthTokens | null;
}

export interface SupabaseAuthUser {
  user: User | null;
}
