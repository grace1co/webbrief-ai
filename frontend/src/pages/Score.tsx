import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useAnalysis } from "./AnalysisLayout";
import { api, ApiError } from "../lib/api";
import type { DynamicScoreDimension, ScoreResponse } from "../types";
import { ErrorState, Icon, Spinner } from "../components/ui";

const NOT_FOUND = "Not found in the crawled website sources.";

function scoreBarColor(score: number): string {
  if (score >= 7) return "bg-[#06B6D4]";
  if (score >= 4) return "bg-[#F59E0B]";
  return "bg-[#EF4444]";
}

function scoreTextColor(score: number): string {
  if (score >= 7) return "text-[#0891B2]";
  if (score >= 4) return "text-[#B45309]";
  return "text-[#DC2626]";
}

function clampScore(score: number): number {
  return Math.min(10, Math.max(0, score));
}

export default function Score() {
  const { analysis } = useAnalysis();
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getScore(analysis.analysis_id)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (!active || (e instanceof ApiError && e.status === 404)) return;
        setError(e instanceof Error ? e.message : "Failed to load website score.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysis.analysis_id]);

  useEffect(() => {
    if (data) {
      setAnimated(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    }
  }, [data]);

  async function run() {
    setError(null);
    setLoading(true);
    setAnimated(false);
    try {
      setData(await api.scoreWebsite(analysis.analysis_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed.");
    } finally {
      setLoading(false);
    }
  }

  // Older score records use the fixed score map instead of dynamic dimensions.
  const dimensions: DynamicScoreDimension[] = data
    ? data.dimensions.length > 0
      ? data.dimensions
      : Object.entries(data.scores).map(([key, item]) => ({
          key,
          label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          score: item.score,
          explanation: item.explanation,
        }))
    : [];

  const radarData = dimensions.map((dim) => ({
    subject: dim.label,
    score: dim.score,
    fullMark: 10,
  }));

  return (
    <div className="flex flex-col gap-stack-md">
      <div className="flex items-center justify-between flex-wrap gap-stack-sm">
        <div>
          <span className="text-label-caps uppercase text-[#6366F1]">Quality Score</span>
          <h1 className="text-h2 font-bold mt-1">Source-Backed Quality Assessment</h1>
          <p className="text-body-sm text-[#64748B]">
            Scores reflect the crawled content for{" "}
            {analysis.website_title || analysis.url}.
            {data?.website_type && (
              <span className="ml-stack-sm rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-stack-sm py-0.5 text-label-caps uppercase text-[#6366F1]">
                {data.website_type}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-sm text-body-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40"
        >
          <Icon name="fact_check" /> {data ? "Regenerate Score" : "Generate Score"}
        </button>
      </div>

      {error && <ErrorState message={error} />}

      {loading && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
          <Spinner label="Generating website score..." className="text-[#64748B]" />
        </div>
      )}

      {!data && !loading && (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-stack-lg text-center">
          <Icon name="fact_check" className="mb-stack-sm text-3xl text-[#06B6D4]" />
          <h2 className="text-body-lg font-bold">
            {error
              ? "Website score could not be generated"
              : "Website score has not been generated yet."}
          </h2>
          <p className="mt-stack-sm text-body-sm text-[#64748B]">
            Generate a source-backed quality assessment using the crawled pages.
          </p>
        </div>
      )}

      {data && dimensions.length > 0 && (
        <>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
            <h2 className="text-body-md font-bold mb-stack-md">Score Overview</h2>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#CBD5E1" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#475569", fontSize: 11 }}
                />
                <Radar
                  dataKey="score"
                  stroke="#06B6D4"
                  fill="#06B6D4"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ color: "#0F172A" }}
                  formatter={(value) => [`${value ?? 0}/10`, "Score"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid sm:grid-cols-2 gap-gutter">
            {dimensions.map((dim) => {
              const safeScore = clampScore(dim.score);
              return (
                <div
                  key={dim.key}
                  className="flex flex-col gap-stack-sm rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-body-md font-bold">{dim.label}</span>
                    <span className={`text-h3 font-bold ${scoreTextColor(safeScore)}`}>
                      {safeScore}/10
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${scoreBarColor(safeScore)}`}
                      style={{ width: animated ? `${safeScore * 10}%` : "0%" }}
                    />
                  </div>
                  <p className="text-body-sm text-[#64748B]">
                    {dim.explanation || NOT_FOUND}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}