import { useEffect, useState } from "react";
import { useAnalysis } from "./AnalysisLayout";
import { api, ApiError } from "../lib/api";
import type { GenerateReportResponse, ReportSection, ResearchBrief, SourcePage } from "../types";
import { Button, CopyButton, ErrorState, Icon, Spinner } from "../components/ui";

const NOT_FOUND = "Not found in the crawled website sources.";

// Use a neutral icon for section keys the frontend does not recognize.
const SECTION_ICON: Record<string, string> = {
  executive_summary: "description",
  products_services: "inventory_2",
  target_audience: "groups",
  pricing: "payments",
  trust_signals: "verified_user",
  strengths: "trending_up",
  weaknesses: "trending_down",
  missing_information: "help_center",
  final_recommendation: "recommend",
  key_resources: "link",
  documentation: "menu_book",
  downloads: "download",
  community_support: "people",
  developer_tools: "code",
  public_information: "public",
  programs_covered: "category",
  educational_resources: "school",
  source_authority: "verified",
  mission: "favorite",
  programs: "category",
  how_to_help: "volunteer_activism",
  courses_programs: "school",
  learning_resources: "auto_stories",
  faculty_research: "science",
};

function sectionIcon(key: string): string {
  return SECTION_ICON[key] ?? "article";
}

type LegacyBriefKey = Exclude<keyof ResearchBrief, "sections">;

// Older reports use fixed fields instead of dynamic sections.
const LEGACY_SECTIONS: Array<{
  key: LegacyBriefKey;
  label: string;
  tone?: "positive" | "negative" | "recommendation";
}> = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "products_services", label: "Products & Services or Key Offerings" },
  { key: "target_audience", label: "Target Audience" },
  { key: "pricing", label: "Pricing Information" },
  { key: "trust_signals", label: "Trust Signals" },
  { key: "strengths", label: "Strengths", tone: "positive" },
  { key: "weaknesses", label: "Weaknesses", tone: "negative" },
  { key: "missing_information", label: "Information Gaps" },
  { key: "final_recommendation", label: "Final Recommendation", tone: "recommendation" },
];

