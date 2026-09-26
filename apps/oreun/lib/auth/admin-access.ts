import { notFound, redirect } from "next/navigation";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getCommunityPermissions } from "@/lib/community/queries";
import { isIndexingReleased } from "@/lib/indexing";

const PREVIEW_DIAGNOSTICS = new Set([
  "/admin/data-status",
  "/admin/community-analytics",
  "/admin/launch-readiness",
]);

export async function requireAdminPage(next: string) {
  // Preview diagnostics remain absent in release mode, not merely logged out.
  // In preview, authenticate before querying any internal data.
  if (PREVIEW_DIAGNOSTICS.has(next) && isIndexingReleased()) notFound();
  const [user, token] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
  ]);
  if (!user || !token) redirect(`/login?next=${encodeURIComponent(next)}`);
  const permissions = await getCommunityPermissions(token).catch(() => null);
  if (!permissions?.active || permissions.role !== "admin") redirect("/");
  return { user, token, permissions };
}
