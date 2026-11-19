
import { createClient } from "@supabase/supabase-js";
import type {
  SignupInput,
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
} from "./auth.schema.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase Auth environment variables are missing");
}

// Server-side Auth client.
// This client does not maintain a user session in server storage.
export const supabaseAuth = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);

export const authService = {
  async signup(input: SignupInput) {
    const { data, error } = await supabaseAuth.auth.signUp({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async login(input: LoginInput) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async refresh(input: RefreshInput) {
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token: input.refreshToken,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async getUser(accessToken: string) {
    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    if (error) {
      throw error;
    }

    return data.user;
  },

  async forgotPassword(input: ForgotPasswordInput) {
    const { data, error } = await supabaseAuth.auth.resetPasswordForEmail(
      input.email,
    );

    if (error) {
      throw error;
    }

    return data;
  },
};
