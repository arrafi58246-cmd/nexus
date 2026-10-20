import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Anonymous requests have nothing to refresh. Keep public pages lightweight.
  if (!request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) {
    return response;
  }

  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const authHeaders = new Headers({ "Cache-Control": "private, no-store" });
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.set(cookie.name, cookie);
          }
          Object.entries(headers).forEach(([name, value]) => authHeaders.set(name, value));
          response = NextResponse.next({ request });
          pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          authHeaders.forEach((value, name) => response.headers.set(name, value));
        },
      },
    },
  );
  // Verify/refresh immediately; page/action guards and RLS still authorize access.
  await supabase.auth.getClaims();
  return response;
}
