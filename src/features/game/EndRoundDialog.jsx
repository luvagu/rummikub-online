import { Flag } from "lucide-react";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { useT } from "../../i18n/index.js";

// Host-only confirmation before ending the round for everyone (nobody wins, scores do not change).
export function EndRoundDialog({ onClose, onConfirm }) {
  const t = useT();
  return (
    <ConfirmDialog
      title={t("endRound")}
      body={t("endRoundQ")}
      icon={Flag}
      cancel={t("stay")}
      confirm={t("endRoundYes")}
      onCancel={onClose}
      onConfirm={onConfirm}
    />
  );
}
