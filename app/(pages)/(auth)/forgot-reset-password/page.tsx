"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../../../components";
import { supabase } from "../../../lib/supabase";

export default function ForgotResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(true);

  // Extract access token from URL hash and set session when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      
      if (token && type === 'recovery') {
        setAccessToken(token);
        
        // Set the session in Supabase for password update
        if (refreshToken) {
          supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken
          });
        }
      }
      setIsTokenLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!accessToken) {
      setError("No access token found. Please use the reset link from your email.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      // Use Supabase to update password with the access token
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      // Sign out the user after password reset to ensure they login with new password
      await supabase.auth.signOut();

      toast.success("Password updated successfully! Please login with your new password.", {
        duration: 3000,
        position: "bottom-right",
      });
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lg:px-22 w-full max-w-[580px] rounded-[20px] bg-white p-8 shadow-lg lg:py-12">
      <div className="mb-8 flex justify-center">
        <Image
          src="/images/logo.png"
          alt="NurMed Logo"
          width={120}
          height={40}
          priority
        />
      </div>

      <h2 className="mb-8 text-center text-[16px] font-normal text-gray-600">
        Reset your password
      </h2>

      {!isTokenLoading && !accessToken && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
          No access token found. Please use the reset link from your email.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isTokenLoading ? (
        <div className="space-y-5">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-md mb-4"></div>
            <div className="h-12 bg-gray-200 rounded-md mb-4"></div>
            <div className="h-12 bg-gray-200 rounded-md"></div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" style={{ opacity: accessToken ? 1 : 0.5 }}>
        <div className="relative">
                      <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
              required
              disabled={isLoading || !accessToken}
            />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
                      <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
              required
              disabled={isLoading || !accessToken}
            />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showConfirmPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>

        <Button
          type="submit"
          className="w-full rounded-md bg-[#2832A8] py-3 text-[15px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || !accessToken}
        >
          {isLoading ? "Resetting..." : "Reset Password"}
        </Button>
        </form>
      )}
    </div>
  );
}