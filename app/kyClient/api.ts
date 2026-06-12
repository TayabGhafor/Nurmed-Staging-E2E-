import Cookies from "js-cookie";
import ky, { KyResponse } from "ky";
import { ApiResponse, COOKIE_EXPIRES, User } from "./constants";
import { supabase } from "../lib/supabase";
import { SentryMonitoring } from "../utils/sentry-monitoring";

// Utility function to check network status
const checkNetworkStatus = () => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Network request failed: No internet connection");
  }
};

// Cache for client IP to avoid repeated lookups
let cachedClientIp: string | null = null;

// Utility function to resolve the client's public IP (browser-only)
const getClientIp = async (): Promise<string | null> => {
  try {
    if (cachedClientIp) {
      return cachedClientIp;
    }

    if (typeof window === "undefined") {
      return null;
    }

    const response = await fetch("https://api.ipify.org?format=json");
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { ip?: string };
    if (data.ip) {
      cachedClientIp = data.ip;
      return cachedClientIp;
    }

    return null;
  } catch {
    // If we can't resolve the IP, just proceed without it
    return null;
  }
};

class ApiService {
  private client;

  constructor() {
    this.client = ky.create({
      prefixUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 60000,
      hooks: {
        beforeRequest: [
          async (request) => {
            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("access_token")
                : null;
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            }

            // Attach client IP address to every request (if available)
            const clientIp = await getClientIp();
            if (clientIp) {
              request.headers.set("X-Client-IP", clientIp);
            }

            return request;
          },
        ],
        afterResponse: [
          async (request, options, response: KyResponse) => {
            const startTime = performance.now();
            const endpoint = request.url.replace(
              process.env.NEXT_PUBLIC_API_BASE_URL || "",
              "",
            );

            try {
              const data = (await response.json()) as ApiResponse;
              const responseTime = performance.now() - startTime;

              // Track performance for slow requests
              if (responseTime > 5000) {
                // 5 seconds
                SentryMonitoring.trackPerformanceIssue(
                  `api_slow_response`,
                  responseTime,
                );
              }

              if (response.status === 401) {
                // Track authentication failures
                SentryMonitoring.trackAuthError(new Error("Token expired"), {
                  action: "login",
                });

                // Try to refresh token using Supabase
                try {
                  const { data: refreshData, error: refreshError } =
                    await supabase.auth.refreshSession();

                  if (refreshError) {
                    throw refreshError;
                  }

                  if (refreshData.session) {
                    const { access_token } = refreshData.session;

                    // Update the request with the new token and retry
                    request.headers.set(
                      "Authorization",
                      `Bearer ${access_token}`,
                    );
                    return this.client(request);
                  } else {
                    throw new Error("No session after refresh");
                  }
                } catch (error) {
                  console.error("Token refresh failed:", error);
                  SentryMonitoring.trackAuthError(error as Error, {
                    action: "login",
                  });
                  this.redirectToLogin();
                  throw new Error("Token refresh failed: Redirecting to login");
                }
              } else if (response.status === 403) {
                SentryMonitoring.trackAuthError(new Error("Access forbidden"), {
                  action: "login",
                });
                this.redirectToLogin();
                throw new Error("Forbidden: Redirecting to login");
              } else if (!response.ok) {
                const error = new Error(
                  data.message ||
                    data.detail ||
                    data.data?.detail ||
                    "API request failed",
                ) as any;
                error.response = response;
                error.status = response.status;

                // Track API errors with context
                SentryMonitoring.trackApiError(error, {
                  endpoint,
                  method: request.method,
                  statusCode: response.status,
                  responseTime,
                });

                throw error;
              }

              // Store the parsed data in a custom property
              (response as any)._parsedData = data;
              return response;
            } catch (error) {
              if (error instanceof Error) {
                const apiError = error as any;
                apiError.response = response;
                apiError.status = response.status;

                // Track API errors with context
                SentryMonitoring.trackApiError(apiError, {
                  endpoint,
                  method: request.method,
                  statusCode: response.status,
                  responseTime: performance.now() - startTime,
                });
              }
              throw error;
            }
          },
        ],
      },
    });
  }

  protected async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ApiResponse<T>> {
    try {
      // Check network status before making request
      checkNetworkStatus();

      const response = await this.client.get(endpoint, {
        searchParams: params,
      });
      return (response as any)._parsedData;
    } catch (error: any) {
      if (error.response?.status === 405) {
        throw new Error(`GET method not allowed for endpoint: ${endpoint}`);
      }
      throw error;
    }
  }

  protected async post<T = any>(
    endpoint: string,
    data?: any,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    try {
      // Check network status before making request
      checkNetworkStatus();

      const options: any = { json: data };
      if (customHeaders) {
        options.headers = customHeaders;
      }
      const response = await this.client.post(endpoint, options);
      return (response as any)._parsedData;
    } catch (error: any) {
      if (error.response?.status === 405) {
        throw new Error(`POST method not allowed for endpoint: ${endpoint}`);
      }
      throw error;
    }
  }

  protected async put<T = any>(
    endpoint: string,
    data?: any,
  ): Promise<ApiResponse<T>> {
    try {
      // Check network status before making request
      checkNetworkStatus();

      const response = await this.client.put(endpoint, { json: data });
      return (response as any)._parsedData;
    } catch (error: any) {
      if (error.response?.status === 405) {
        throw new Error(`PUT method not allowed for endpoint: ${endpoint}`);
      }
      throw error;
    }
  }

  protected async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      // Check network status before making request
      checkNetworkStatus();

      const response = await this.client.delete(endpoint);
      return (response as any)._parsedData;
    } catch (error: any) {
      if (error.response?.status === 405) {
        throw new Error(`DELETE method not allowed for endpoint: ${endpoint}`);
      }
      throw error;
    }
  }

  redirectToLogin(): void {
    // Sign out from Supabase
    supabase.auth.signOut();

    // Clear cookies and localStorage
    Cookies.remove("access_token");
    Cookies.remove("user");
    Cookies.remove("refresh_token");
    Cookies.remove("password_updated");
    Cookies.remove("reset_password");

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("password_updated");
    localStorage.removeItem("user");
    localStorage.removeItem("reset_password");

    if (window) {
      window.location.href = "/login";
    }
  }
}

export default ApiService;
