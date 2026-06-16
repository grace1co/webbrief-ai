import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { AnalysisListItem, HistorySettings } from "../types";
import { Button, Card, EmptyState, ErrorState, Icon, Shell, Spinner } from "../components/ui";

export default function History() {
  const [items, setItems] = useState<AnalysisListItem[] | null>(null);
  const [settings, setSettings] = useState<HistorySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  function load() {
    setError(null);
    Promise.all([api.listHistory(), api.getHistorySettings()])
      .then(([history, historySettings]) => {
      setItems(history);
      setSettings(historySettings);
    })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load history."));
  }

  useEffect(load, []);

  async function updateRetention(value: string) {
    const retention = value === "forever" ? null : (Number(value) as 7 | 30 | 90);

    try {
      setSettings(await api.updateHistorySettings(retention));
      setItems(await api.listHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update history settings.");
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear all unsaved analysis history? Saved analyses will remain.")) {
      return;
    }

    try {
      await api.clearHistory();
      setItems((current) => current?.filter((item) => item.is_saved) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear history.");
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteAnalysis(id);
      setItems((current) => current?.filter((item) => item.analysis_id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete analysis.");
    }
  }

  async function toggleSaved(item: AnalysisListItem) {
    try {
      const result = item.is_saved
        ? await api.unsaveAnalysis(item.analysis_id)
        : await api.saveAnalysis(item.analysis_id);

      setItems(
        (current) =>
          current?.map((entry) =>
            entry.analysis_id === item.analysis_id
              ? { ...entry, is_saved: result.is_saved }
              : entry
          ) ?? null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update saved status.");
    }
  }

  const filtered = items?.filter((item) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return item.url.toLowerCase().includes(query) || (item.website_title?.toLowerCase() ?? "").includes(query);
  });

  return (
    <Shell>
      <div className="max-w-[1000px] mx-auto px-gutter py-stack-lg flex flex-col gap-stack-md">
        <div className="flex items-center justify-between gap-stack-md flex-wrap"><div><span className="text-label-caps uppercase text-secondary">History</span><h1 className="text-h2 font-bold mt-1">Recent Analyses</h1><p className="text-body-sm text-on-surface-variant">History is automatic. Bookmark analyses you want to keep permanently.</p></div><Button onClick={() => navigate("/")}><Icon name="add" /> New Analysis</Button></div>

        <Card className="flex items-end justify-between gap-stack-md flex-wrap">
          <label className="flex flex-col gap-stack-sm"><span className="text-body-sm font-bold">History retention</span><select value={settings?.retention_days ?? "forever"} onChange={(e) => updateRetention(e.target.value)} disabled={!settings} className="bg-surface-container-high border border-outline-variant rounded-lg px-stack-md py-stack-sm text-body-sm"><option value="7">Keep history for 7 days</option><option value="30">Keep history for 30 days</option><option value="90">Keep history for 90 days</option><option value="forever">Keep history forever</option></select></label>
          <button onClick={clearHistory} className="inline-flex items-center gap-stack-sm rounded-lg border border-outline-variant px-stack-md py-stack-sm text-body-sm font-bold text-on-surface-variant hover:border-error hover:text-error"><Icon name="delete_sweep" /> Clear History</button>
        </Card>

        {error && <ErrorState message={error} />}
        {!items && !error && <Spinner label="Loading history..." />}
        {items?.length === 0 && <EmptyState icon="history" title="No analysis history yet" hint="Analyze a website and it will appear here automatically." />}
        {items && items.length > 0 && <div className="relative"><Icon name="search" className="absolute left-stack-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search history..." className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-stack-md py-stack-sm text-body-md focus:outline-none focus:border-primary" /></div>}

        <div className="grid sm:grid-cols-2 gap-gutter">{filtered?.map((item) => <Card key={item.analysis_id} className="flex flex-col gap-stack-sm"><div className="flex items-start justify-between gap-stack-sm"><div className="min-w-0"><h2 className="text-body-md font-bold truncate">{item.website_title || item.url}</h2><p className="text-mono-data text-on-surface-variant truncate">{item.url}</p></div><button onClick={() => toggleSaved(item)} className={item.is_saved ? "text-primary" : "text-on-surface-variant hover:text-primary"} aria-label={item.is_saved ? "Remove from Saved" : "Save Analysis"} title={item.is_saved ? "Remove from Saved" : "Save Analysis"}><span className="material-symbols-outlined" style={{ fontVariationSettings: `"FILL" ${item.is_saved ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" 24` }}>bookmark</span></button></div>{item.summary_preview && <p className="text-body-sm text-on-surface-variant line-clamp-3">{item.summary_preview}</p>}<div className="flex items-center justify-between mt-auto pt-stack-sm gap-stack-sm"><span className="text-body-sm text-on-surface-variant">{item.pages_crawled} pages · {new Date(item.date_analyzed).toLocaleDateString()}</span><div className="flex gap-stack-sm">{!item.is_saved && <button onClick={() => remove(item.analysis_id)} className="text-on-surface-variant hover:text-error" aria-label="Delete history item" title="Delete history item"><Icon name="delete" /></button>}<Button variant="secondary" onClick={() => navigate(`/analysis/${item.analysis_id}`)}>Open</Button></div></div></Card>)}</div>
      </div>
    </Shell>
  );
}
