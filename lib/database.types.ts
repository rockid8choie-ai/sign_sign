// 손으로 작성한 DB 타입. 로컬 Supabase 연결 후 `npm run gen:types`로 교체 가능.

export type SignStatus =
  | "draft" | "sent" | "in_progress" | "completed" | "declined" | "voided" | "expired";
export type RecipientStatus =
  | "pending" | "sent" | "viewed" | "signed" | "declined";
export type FieldType =
  | "signature" | "initial" | "text" | "date" | "checkbox" | "name";
export type RecipientRole = "signer" | "viewer";
export type SourceApp = "fm_os" | "momocare" | "manual";

export type Document = {
  id: string;
  source_app: string;
  external_ref: string | null;
  org_ref: string | null;
  title: string;
  message: string | null;
  status: SignStatus;
  file_path: string | null;
  signed_file_path: string | null;
  cert_path: string | null;
  page_count: number;
  ordered: boolean;
  created_by: string | null;
  api_key_id: string | null;
  webhook_url: string | null;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Recipient = {
  id: string;
  document_id: string;
  name: string;
  email: string;
  role: RecipientRole;
  order_index: number;
  status: RecipientStatus;
  access_token: string | null;
  color: string;
  viewed_at: string | null;
  signed_at: string | null;
  declined_reason: string | null;
  sign_ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type Field = {
  id: string;
  document_id: string;
  recipient_id: string | null;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  label: string | null;
  value: string | null;
  asset_path: string | null;
  created_at: string;
};

export type SignEvent = {
  id: string;
  document_id: string;
  recipient_id: string | null;
  type: string;
  actor: string | null;
  ip: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type ApiKey = {
  id: string;
  label: string;
  source_app: string;
  key_hash: string;
  prefix: string;
  revoked: boolean;
  created_at: string;
};

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

type TableDef<T> = { Row: Row<T>; Insert: Insert<T>; Update: Update<T>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      documents: TableDef<Document>;
      recipients: TableDef<Recipient>;
      fields: TableDef<Field>;
      events: TableDef<SignEvent>;
      api_keys: TableDef<ApiKey>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      sign_status: SignStatus;
      recipient_status: RecipientStatus;
      field_type: FieldType;
      recipient_role: RecipientRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
