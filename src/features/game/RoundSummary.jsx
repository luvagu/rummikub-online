import { useState } from "react";
import { Trophy, LogOut, ChevronDown } from "lucide-react";
import { Modal } from "../../components/Modal.jsx";
import { Invite } from "../../components/Invite.jsx";
import { Seats } from "../../components/Seats.jsx";
import { Avatar } from "../../components/Avatar.jsx";
import { useT } from "../../i18n/index.js";
import { Standings } from "./Standings.jsx";
import { SIGNED } from "./display.js";

// The dialog between rounds: who won (or that the host ended the round), the scores, and "play next game".
// The room (invite + seats) folds into a disclosure so the standings and the next-game button fit on a phone; it starts
// open when the host still has seats to fill.
export function RoundSummary({ s, net, copy, share, whatsappUrl, inRoom, hostRoom, onLeave }) {
  const t = useT(),
    me = s.me,
    cx = !!(s.result && s.result.cancelled), // the host ended the round early (no winner, no score change)
    winner = cx ? null : s.players[s.result.winner],
    gain = winner ? s.result.delta?.[winner.id] : null,
    title = cx
      ? t("roundEnded")
      : t(s.result.blocked ? "winsPool" : "wins", { name: winner?.name || "" }),
    [roomOpen, setRoomOpen] = useState(() => hostRoom && s.players.length < 4);
  return (
    <Modal felt={inRoom} title={title}>
      <div className="center summary">
        <header className="sum-hero">
          <Trophy size={44} className="gold" />
          <h2>{title}</h2>
          {gain > 0 && <span className="sum-delta">{SIGNED.format(gain)}</span>}
          {cx && <p>{t("roundEndedD")}</p>}
          <p className="sub">{t("roundN", { n: s.games })}</p>
        </header>
        <Standings s={s} result={s.result} />
        {inRoom && (
          <details
            className="room"
            open={roomOpen}
            onToggle={(e) => setRoomOpen(e.currentTarget.open)}
          >
            <summary>
              {t("room")} · {s.players.length}/4
              <span className="room-stack" aria-hidden="true">
                {s.players.map((p, i) => (
                  <Avatar key={p.id} name={p.name} i={i} bot={p.bot} />
                ))}
              </span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            {hostRoom && s.players.length < 4 && (
              <Invite net={net} copy={copy} share={share} whatsappUrl={whatsappUrl} />
            )}
            <Seats s={s} net={net} host={hostRoom} />
          </details>
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
