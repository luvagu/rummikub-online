import { Trophy, LogOut } from "lucide-react";
import { Modal } from "../../components/Modal.jsx";
import { Invite } from "../../components/Invite.jsx";
import { Seats } from "../../components/Seats.jsx";
import { useT } from "../../i18n/index.js";
import { Standings } from "./Standings.jsx";

// The dialog between rounds: who won (or that the host ended the round), the scores, and "play next game".
export function RoundSummary({ s, net, copy, share, whatsappUrl, inRoom, hostRoom, onLeave }) {
  const t = useT(),
    me = s.me,
    cx = !!(s.result && s.result.cancelled); // the host ended the round early (no winner, no score change)
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
        <Standings s={s} result={s.result} />
        {inRoom && (
          <>
            <p className="sub">{t("room")}</p>
            {hostRoom && s.players.length < 4 && (
              <Invite net={net} copy={copy} share={share} whatsappUrl={whatsappUrl} />
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
