import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/ui";
import { NewDocumentForm } from "@/components/NewDocumentForm";

export default async function NewDocumentPage() {
  const user = await requireUser();
  return (
    <DashboardShell email={user.email}>
      <Link href="/" className="mb-3 inline-block text-sm font-medium text-[#8b95a1] hover:text-[#4e5968]">
        ← 목록
      </Link>
      <PageHeader title="새 서명 요청" subtitle="PDF를 올리고 서명자를 추가하세요" />
      <NewDocumentForm />
    </DashboardShell>
  );
}
