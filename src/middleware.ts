import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  const isAuthenticated = !!req.auth;
  const isOnAuthPage = req.nextUrl.pathname.startsWith("/auth");

  // Handle the auth page access scenario
  if (isOnAuthPage) {
    // If user is logged in and tries to access auth pages, redirect to home
    if (isAuthenticated) {
      return Response.redirect(new URL("/", req.nextUrl));
    }
    // If not logged in, allow access to auth pages
    return NextResponse.next();
  }

  // Handle protected routes
  if (!isAuthenticated) {
    // If not logged in, redirect to sign in page
    return Response.redirect(new URL("/auth/signin", req.nextUrl));
  }

  // For authenticated users accessing non-auth pages, allow the request
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
