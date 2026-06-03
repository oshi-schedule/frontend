"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCcw, ShieldCheck, ShieldOff } from "lucide-react";
import {
  createContributorToken,
  listContributorTokens,
  updateContributorToken,
  type ContributorTokenRead,
} from "@/api/admin-ocr";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ContributorsPage() {
  const [contributors, setContributors] = useState<ContributorTokenRead[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("contributor");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadContributors() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listContributorTokens();
      setContributors(response.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Contributor一覧の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadContributors();
  }, []);

  const totalUploads = useMemo(
    () => contributors.reduce((sum, contributor) => sum + contributor.upload_count, 0),
    [contributors],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contributorName = name.trim();
    if (!contributorName) {
      setError("Contributor名を入力してください。");
      return;
    }
    setIsCreating(true);
    setError(null);
    setCopied(false);
    try {
      const response = await createContributorToken({ contributor_name: contributorName, role: role.trim() || "contributor" });
      setCreatedToken(response.token);
      setCreatedName(response.contributor.contributor_name);
      setName("");
      setRole("contributor");
      await loadContributors();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Contributor tokenの発行に失敗しました。");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggle(contributor: ContributorTokenRead) {
    setUpdatingId(contributor.id);
    setError(null);
    try {
      const updated = await updateContributorToken(contributor.id, { is_active: !contributor.is_active });
      setContributors((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Contributor tokenの更新に失敗しました。");
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyCreatedToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributors"
        subtitle="外部協力者向けアップロードキーを発行し、誰が何枚アップロードしたかを確認します。"
        backHref="/admin/candidate-queue"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <KeyRound className="h-4 w-4" />
            Contributors
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{contributors.length}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <ShieldCheck className="h-4 w-4" />
            Active
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {contributors.filter((contributor) => contributor.is_active).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Uploads</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{totalUploads}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-slate-950">
              <Plus className="h-4 w-4" />
              Token発行
            </h2>
            <p className="mt-1 text-sm text-slate-500">発行されたtokenはこの画面で一度だけ表示されます。</p>
          </div>

          <form className="space-y-3" onSubmit={handleCreate}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Contributor name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="後輩A"
                maxLength={120}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="contributor">contributor</option>
                <option value="trusted">trusted</option>
              </select>
            </label>

            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              発行
            </Button>
          </form>

          {createdToken ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-800">{createdName} の認証キー</p>
              <p className="mt-2 break-all rounded bg-white p-2 font-mono text-xs text-slate-900">{createdToken}</p>
              <Button type="button" variant="outline" size="sm" onClick={copyCreatedToken} className="mt-3 w-full">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "コピー済み" : "コピー"}
              </Button>
            </div>
          ) : null}

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-950">Upload Activity</h2>
            <Button type="button" variant="outline" size="sm" onClick={loadContributors} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              更新
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-400">
                  <th className="py-2 pr-3">Name</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Uploads</th>
                  <th className="px-3 py-2">Last used</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((contributor) => (
                  <tr key={contributor.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-950">{contributor.contributor_name}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">{contributor.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className="border-slate-200 bg-slate-50 text-slate-700">{contributor.role}</Badge>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-900">{contributor.upload_count}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(contributor.last_used_at)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(contributor.created_at)}</td>
                    <td className="py-3 pl-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(contributor)}
                        disabled={updatingId === contributor.id}
                      >
                        {updatingId === contributor.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : contributor.is_active ? (
                          <ShieldOff className="mr-2 h-4 w-4" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        {contributor.is_active ? "無効化" : "有効化"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && contributors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      Contributor tokenはまだありません。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
