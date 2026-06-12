"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

const useKeyboardTracking = () => {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    // Only set timer if user is authenticated
    if (!isAuthenticated) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Cookies.set("locked", "true", { expires: 1 }); // expires in 1 day
      if (pathname !== "/locked") {
        router.push(`/locked?from=${encodeURIComponent(pathname)}`);
      }
    }, INACTIVITY_LIMIT);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    // If user is not authenticated, clear any existing timer and don't track
    if (!isAuthenticated) {
      clearTimer();
      return;
    }

    const handleActivity = () => {
      resetTimer();
    };

    const activityEvents = ["keydown", "mousemove", "click", "scroll"];

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    resetTimer(); // start timer on mount (only if authenticated)

    return () => {
      clearTimer();
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
    };
  }, [pathname, isAuthenticated]); // Added isAuthenticated to dependency array

  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);
};

export default useKeyboardTracking;