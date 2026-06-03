"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, Calendar, FileText, Users } from "lucide-react";
import { getAdminStats } from "@/api/admin";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  href: string;
  color: string;
}

function StatCard({ label, value, icon: Icon, href, color }: StatCardProps) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 p-5 hover:shadow-md transition-shadow cursor-pointer">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value ?? "–"}</p>
          <p className="text-sm text-[var(--muted)]">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

const quickMenuSections = [
  {
    title: "Labeling",
    description: "SourceからEvent Candidate正解データを作る主導線です。",
    items: [
      { href: "/admin/training-dataset", label: "Labeling Upload", desc: "Sourceをアップロードして EventCandidate を作成。レビュー編集は候補詳細へ分離" },
      { href: "/admin/event-candidate-reviews", label: "Labeling Analytics", desc: "training_event_candidates の件数と項目別修正率を確認" },
      { href: "/admin/event-candidate-review", label: "Draft Review", desc: "OCR Draft由来のpending候補をApprove/Edit/Rejectする運用レビュー" },
      { href: "/admin/ocr-test", label: "OCR Draft Upload", desc: "Upload Session単位でOCR Draftを作成する補助導線" },
    ],
  },
  {
    title: "Core Admin",
    description: "Event Coreと基本マスタを管理します。",
    items: [
      { href: "/admin/events/new", label: "新規イベント登録", desc: "イベントとタイムテーブルを手動作成" },
      { href: "/admin/events", label: "Events", desc: "登録済みイベントを確認・編集" },
      { href: "/admin/sources", label: "Sources", desc: "投入済みSourceを確認" },
      { href: "/admin/merge", label: "Merge", desc: "Group / Venue / Event を統合" },
    ],
  },
  {
    title: "Labs",
    description: "抽出器とVisionの実験用。教師データ作成の入口ではありません。",
    items: [
      { href: "/admin/labs/gpt-extraction-benchmark", label: "GPT Extraction Benchmark", desc: "Training Candidateごとの画像直読みによる比較" },
      { href: "/admin/ocr-evaluation", label: "OCR Evaluation Lab", desc: "100枚までのSourceKind / LayoutGraph一括評価" },
      { href: "/admin/vision-structure-test", label: "Vision Structure Test", desc: "GPT Visionのcontainer / session構造を観測して保存" },
      { href: "/admin/ndlocr-qwen-benchmark", label: "NDLOCR Qwen PoC", desc: "Vast.ai上のNDLOCR ver2 + qwen3:4bで単発Event Candidate抽出を検証" },
    ],
  },
];

export default function AdminDashboardPage() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">管理画面ホーム</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="イベント"
          value={stats.data?.events}
          icon={Calendar}
          href="/admin/events"
          color="bg-[var(--primary)]"
        />
        <StatCard
          label="グループ"
          value={stats.data?.groups}
          icon={Users}
          href="/admin/groups"
          color="bg-[#0f766e]"
        />
        <StatCard
          label="会場"
          value={stats.data?.venues}
          icon={Building2}
          href="/admin/venues"
          color="bg-[#2563eb]"
        />
        <StatCard
          label="処理待ちSource"
          value={stats.data?.pending_sources}
          icon={FileText}
          href="/admin/sources"
          color="bg-[#d97706]"
        />
      </div>

      <div className="space-y-5">
        {quickMenuSections.map((section) => (
          <section key={section.title} className="space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{section.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{section.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map(({ href, label, desc }) => (
                <Link key={href} href={href}>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
                    <p className="font-bold text-sm">{label}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{desc}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
