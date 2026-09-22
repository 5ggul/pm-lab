import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import PendingButton from "@/components/PendingButton";
import { markNotificationsReadAction } from "@/app/actions/community";
import { openNotification } from "@/app/actions/community-experience";
import { getGameCatalog } from "@/lib/catalog";
import { getCurrentAccessToken, getCurrentUser } from "@/lib/auth/session";
import { getUnreadNotificationCount, type NotificationRow } from "@/lib/community/queries";
import { notificationLabels } from "@/lib/community/notifications";
import { notificationFilter, notificationQuery } from "@/lib/community/experience-model";
import { userSelect } from "@/lib/community/rest";
import { formatKstDateTime } from "@/lib/format";
import styles from "@/components/community-experience.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "알림", robots: { index: false, follow: false } };
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; message?: string }> }) {
  const [user, token, games, params] = await Promise.all([getCurrentUser(), getCurrentAccessToken(), getGameCatalog(), searchParams]);
  if (!user || !token) redirect("/login?next=/notifications");
  const filter = notificationFilter(params.filter);
  const [feed, unread] = await Promise.all([
    userSelect<NotificationRow>("notifications", token, notificationQuery(filter, user.id)).then(rows => ({ rows, failed: false })).catch(() => ({ rows: [], failed: true })),
    getUnreadNotificationCount(token).catch(() => null),
  ]);
  const gameMap = new Map(games.map(game => [game.universeId, game]));
  return <>
    <Header games={games} />
    <main className="page community-page">
      <div className="page-title"><h1>알림</h1><p>{unread === null ? "읽지 않은 알림 수를 확인하지 못했습니다." : `전체 읽지 않은 알림 ${unread}개`}</p></div>
      {params.message && <div className="callout" role="status">{params.message.slice(0,180)}</div>}
      <nav aria-label="알림 보기" className={styles.tabs}>{([['all','전체'],['unread','안 읽음'],['replies','답변·댓글'],['games','관심 게임']] as const).map(([value,label]) => <Link key={value} href={value === "all" ? "/notifications" : `/notifications?filter=${value}`} aria-current={filter === value ? "page" : undefined}>{label}</Link>)}</nav>
      <p className={styles.note}>알림을 열면 해당 알림만 읽음 처리합니다. 선택한 조건의 최근 알림을 최대 100개까지 보여드립니다.</p>
      {unread !== null && unread > 0 && <form action={markNotificationsReadAction}><PendingButton>모두 읽음 처리</PendingButton></form>}
      <div className="notification-list">
        {feed.failed ? <div className="callout danger" role="alert">알림을 불러오지 못했습니다. <a href="/notifications">다시 확인하기</a></div> : feed.rows.length ? feed.rows.map(item => {
          const game = item.game_universe_id ? gameMap.get(Number(item.game_universe_id)) : null;
          return <form key={item.id} action={openNotification} className={styles.notificationForm}>
            <input type="hidden" name="notification_id" value={item.id} />
            <PendingButton className={`notification-row ${styles.notificationButton} ${item.read_at ? "" : "unread"}`} label="알림을 여는 중…">
              {!item.read_at && <small className={styles.badge}>안 읽음</small>}
              <strong>{notificationLabels[item.kind] ?? "새 알림"}</strong><span>{game?.nameKo ?? "오름"} · {formatKstDateTime(item.created_at)}</span>
            </PendingButton>
          </form>;
        }) : <div className="no-data"><strong>{filter === "unread" ? "읽지 않은 알림이 없습니다." : "이 조건의 알림이 없습니다."}</strong><p>질문에 답변이 달리거나 팔로우한 게임에 새 소식이 확인되면 알려드립니다.</p><Link className="secondary-button" href="/games">관심 게임 찾아보기</Link></div>}
      </div>
    </main>
  </>;
}
