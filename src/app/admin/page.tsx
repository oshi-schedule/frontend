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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/admin/events/new", label: "新規イベント登録", desc: "イベントとタイムテーブルを作成" },
          { href: "/admin/merge", label: "Merge", desc: "Group / Venue / Event を統合" },
          { href: "/admin/sources", label: "Source確認", desc: "OCR投入待ちのSourceを確認" },
          { href: "/admin/ocr-test", label: "OCR Test", desc: "画像から OCR と Event Core解決結果を検証" },
        ].map(({ href, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer h-full">
              <p className="font-bold text-sm">{label}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
