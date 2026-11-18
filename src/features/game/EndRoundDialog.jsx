import { Modal } from "../../components/Modal.jsx";
import { useT } from "../../i18n/index.js";

// Host-only confirmation before ending the round for everyone (nobody wins, scores do not change).
export function EndRoundDialog({ onClose, onConfirm }) {
  const t = useT();
  return (
    <Modal title={t("endRound")} onClose={onClose}>
      <h2>{t("endRound")}</h2>
      <p>{t("endRoundQ")}</p>
      <div className="row">
        <button data-autofocus onClick={onClose}>
          {t("stay")}
        </button>
        <button
          className="primary danger"
          onClick={onConfirm}
        >
          {t("endRoundYes")}
        </button>
      </div>
    </Modal>
  );
}
