import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { emailLoginReady } from "./access-policy";
export async function emailAuthClient() {
  if (!emailLoginReady())
    throw new Error("Email login connection is not ready.");
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            for (const { name, value, options } of items)
              jar.set(name, value, options);
          } catch {
            /* Server Components refresh through the proxy. */
          }
        },
      },
    },
  );
}
