import { Trophy, Crown, LogOut } from "lucide-react";
import { Modal } from "../../components/Modal.jsx";
import { Invite } from "../../components/Invite.jsx";
import { Seats } from "../../components/Seats.jsx";
import { useT } from "../../i18n/index.js";
import { SIGNED } from "./display.js";

// The dialog between rounds: who won (or that the host ended the round), the scores, and "play next game".
export function RoundSummary({ s, net, copy, share, inRoom, hostRoom, onLeave }) {
  const t = useT(),
    me = s.me,
    cx = !!(s.result && s.result.cancelled), // the host ended the round early (no winner, no score change)
    ranked = s.players.toSorted((a, b) => s.scores[b.id] - s.scores[a.id]);
  return (
    <Modal
      felt={inRoom}
      title={
        cx
          ? t("roundEnded")
          : t(s.result.blocked ? "winsPool" : "wins", {
              name: s.players[s.result.winner]?.name || "",
            })
      }
    >
      <div className="center">
        <Trophy size={40} className="gold" />
        <h2>
          {cx
            ? t("roundEnded")
            : t(s.result.blocked ? "winsPool" : "wins", {
                name: s.players[s.result.winner]?.name || "",
              })}
        </h2>
        {cx && <p>{t("roundEndedD")}</p>}
        <p className="sub">{t("roundN", { n: s.games })}</p>
        <ul className="res">
          {ranked.map((p, rank) => {
            const v = cx ? 0 : s.result.delta?.[p.id] || 0,
              won = !cx && s.players[s.result.winner]?.id === p.id;
            return (
              <li key={p.id} className={won ? "won" : undefined}>
                <span className="rk">{rank + 1}</span>
                <b>
                  {p.name}
                  {won && <Crown size={14} aria-label={t("roundWinner")} />}
                </b>
                {!cx && (
                  <span className={v > 0 ? "pos" : "neg"}>
                    {SIGNED.format(v)}
                  </span>
                )}
                <span className="meta">
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
        {inRoom && (
          <>
            <p className="sub">{t("room")}</p>
            {hostRoom && s.players.length < 4 && (
              <Invite net={net} copy={copy} share={share} />
            )}
            <Seats s={s} net={net} host={hostRoom} />
          </>
        )}
        <div className="endact">
          {me === 0 ? (
            <button
              className="primary big"
              data-autofocus
              disabled={s.players.length < 2}
              onClick={() => net.send({ t: "start" })}
            >
              {t("next")}
            </button>
          ) : (
            <p>{t("waitNext")}</p>
          )}
          {me === 0 && s.players.length < 2 && (
            <p className="sub">{t("need2")}</p>
          )}
          <button className="link" onClick={onLeave}>
            <LogOut size={16} />
            {t("leave")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
