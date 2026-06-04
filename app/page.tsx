import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Card, PageHeader, EmptyState, StatTile, ListRow, fmtDate } from "@/components/ui";
import { DOC_STATUS_LABEL } from "@/lib/labels";
import type { Document, SignStatus } from "@/lib/database.types";

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as Document[];

  const count = (s: SignStatus) => docs.filter((d) => d.status === s).length;
  const inFlight = docs.filter((d) => d.status === "sent" || d.status === "in_progress").length;

  return (
    <DashboardShell email={user.email}>
      <PageHeader
        title="전자서명"
        subtitle="문서를 올리고 서명을 요청하세요"
        action={
          <Link href="/documents/new" className="btn-primary">
            + 새 서명 요청
          </Link>
        }
      />

      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="전체 문서" value={docs.length} />
        <StatTile label="진행중" value={inFlight} />
        <StatTile label="완료" value={count("completed")} />
        <StatTile label="초안" value={count("draft")} />
      </div>

      <Card className="!p-2">
        {docs.length === 0 ? (
          <EmptyState
            message="아직 문서가 없어요. 첫 서명 요청을 만들어 보세요."
            cta={
              <Link href="/documents/new" className="btn-primary">
                + 새 서명 요청
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[#f2f4f6]">
            {docs.map((d) => (
              <ListRow
                key={d.id}
                href={`/documents/${d.id}`}
                title={d.title}
                subtitle={`${fmtDate(d.created_at)} · ${d.source_app}`}
                value={<Badge value={d.status} label={DOC_STATUS_LABEL[d.status]} />}
              />
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
