import { emailLoginEnabled, emailLoginReady } from "@/lib/access-policy";
import { ownerApiAccess } from "@/lib/owner-access";
import { providerConfig } from "@/lib/provider";
export async function GET(req: Request) {
  const denied = await ownerApiAccess(req);
  if (denied) return denied;
  return Response.json(
    {
      provider: providerConfig(),
      version: "0.4.11",
      limit: 3,
      access: {
        mode: emailLoginEnabled() ? "email" : "password",
        emailConnection: emailLoginReady() ? "ready" : "pending",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
