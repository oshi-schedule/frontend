"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Users } from "lucide-react";
import { getGroup } from "@/api/groups";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const group = useQuery({ queryKey: ["group", id], queryFn: () => getGroup(id) });

  if (group.isLoading) {
    return <p className="py-12 text-center text-sm text-[var(--muted)]">読み込み中…</p>;
  }

  if (!group.data) {
    return <p className="py-12 text-center text-sm text-[var(--muted)]">グループが見つかりません</p>;
  }

  const { display_name, canonical_name, status, members } = group.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#e0f2fe] text-[#0369a1]">
          <Users size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{display_name}</h1>
          {canonical_name !== display_name && (
            <p className="text-xs text-[var(--muted)] mt-0.5">{canonical_name}</p>
          )}
          <Badge className="mt-1">{status}</Badge>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-bold">メンバー ({members.length})</h2>
        {members.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <Card key={member.id} className="flex items-center gap-3 p-3">
                {member.member_color && (
                  <div
                    className="h-8 w-8 shrink-0 rounded-full border border-[var(--border)]"
                    style={{ backgroundColor: member.member_color }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm">{member.display_name}</p>
                  {member.x_screen_name && (
                    <p className="text-xs text-[var(--muted)]">@{member.x_screen_name}</p>
                  )}
                </div>
                <Badge className="shrink-0 text-[10px]">{member.status}</Badge>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-sm text-[var(--muted)]">メンバー情報なし</Card>
        )}
      </section>
    </div>
  );
}
