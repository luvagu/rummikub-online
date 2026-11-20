import { Trophy } from "lucide-react";
import { Modal } from "../../components/Modal.jsx";
import { useT } from "../../i18n/index.js";
import { Standings } from "./Standings.jsx";

// The room's standings during a game (opened from the menu or by tapping the seat chips). One way out: the close button
// in the header (Escape, the back gesture and a tap outside too).
export function ScoresDialog({ s, onClose }) {
  const t = useT();
  return (
    <Modal title={t("scores")} icon={Trophy} onClose={onClose}>
      <div className="center">
        <p className="sub">{t("roundN", { n: s.games + 1 })}</p>
        <Standings s={s} tiles />
      </div>
    </Modal>
  );
}
