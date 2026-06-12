"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "../kyClient/auth";
import { User } from "../kyClient/constants";
import { supabase } from "../lib/supabase";
import {
  hasHospitalParams,
  storeHospitalParams,
  getStoredHospitalParams,
  clearStoredHospitalParams,
  parseHospitalParams,
  buildHospitalUrl
} from "../utils/hospital-params";

// Client-side only hook for useSearchParams
function useSearchParamsSafe() {
  const [searchParams, setSearchParams] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleLocationChange = () => {
        setSearchParams(new URLSearchParams(window.location.search));
      };

      // Listen for location changes
      window.addEventListener('popstate', handleLocationChange);

      // Initial set
      handleLocationChange();

      return () => {
        window.removeEventListener('popstate', handleLocationChange);
      };
    }
  }, []);

  return searchParams;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; token?: string; user?: User; error?: string }>;
  signup: (params: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    address: string;
    organization?: string;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  loginWithGoogle: (redirectTo?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  verifyPassword: (password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const hasRole = (role: User["role"], target: string) => {
  if (!role) return false;
  if (Array.isArray(role)) {
    return role.includes(target);
  }
  return false;
};

const getDefaultRouteForRole = (role: User["role"]) =>
  hasRole(role, "hospitalAdmin") ? "/hospital-admin" : "/";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParamsSafe();

  // Routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/forgot-reset-password",
  ];

  useEffect(() => {
    // Only run auth initialization once on mount, not on every pathname change
    let isMounted = true;

    const initAuth = async () => {
      if (!isMounted) return;

      setIsLoading(true);
      try {
        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // User is authenticated in Supabase, get stored user data
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // If no stored user data, fetch from database
            const userResponse = await authService.getUser();
            if (userResponse.success && userResponse.user) {
              setUser(userResponse.user);
            } else {
              console.error("Failed to fetch user data:", userResponse.error);
            }
          }
        } else {
          // No active session, clear any stale data
          setUser(null);

          // If user is not authenticated but we have hospital params, store them
          if (hasHospitalParams(searchParams)) {
            const hospitalParams = parseHospitalParams(searchParams);
            storeHospitalParams(hospitalParams);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Only run on initial mount
    initAuth();

    return () => {
      isMounted = false;
    };
  }, []); // Run only once on mount

  // Listen to auth state changes by polling the current user
  // This avoids conflicts with the SupabaseAuthService listener
  useEffect(() => {
    let isMounted = true;

    const checkAuthState = () => {
      if (!isMounted) return;
      
      const currentUser = authService.getCurrentUser();
      const currentUserId = user?.id;
      
      if (currentUser && (!currentUserId || currentUserId !== currentUser.id)) {
        setUser(currentUser);
      } else if (!currentUser && currentUserId) {
        setUser(null);
      }
    };

    // Set up polling to check for auth state changes
    // Use a longer interval to reduce unnecessary checks and only poll when needed
    const interval = setInterval(checkAuthState, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []); // Empty deps - we read user.id but don't want to retrigger on every user change

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    
    if (!response.success) {
      // Clear any user state if login fails
      setUser(null);
      setIsLoading(false);
      // Return the error response so the login page can handle it
      return response;
    }

    // Only proceed if login was successful
    if (response.success && response.user && response.token) {
      // Immediately set user state to prevent UI flashing
      setUser(response.user);
      setIsLoading(false);

      // If a redirect URL is present in the query params, respect it first.
      // This is used when middleware or an external app sends the user to
      // /login?redirect=<url> after a session timeout or auth failure.
      const redirectParam = searchParams.get("redirect");
      const defaultRoute = getDefaultRouteForRole(response.user.role);
      if (redirectParam) {
        try {
          // URLSearchParams already decodes the value, so use it as-is.
          const rawRedirect = redirectParam;

          // Basic safety: only allow http/https schemes. If it's a relative
          // path (starts with "/"), treat it as an internal route.
          if (rawRedirect.startsWith("http://") || rawRedirect.startsWith("https://")) {
            if (typeof window !== "undefined") {
              window.location.href = rawRedirect;
            }
          } else if (rawRedirect.startsWith("/")) {
            router.push(rawRedirect);
          } else {
            // Fallback to home if the redirect looks suspicious
            router.push(defaultRoute);
          }
        } catch (error) {
          console.error("Failed to handle redirect param after login:", error);
          router.push(defaultRoute);
        }
      } else {
        // No explicit redirect param – fall back to role-based redirects.
        // Priority: hospitalAdmin > superAdmin > doctor
        console.log("🔍 Login redirect - User roles:", response.user.role);
        if (response.user.role?.includes("hospitalAdmin")) {
          console.log("✅ Redirecting to /hospital-admin");
          router.push("/hospital-admin");
        } else if (response.user.role?.includes("superAdmin")) {
          // SuperAdmin goes to doctor dashboard by default
          console.log("✅ SuperAdmin redirecting to /");
          router.push("/");
        } else if (response.user.role?.includes("doctor")) {
          console.log("✅ Redirecting to /");
          router.push("/");
        } else {
          console.log("⚠️ No role found, redirecting to /");
          router.push("/");
        }
      }
    }

    return response;
  }

  const verifyPassword = async (password: string) => {
    const response = await authService.verifyPassword(password);
    return response;
  }

  const signup = async (params: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    address: string;
    organization?: string;
  }) => {
    return await authService.signup(params);
  };

  const loginWithGoogle = async (redirectTo?: string) => {
    return await authService.signInWithGoogle(redirectTo);
  };

  const logout = useCallback(async () => {
    try {
      // Clear auth data using the updated async logout method
      await authService.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }

    // Immediately clear user state to prevent UI flashing
    setUser(null);
    setIsLoading(false);

    // Clear any additional stored tokens
    localStorage.removeItem("reset_access_token");

    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate to login
    router.push("/login");
  }, [router]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user,
    verifyPassword,
  }), [user, isLoading, login, signup, loginWithGoogle, logout, verifyPassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};