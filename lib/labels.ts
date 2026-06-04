import type { SignStatus, RecipientStatus, FieldType } from "@/lib/database.types";

export const DOC_STATUS_LABEL: Record<SignStatus, string> = {
  draft: "초안",
  sent: "발송됨",
  in_progress: "진행중",
  completed: "완료",
  declined: "거절됨",
  voided: "취소됨",
  expired: "만료됨",
};

export const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  pending: "대기",
  sent: "발송됨",
  viewed: "열람",
  signed: "서명완료",
  declined: "거절",
};

export const FIELD_LABEL: Record<FieldType, string> = {
  signature: "서명",
  initial: "이니셜",
  text: "텍스트",
  date: "날짜",
  checkbox: "체크",
  name: "이름",
};

export const RECIPIENT_COLORS = [
  "#3182f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444",
];
