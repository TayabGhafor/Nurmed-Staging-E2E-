import { supabaseAuthService } from "./supabaseAuth";
import Cookies from "js-cookie";
import { ApiResponse, COOKIE_EXPIRES, User } from "./constants";

// Simplified auth interfaces - no more OTP or password_updated logic

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  setAuthData(token: string, user: User): void {
    supabaseAuthService.setAuthData(token, user);
  }

  async logout(): Promise<void> {
    await supabaseAuthService.logout();
  }

  getCurrentUser(): User | null {
    return supabaseAuthService.getCurrentUser();
  }

  async verifyPassword(password: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return await supabaseAuthService.verifyPassword(password);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    return await supabaseAuthService.login(email, password);
  }

  async signup(params: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    address: string;
    organization?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    return await supabaseAuthService.signup(params);
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return await supabaseAuthService.forgotPassword(email);
  }

  async updatePassword(new_password: string): Promise<{ success: boolean; message?: string; error?: string }> {
    return await supabaseAuthService.updatePassword(new_password);
  }

  async getUser(): Promise<{ success: boolean; user?: User; error?: string }> {
    return await supabaseAuthService.getUser();
  }

  async signInWithGoogle(redirectTo?: string): Promise<{ success: boolean; error?: string }> {
    return await supabaseAuthService.signInWithGoogle(redirectTo);
  }
}

export const authService = AuthService.getInstance();
