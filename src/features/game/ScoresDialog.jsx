import { Modal } from "../../components/Modal.jsx";
import { useT } from "../../i18n/index.js";
import { Standings } from "./Standings.jsx";

// The room's standings during a game (opened from the menu or by tapping the seat chips).
export function ScoresDialog({ s, onClose }) {
  const t = useT();
  return (
    <Modal title={t("scores")} onClose={onClose}>
      <div className="center">
        <h2>{t("scores")}</h2>
        <p className="sub">{t("roundN", { n: s.games + 1 })}</p>
        <Standings s={s} tiles />
        <div className="row">
          <button className="primary" data-autofocus onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
