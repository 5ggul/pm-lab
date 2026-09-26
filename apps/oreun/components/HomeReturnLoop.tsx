import Link from "next/link";
import PlayIcon from "./PlayIcon";
import styles from "./home-return-loop.module.css";

export type HomeReturnGameRow = {
  slug: string;
  name: string;
  playingLabel: string;
  change24h: string;
  change7d: string;
  unread: number;
  unreadKinds: string[];
};

export default function HomeReturnLoop({
  loggedIn,
  rows,
  unreadTotal,
}: {
  loggedIn: boolean;
  rows: HomeReturnGameRow[];
  unreadTotal: number;
}) {
  if (!loggedIn) {
    return (
      <section className={styles.shell} aria-labelledby="home-return-title">
        <div className={styles.head}>
          <div>
            <span className={styles.eyebrow}>매일 확인할 이유</span>
            <h2 id="home-return-title"><PlayIcon name="spark" /> 내 게임 변화만 모아보기</h2>
          </div>
          <Link className={styles.headLink} href="/login?next=/games">Google 로그인 →</Link>
        </div>
        <div className={styles.guest}>
          <div>
            <strong>자주 하는 게임을 팔로우해 두세요.</strong>
            <p>새 공략·공짜 혜택·질문·업데이트 시각 변경 감지처럼 실제로 달라진 항목을 한 곳에서 다시 확인할 수 있어요.</p>
          </div>
          <Link href="/games">게임 고르기</Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-labelledby="home-return-title">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>지난 확인 이후 볼 것</span>
          <h2 id="home-return-title"><PlayIcon name="spark" /> 내 게임 변화</h2>
          <p>팔로우한 게임의 현재 상태와 아직 읽지 않은 변화를 먼저 보여드려요.</p>
        </div>
        <Link className={styles.headLink} href="/notifications">안 읽은 알림 {unreadTotal}개 →</Link>
      </div>
      {rows.length ? (
        <div className={styles.grid}>
          {rows.map((row) => (
            <article className={styles.card} key={row.slug}>
              <Link className={styles.gameLink} href={"/game/" + row.slug}>
                <span>{row.name}</span><strong>{row.playingLabel}</strong>
              </Link>
              <div className={styles.metrics}>
                <span><small>24H</small>{row.change24h}</span>
                <span><small>7D</small>{row.change7d}</span>
              </div>
              {row.unread > 0 ? (
                <Link className={styles.unread} href="/notifications?filter=unread">
                  <b>{row.unread}개 변화</b><span>{row.unreadKinds.slice(0, 2).join(" · ")}</span>
                </Link>
              ) : (
                <div className={styles.quiet}><span>새로 확인할 알림 없음</span><Link href={"/game/" + row.slug}>상세 보기 →</Link></div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.guest}>
          <div>
            <strong>아직 팔로우한 게임이 없어요.</strong>
            <p>게임 상세에서 ‘팔로우’를 누르면 이 자리에 현재 인원과 24H·7D 변화, 새 공략·혜택·질문 알림이 모입니다.</p>
          </div>
          <Link href="/games">첫 게임 팔로우하기</Link>
        </div>
      )}
    </section>
  );
}
