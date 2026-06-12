import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;

  // Get auth token from cookies
  const token = request.cookies.get("access_token")?.value;

  // `/embed` authenticates itself via the single-use token exchange, so it must
  // not be redirected to /login for lacking a cookie (it has none on first load).
  const publicRoutes = ["/login", "/signup", "/forgot-password", "/forgot-reset-password", "/callback", "/set-password", "/embed"];

  const protectedRoutes = ["/hospital-admin", "/"];

  const isPublicRoute = publicRoutes.some((route) =>
    currentPath.startsWith(route),
  );

  const isProtectedRoute = protectedRoutes.some((route) => {
    if (route === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(route);
  });

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check if user is authenticated for protected routes
  if (isProtectedRoute && !token) {
    // Store the current URL with query parameters for redirect after login
    const url = new URL("/login", request.url);
    // Preserve the original URL so we can redirect back after login
    // Use NEXT_PUBLIC_SITE_URL to ensure correct domain
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const redirectUrl = `${siteUrl}${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.searchParams.set("redirect", redirectUrl);
    return NextResponse.redirect(url);
  }

  // For role-based routes, we'll let the component handle role-based access
  // The middleware just ensures they're authenticated
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|images|favicon.ico).*)"],
};