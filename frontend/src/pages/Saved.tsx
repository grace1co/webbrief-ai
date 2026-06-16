import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { AnalysisListItem } from "../types";
import { Button, Card, EmptyState, ErrorState, Icon, Shell, Spinner } from "../components/ui";

export default function Saved() {
  const [items, setItems] = useState<AnalysisListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listSaved().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Failed to load saved analyses."));
  }, []);

  async function removeSaved(id: string) {
    if (removingId) return;

    if (!window.confirm("Remove this analysis from saved?")) return;

    setRemovingId(id);
    setError(null);

    try {
      await api.unsaveAnalysis(id);
      setItems((current) => current?.filter((item) => item.analysis_id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove saved analysis.");
    } finally {
      setRemovingId(null);
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
        <div className="flex items-center justify-between gap-stack-md flex-wrap">
          <div>
            <span className="text-label-caps uppercase text-secondary">Saved</span>
            <h1 className="text-h2 font-bold mt-1">Saved Analyses</h1>
            <p className="text-body-sm text-on-surface-variant">Saved items remain here until you remove them.</p>
          </div>
          <Button onClick={() => navigate("/")}><Icon name="add" /> New Analysis</Button>
        </div>

        {error && <ErrorState message={error} />}
        {!items && !error && <Spinner label="Loading saved analyses..." />}
        {items?.length === 0 && <EmptyState icon="bookmark" title="No saved analyses yet" hint="Use the bookmark button on an analysis to save it here." />}

        {items && items.length > 0 && (
          <div className="relative">
            <Icon name="search" className="absolute left-stack-sm top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search saved analyses..." className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-stack-md py-stack-sm text-body-md focus:outline-none focus:border-primary" />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-gutter">
          {filtered?.map((item) => (
            <AnalysisCard
              key={item.analysis_id}
              item={item}
              onOpen={() => navigate(`/analysis/${item.analysis_id}`)}
              onRemove={() => removeSaved(item.analysis_id)}
              isRemoving={removingId === item.analysis_id}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

function AnalysisCard({ item, onOpen, onRemove, isRemoving }: { item: AnalysisListItem; onOpen: () => void; onRemove: () => void; isRemoving?: boolean }) {
  return (
    <Card className="flex flex-col gap-stack-sm">
      <div className="flex items-start justify-between gap-stack-sm">
        <div className="min-w-0"><h2 className="text-body-md font-bold truncate">{item.website_title || item.url}</h2><p className="text-mono-data text-on-surface-variant truncate">{item.url}</p></div>
        <span className="material-symbols-outlined text-primary shrink-0" style={{ fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24' }}>bookmark</span>
      </div>
      {item.summary_preview && <p className="text-body-sm text-on-surface-variant line-clamp-3">{item.summary_preview}</p>}
      <div className="flex items-center justify-between mt-auto pt-stack-sm gap-stack-sm">
        <span className="text-body-sm text-on-surface-variant">{item.pages_crawled} pages · {new Date(item.date_analyzed).toLocaleDateString()}</span>
        <div className="flex gap-stack-sm">
          <button
            onClick={onRemove}
            disabled={isRemoving}
            className="text-on-surface-variant hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Remove from Saved"
            title="Remove from Saved"
          >
            <Icon name="bookmark_remove" />
          </button>
          <Button variant="secondary" onClick={onOpen}>Open</Button>
        </div>
      </div>
    </Card>
  );
}