function valueOrFallback(value: string) {
  return value.trim() || NOT_FOUND;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function Brief() {
  const { analysis } = useAnalysis();
  const [response, setResponse] = useState<GenerateReportResponse | null>(null);
  const [sources, setSources] = useState<SourcePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  function getHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
  const title = analysis.website_title || getHostname(analysis.url);
  const brief = response?.report ?? null;

  // Prefer dynamic sections while keeping older stored reports readable.
  const activeSections: ReportSection[] = brief?.sections?.length
    ? brief.sections
    : LEGACY_SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        content: brief ? (brief[s.key] as string) ?? "" : "",
        tone: s.tone ?? "",
      }));

  useEffect(() => {
    api.getSources(analysis.analysis_id).then(setSources).catch(() => setSources([]));
  }, [analysis.analysis_id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getReport(analysis.analysis_id)
      .then((result) => {
      if (active) setResponse(result);
    })
      .catch((e) => {
        if (!active || (e instanceof ApiError && e.status === 404)) return;
        setError(e instanceof Error ? e.message : "Failed to load research brief.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [analysis.analysis_id]);

  async function generate() {
    setError(null);
    setLoading(true);
    try {
      setResponse(await api.generateReport(analysis.analysis_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function exportMarkdown() {
    if (!brief) return;
    const md =
      `# Research Brief: ${title}\n\n` +
      activeSections
        .map((s) => `## ${s.label}\n${valueOrFallback(s.content)}\n`)
        .join("\n") +
      `\n## Sources Used\n${
        sources
          .map((s, i) => `${i + 1}. [${s.page_title || s.page_url}](${s.page_url})`)
          .join("\n") || NOT_FOUND
      }\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "research-brief.md";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function printBrief() {
    if (!brief) return;
    const sectionsHtml = activeSections
      .map(
        (s) =>
          `<section><h2>${escapeHtml(s.label)}</h2><p>${escapeHtml(
            valueOrFallback(s.content),
          ).replace(/\n/g, "<br>")}</p></section>`,
      )
      .join("");
    const sourcesHtml =
      sources
        .map(
          (s, i) =>
            `<li><a href="${escapeHtml(s.page_url)}">[${i + 1}] ${escapeHtml(
              s.page_title || s.page_url,
            )}</a></li>`,
        )
        .join("") || `<li>${NOT_FOUND}</li>`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(title)} Research Brief</title>
<style>
body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;color:#172033;line-height:1.65}
header{border-bottom:1px solid #dbe3ec;padding-bottom:20px;margin-bottom:28px}h1{font-size:28px;margin:0 0 8px}
.meta{color:#64748b;font-size:13px}section{border:1px solid #dbe3ec;border-radius:12px;padding:20px;margin:0 0 18px;break-inside:avoid}
h2{font-size:17px;margin:0 0 10px;color:#0891b2}p{margin:0;white-space:pre-line}a{color:#0369a1}li{margin-bottom:8px}
</style></head><body><header><h1>Research Brief: ${escapeHtml(title)}</h1>
<div class="meta">Generated from ${sources.length} crawled website source${sources.length === 1 ? "" : "s"}.</div></header>
${sectionsHtml}<section><h2>Sources Used</h2><ol>${sourcesHtml}</ol></section></body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }

  const fullText = brief
    ? activeSections.map((s) => `${s.label}\n${valueOrFallback(s.content)}`).join("\n\n")
    : "";

  const markdownText = brief
    ? `# Research Report: ${title}\n\n${activeSections
        .map((s) => `## ${s.label}\n${valueOrFallback(s.content)}`)
        .join("\n\n")}`
    : "";

  function copyText(value: string, label: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(null), 2000);
    });
  }

  async function shareBrief() {
    if (!brief) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Research Brief: ${title}`, text: fullText });
        setShareStatus("Shared");
      } else {
        await navigator.clipboard.writeText(fullText);
        setShareStatus("Copied to clipboard");
      }
      setTimeout(() => setShareStatus(null), 2500);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setShareStatus("Unable to share");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#DCE4EC] bg-[#F4F7FA] text-[#172033] shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-stack-md border-b border-[#DCE4EC] bg-white px-gutter py-stack-md">
        <div className="flex min-w-0 items-center gap-stack-sm">
          <Icon name="article" className="text-[#06B6D4]" />
          <h1 className="truncate text-body-lg font-bold">Research Report: {title}</h1>
          {response?.website_type && (
            <span className="shrink-0 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-stack-sm py-0.5 text-label-caps uppercase text-[#6366F1]">
              {response.website_type}
            </span>
          )}
        </div>
        <Button
          onClick={generate}
          disabled={loading}
          className="shrink-0 bg-[#6366F1] text-white hover:bg-[#4F46E5]"
        >
          <Icon name={brief ? "refresh" : "article"} />
          {brief ? "Regenerate Brief" : "Generate Brief"}
        </Button>
      </div>

      <div className="px-gutter py-stack-lg sm:px-stack-lg">
        {error && <ErrorState message={error} />}

        {loading && (
          <div className="rounded-xl border border-[#DCE4EC] bg-white p-stack-lg">
            <Spinner label="Generating research brief..." className="text-[#64748B]" />
          </div>
        )}

        {!brief && !loading && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[#CBD5E1] bg-white px-gutter py-16 text-center">
            <span className="mb-stack-md flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFEFF] text-[#0891B2]">
              <Icon name="description" className="text-2xl" />
            </span>
            <h2 className="text-h3 font-bold">Create a source-backed research brief</h2>
            <p className="mt-stack-sm max-w-lg text-body-md text-[#64748B]">
              The report will use only the content collected from {analysis.pages_crawled} crawled
              page{analysis.pages_crawled === 1 ? "" : "s"} and will mark unsupported information
              as not found.
            </p>
          </div>
        )}

        {brief && (
          <div className="flex flex-col gap-stack-lg">
            <div className="flex flex-wrap items-center justify-between gap-stack-sm rounded-lg border border-[#CFFAFE] bg-[#ECFEFF] px-stack-md py-stack-sm text-body-sm text-[#155E75]">
              <span className="flex items-center gap-stack-sm">
                <Icon name="verified" /> Based only on {sources.length || analysis.pages_crawled}
                {" "}crawled website source{(sources.length || analysis.pages_crawled) === 1 ? "" : "s"}
              </span>
              <CopyButton text={fullText} className="text-[#0E7490] hover:text-[#164E63]" />
            </div>

            {activeSections.map((section) => (
              <div key={section.key} className="flex flex-col gap-stack-lg">
                <ReportSectionCard
                  icon={sectionIcon(section.key)}
                  label={section.label}
                  value={valueOrFallback(section.content)}
                  tone={section.tone as "positive" | "negative" | "recommendation" | undefined}
                />
                {section.key === "executive_summary" && analysis.key_topics.length > 0 && (
                  <div>
                    <SectionHeading icon="topic" label="Key Topics" />
                    <div className="flex flex-wrap gap-stack-sm rounded-xl border border-[#DCE4EC] bg-white p-gutter shadow-sm">
                      {analysis.key_topics.map((topic) => (
                        <span
                          key={topic}
                          className="rounded-full border border-[#CFFAFE] bg-[#ECFEFF] px-stack-sm py-1 text-body-sm text-[#0E7490]"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <section>
              <SectionHeading icon="menu_book" label="Sources Used" />
              <div className="overflow-hidden rounded-xl border border-[#DCE4EC] bg-white shadow-sm">
                {sources.length > 0 ? (
                  sources.map((source, index) => (
                    <a
                      key={source.id}
                      href={source.page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-stack-md border-b border-[#E8EDF2] px-stack-md py-stack-md last:border-b-0 hover:bg-[#F8FAFC]"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ECFEFF] text-body-sm font-bold text-[#0891B2]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body-sm font-bold text-[#172033]">
                          {source.page_title || source.page_url}
                        </span>
                        <span className="block truncate text-mono-data text-[#64748B]">
                          {source.page_url}
                        </span>
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="p-stack-md text-body-md text-[#64748B]">{NOT_FOUND}</p>
                )}
              </div>
            </section>

            <div className="border-t border-[#DCE4EC] pt-stack-lg">
              <div className="grid gap-stack-sm sm:grid-cols-3">
                <button
                  onClick={printBrief}
                  className="inline-flex items-center justify-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-md text-body-sm font-bold text-white transition-colors hover:bg-[#4F46E5]"
                >
                  <Icon name="picture_as_pdf" /> Export Report PDF
                </button>
                <button
                  onClick={exportMarkdown}
                  className="inline-flex items-center justify-center gap-stack-sm rounded-lg border border-[#CBD5E1] bg-white px-gutter py-stack-md text-body-sm font-bold text-[#172033] hover:bg-[#F8FAFC]"
                >
                  <Icon name="download" /> Download Markdown
                </button>
                <button
                  onClick={() => copyText(markdownText, "Markdown copied")}
                  className="inline-flex items-center justify-center gap-stack-sm rounded-lg border border-[#CBD5E1] bg-white px-gutter py-stack-md text-body-sm font-bold text-[#172033] hover:bg-[#F8FAFC]"
                >
                  <Icon name="markdown" /> {copyStatus || "Copy Markdown"}
                </button>
              </div>
              <div className="mt-stack-sm grid gap-stack-sm sm:grid-cols-2">
                <button
                  onClick={() => copyText(fullText, "Report copied")}
                  className="inline-flex items-center justify-center gap-stack-sm rounded-lg border border-[#CBD5E1] bg-white px-gutter py-stack-md text-body-sm font-bold text-[#172033] hover:bg-[#F8FAFC]"
                >
                  <Icon name="content_copy" /> Copy Report
                </button>
                <button
                  onClick={shareBrief}
                  className="inline-flex items-center justify-center gap-stack-sm rounded-lg border border-[#CBD5E1] bg-white px-gutter py-stack-md text-body-sm font-bold text-[#172033] hover:bg-[#F8FAFC]"
                >
                  <Icon name="share" /> {shareStatus || "Share Analysis"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="mb-stack-sm flex items-center gap-stack-sm">
      <Icon name={icon} className="text-[#06B6D4]" />
      <h2 className="text-body-lg font-bold text-[#172033]">{label}</h2>
    </div>
  );
}

function ReportSectionCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "positive" | "negative" | "recommendation";
}) {
  const accent =
    tone === "positive"
      ? "border-l-[#10B981]"
      : tone === "negative"
        ? "border-l-[#F87171]"
        : tone === "recommendation"
          ? "border-l-[#6366F1]"
          : "border-l-[#DCE4EC]";

  return (
    <section>
      <SectionHeading icon={icon} label={label} />
      <div className={`rounded-xl border border-[#DCE4EC] border-l-4 ${accent} bg-white p-gutter shadow-sm`}>
        <div className="mb-stack-sm flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0891B2]">
          <Icon name="link" className="text-sm" /> Crawled Sources
        </div>
        <p className="whitespace-pre-line text-body-md leading-7 text-[#334155]">{value}</p>
      </div>
    </section>
  );
}
