import type { Dictionary } from "@/lib/i18n/dictionary";
import type { StageBarLabels } from "@/features/supplier-portal/stage-progress-bar";

/** The bar's vocabulary, built once per page and shared by every row. */
export function stageBarLabels(dict: Dictionary): StageBarLabels {
  return {
    group: dict.portal.projects.stageBar,
    current: dict.portal.projects.currentStage,
    segment: dict.portal.projects.stageSegment,
    stages: dict.enums.stageKey,
    statuses: dict.status.stage,
  };
}

/** Wording for the `FormDialog` chrome — Cancel, Saving…, Uploading… — in the supplier's language. */
export function dialogLabels(dict: Dictionary) {
  return {
    cancel: dict.common.cancel,
    saving: dict.common.saving,
    uploading: dict.common.uploadingFile,
    unreachable: `${dict.common.somethingWentWrong} ${dict.common.tryAgain}`,
  };
}

/** Everything a supplier reads around a conversation: composer, attachments, refusals. */
export function threadLabels(dict: Dictionary) {
  const m = dict.portal.messages;
  return {
    placeholder: m.placeholder,
    send: m.send,
    sent: m.sent,
    attach: m.attach,
    removeFile: m.removeFile,
    attachments: m.attachments,
    sending: m.sending,
    shortcut: m.sendShortcut,
    empty: m.emptyMessage,
    fileTooLarge: dict.portal.requests.fileSizeError,
    fileType: dict.portal.requests.fileTypeError,
    uploading: dict.portal.requests.uploadingPercent,
    connectionFailed: dict.portal.requests.connectionFailed,
    storageRefused: dict.portal.requests.storageRefused,
    unreachable: `${dict.common.somethingWentWrong} ${dict.common.tryAgain}`,
  };
}
