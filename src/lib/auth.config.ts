import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  // Build redirects from the host the request came in on (Vercel URL / custom domain),
  // not from a fixed AUTH_URL.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/api/auth") ||
        pathname === "/api/health";
      if (isPublic) return true;
      return !!auth;
    },
  },
};
