import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { markNotificationsReadAction } from "@/app/actions/community";
import { getGameCatalog } from "@/lib/catalog";
import {
  getCurrentAccessToken,
  getCurrentUser,
} from "@/lib/auth/session";
import { getNotifications } from "@/lib/community/queries";
import {
  notificationHref,
  notificationLabels,
} from "@/lib/community/notifications";
import { formatKstDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "알림",
  robots: { index: false, follow: false },
};


export default async function NotificationsPage() {
  const [user, token, games] = await Promise.all([
    getCurrentUser(),
    getCurrentAccessToken(),
    getGameCatalog(),
  ]);
  if (!user || !token) redirect("/login?next=/notifications");

  const notifications = await getNotifications(token, user.id);
  const unread = notifications.filter((item) => !item.read_at).length;
  const gameMap = new Map(games.map((game) => [game.universeId, game]));

  return (
    <>
      <Header games={games} />
      <main className="page community-page">
        <div className="page-title">
          <h1>알림</h1>
          <p>읽지 않은 알림 {unread}개</p>
        </div>

        {unread > 0 && (
          <form action={markNotificationsReadAction}>
            <button className="secondary-button" type="submit">
              모두 읽음 처리
            </button>
          </form>
        )}

        <div className="notification-list">
          {notifications.length ? (
            notifications.map((item) => {
              const game = item.game_universe_id
                ? gameMap.get(Number(item.game_universe_id))
                : null;
              const href = notificationHref(item, game?.slug ?? null);
              return (
                <Link
                  key={item.id}
                  className={`notification-row ${item.read_at ? "" : "unread"}`}
                  href={href}
                >
                  <strong>{notificationLabels[item.kind] ?? "새 알림"}</strong>
                  <span>
                    {game?.nameKo ?? "오름"} ·{" "}
                    {formatKstDateTime(item.created_at)}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className="no-data">아직 알림이 없습니다.</div>
          )}
        </div>
      </main>
    </>
  );
}
