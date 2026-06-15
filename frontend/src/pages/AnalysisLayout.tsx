import { useEffect, useState } from "react";
import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { AnalysisDetail } from "../types";
import { Chip, ErrorState, Shell, Spinner } from "../components/ui";

export type AnalysisContext = { analysis: AnalysisDetail };

export function useAnalysis() {
  return useOutletContext<AnalysisContext>();
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function AnalysisLayout() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setError(null);
    setAnalysis(null);
    api
      .getAnalysis(id)
      .then(setAnalysis)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load analysis."));
  }, [id]);

  const headerRight = analysis ? (
    <Chip>{analysis.pages_crawled} Pages Crawled</Chip>
  ) : null;

  const analysisName = analysis
    ? analysis.website_title || getHostname(analysis.url)
    : "Loading";

  async function toggleSaved() {
    if (!analysis || saving) return;
    setSaving(true);
    try {
      const result = analysis.is_saved
        ? await api.unsaveAnalysis(analysis.analysis_id)
        : await api.saveAnalysis(analysis.analysis_id);
      setAnalysis({ ...analysis, is_saved: result.is_saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update saved status.");
    } finally {
      setSaving(false);
    }
  }

  const headerActions = analysis ? (
    <div className="flex items-center gap-stack-sm">
      <button
        onClick={toggleSaved}
        disabled={saving}
        title={analysis.is_saved ? "Remove from Saved" : "Save Analysis"}
        aria-label={analysis.is_saved ? "Remove from Saved" : "Save Analysis"}
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          analysis.is_saved
            ? "border-[#6366F1] bg-[#6366F1] text-white"
            : "border-[#475569] text-[#CBD5E1] hover:border-[#A5B4FC] hover:text-white"
        }`}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: `"FILL" ${analysis.is_saved ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" 24` }}
        >
          bookmark
        </span>
      </button>
      {headerRight}
    </div>
  ) : null;

  return (
    <Shell
      analysisId={id}
      headerRight={headerActions}
      headerTitle={`Analysis: ${analysisName}`}
      contentClassName="bg-[#F1F5F9] text-[#0F172A]"
    >
      <div className="min-h-full max-w-[1200px] mx-auto px-gutter py-stack-lg">
        {error && <ErrorState message={error} />}
        {!analysis && !error && <Spinner label="Loading analysis..." className="text-[#64748B]" />}
        {analysis && <Outlet context={{ analysis } satisfies AnalysisContext} />}
      </div>
    </Shell>
  );
}