import { Trophy, Crown, Layers } from "lucide-react";
import { useT } from "../../i18n/index.js";
import { SIGNED } from "./display.js";

// The room's ranking by total points: place, name, total and games won. With a finished round's `result` it also shows
// each player's points for that round and crowns its winner; with `tiles` it shows the tiles each player still holds.
export function Standings({ s, result, tiles }) {
  const t = useT(),
    done = !!result && !result.cancelled,
    winId = done ? s.players[result.winner]?.id : null,
    ranked = s.players.toSorted((a, b) => s.scores[b.id] - s.scores[a.id]),
    // ties share a place (1, 1, 3); no podium medals while nobody has scored yet
    place = (p) => 1 + ranked.filter((q) => s.scores[q.id] > s.scores[p.id]).length,
    medals = ranked.some((p) => s.scores[p.id] !== 0);
  return (
    <ul className="res">
      {ranked.map((p) => {
        const v = done ? result.delta?.[p.id] || 0 : 0,
          won = done && winId === p.id;
        return (
          <li key={p.id} className={won ? "won" : undefined} data-rank={medals ? place(p) : undefined}>
            <span className="rk">{place(p)}</span>
            <b>
              {p.name}
              {won && <Crown size={14} aria-label={t("roundWinner")} />}
            </b>
            {done && (
              <span className={v > 0 ? "pos" : "neg"}>{SIGNED.format(v)}</span>
            )}
            <span className="meta">
              {tiles && (
                <span aria-label={t("tiles", { n: p.n })}>
                  <Layers size={12} /> {p.n}
                </span>
              )}
              <span className="tot">
                {t("total")} <b>{s.scores[p.id]}</b>
              </span>
              <span>
                <Trophy size={12} /> {s.wins[p.id]} {t("winsLbl")}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
