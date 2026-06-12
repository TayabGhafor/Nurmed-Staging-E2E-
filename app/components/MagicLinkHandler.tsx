"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// SessionStorage keys for magic link params
export const MAGIC_LINK_STORAGE_KEYS = {
  DOCTOR_ID: 'magic_link_doctor_id',
  PARAMS: 'magic_link_params',
  REDIRECT: 'magic_link_redirect',
} as const;

/**
 * Helper function to get stored magic link params from sessionStorage
 * Call this from destination pages after magic link redirect
 */
export function getMagicLinkParams(): {
  doctorId: string | null;
  params: Record<string, unknown> | null;
  redirect: string | null;
} {
  if (typeof window === 'undefined') {
    return { doctorId: null, params: null, redirect: null };
  }
  
  const doctorId = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.DOCTOR_ID);
  const paramsStr = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.PARAMS);
  const redirect = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
  
  let params: Record<string, unknown> | null = null;
  if (paramsStr) {
    try {
      params = JSON.parse(paramsStr);
    } catch {
      console.warn('Failed to parse stored magic link params');
    }
  }
  
  return { doctorId, params, redirect };
}

/**
 * Helper function to clear magic link params from sessionStorage
 * Call this after you've consumed the params
 */
export function clearMagicLinkParams(): void {
  if (typeof window === 'undefined') return;
  
  sessionStorage.removeItem(MAGIC_LINK_STORAGE_KEYS.DOCTOR_ID);
  sessionStorage.removeItem(MAGIC_LINK_STORAGE_KEYS.PARAMS);
  sessionStorage.removeItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
}

const getDefaultRoute = (role: string | string[] | null | undefined) => {
  if (!role) return "/";
  if (Array.isArray(role)) {
    return role.includes("hospitalAdmin") ? "/hospital-admin" : "/";
  }
  return role.includes("hospitalAdmin") ? "/hospital-admin" : "/";
};

/**
 * Extracts and stores custom params from the query string
 * These params are passed from the backend via Supabase's redirect_to mechanism
 */
function extractAndStoreQueryParams(): { redirectTo: string | null } {
  const searchParams = new URLSearchParams(window.location.search);
  
  // Extract doctor_id from query string
  const doctorId = searchParams.get('doctor_id');
  if (doctorId) {
    sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.DOCTOR_ID, doctorId);
    console.log('Stored doctor_id from magic link:', doctorId);
  }
  
  // Extract and parse params JSON from query string
  const paramsStr = searchParams.get('params');
  if (paramsStr) {
    try {
      // Validate that it's valid JSON before storing
      JSON.parse(paramsStr);
      sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.PARAMS, paramsStr);
      console.log('Stored params from magic link');
    } catch (e) {
      console.warn('Invalid JSON in magic link params, skipping storage:', e);
    }
  }
  
  // Extract redirect_to from query string (this is the final destination)
  const redirectTo = searchParams.get('redirect_to');
  if (redirectTo) {
    sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT, redirectTo);
  }
  
  return { redirectTo };
}

/**
 * Clears both query string and hash from the current URL
 */
function clearUrlParams(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

/**
 * Global component to handle magic link authentication from any page
 * This ensures magic links work even when redirecting to non-auth pages
 * 
 * Expected callback URL format:
 * /callback?doctor_id=abc123&params={"key":"value"}&redirect_to=/dashboard#access_token=xxx&refresh_token=yyy&type=magiclink
 * 
 * - Auth tokens (access_token, refresh_token, type) are in hash fragment
 * - Custom params (doctor_id, params, redirect_to) are in query string
 */
export function MagicLinkHandler() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isProcessing) return; // Prevent multiple processing attempts
    
    const handleMagicLink = async () => {
      // Check again inside the function to prevent race conditions
      if (isProcessing) return;
      
      // Supabase magic links redirect with tokens in the hash (#)
      const hash = window.location.hash;
      if (!hash) return;
      
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      // Check if this is a magic link (not password recovery)
      const isMagicLink = type === 'magiclink' && accessToken && refreshToken;
      
      if (isMagicLink) {
        setIsProcessing(true);
        
        try {
          console.log('Processing magic link authentication...');
          
          // Extract and store custom params from query string BEFORE clearing URL
          // These are passed from backend via Supabase's redirect_to mechanism
          const { redirectTo: queryRedirectTo } = extractAndStoreQueryParams();
          
          // Also check for redirect_to in hash (for backwards compatibility)
          const hashRedirectTo = hashParams.get('redirect_to');
          const redirectTo = queryRedirectTo || hashRedirectTo;
          
          // Set the session using the tokens from the hash
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Magic link session error:', error);
            // Clear both query string and hash, redirect to login with error
            clearUrlParams();
            router.replace('/login?error=magic_link_invalid');
            setIsProcessing(false);
            return;
          }
          
          if (data.session) {
            console.log('Magic link authentication successful');
            
            // Clear both query string and hash from URL
            clearUrlParams();
            
            // Wait for user to be loaded, then redirect
            const maxWaitTime = 3000; // Max 3 seconds to wait for user to load
            const startTime = Date.now();
            
            const checkAndRedirect = () => {
              // If user is authenticated and loaded, redirect
              if (isAuthenticated && !isLoading && user) {
                const storedRedirect = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
                // Note: Don't clear params here - let the destination page consume them
                // Only clear the redirect key after using it
                sessionStorage.removeItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
                
                const finalRedirect = storedRedirect || redirectTo || getDefaultRoute(user.role);
                
                if (finalRedirect && (finalRedirect.startsWith('http://') || finalRedirect.startsWith('https://'))) {
                  window.location.href = finalRedirect;
                } else {
                  const targetPath = (storedRedirect || redirectTo)?.startsWith('/') 
                    ? (storedRedirect || redirectTo)!
                    : getDefaultRoute(user.role);
                  router.replace(targetPath);
                }
                setIsProcessing(false);
                return true;
              }
              
              // If we've waited too long, redirect anyway (user might load later)
              if (Date.now() - startTime > maxWaitTime) {
                const storedRedirect = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
                sessionStorage.removeItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
                
                const finalRedirect = storedRedirect || redirectTo || getDefaultRoute(user?.role);
                if (finalRedirect && (finalRedirect.startsWith('http://') || finalRedirect.startsWith('https://'))) {
                  window.location.href = finalRedirect;
                } else {
                  router.replace(finalRedirect);
                }
                setIsProcessing(false);
                return true;
              }
              
              return false;
            };
            
            // Check immediately
            if (!checkAndRedirect()) {
              // Poll every 200ms until user is loaded or timeout
              const interval = setInterval(() => {
                if (checkAndRedirect()) {
                  clearInterval(interval);
                }
              }, 200);
              
              // Cleanup interval after max wait time
              setTimeout(() => {
                clearInterval(interval);
                setIsProcessing(false);
              }, maxWaitTime);
            }
          } else {
            console.error('Magic link: No session created');
            clearUrlParams();
            router.replace('/login?error=magic_link_no_session');
            setIsProcessing(false);
          }
        } catch (error) {
          console.error('Magic link processing error:', error);
          clearUrlParams();
          router.replace('/login?error=magic_link_failed');
          setIsProcessing(false);
        }
      }
    };
    
    handleMagicLink();
  }, [router, isAuthenticated, isLoading, user, isProcessing]);

  // This component doesn't render anything
  return null;
}

