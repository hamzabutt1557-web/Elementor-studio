import { emailAuthClient } from "@/lib/email-auth";
import { redirect } from "next/navigation";
import { emailLoginEnabled, isOwner } from "@/lib/access-policy";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (emailLoginEnabled()) {
    const client = await emailAuthClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) redirect("/sign-in");
    if (!isOwner(user)) redirect("/access-denied");
  }
  return <Workspace emailLogin={emailLoginEnabled()} />;
}
