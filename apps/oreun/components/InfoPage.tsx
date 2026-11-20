import type { ReactNode } from "react";
import Header from "./Header";
import type { GameView } from "@/lib/types";

export default function InfoPage({
  games,
  title,
  intro,
  children,
}: {
  games: GameView[];
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <Header games={games} />
      <main className="page methodology">
        <div className="page-title">
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        {children}
      </main>
    </>
  );
}
