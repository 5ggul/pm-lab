import { redirect } from "next/navigation";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";

export async function requireAdminPage(next: string) {
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(next)}`);
  const permissions = await getCommunityPermissions(token).catch(() => null);
  if (!permissions?.active || permissions.role !== "admin") redirect("/");
  return { user, token, permissions };
}
