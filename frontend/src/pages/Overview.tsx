import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalysis } from "./AnalysisLayout";
import { api } from "../lib/api";
import type { SourcePage } from "../types";
import { ErrorState, Icon } from "../components/ui";

const FALLBACK_QUESTIONS = [
  "What does this website provide?",
  "What information is available from the crawled pages?",
  "What information appears to be missing?",
  "What are the main topics covered?",
];

interface ActionDef {
  icon: string;
  label: string;
  action: () => void;
}

export default function Overview() {
  const { analysis } = useAnalysis();
  const navigate = useNavigate();
  const [sources, setSources] = useState<SourcePage[]>([]);
  const [question, setQuestion] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSources(analysis.analysis_id).then(setSources).catch(() => setSources([]));
  }, [analysis.analysis_id]);

  async function reanalyze() {
    setReanalyzing(true);
    setError(null);
    try {
      const result = await api.analyzeUrlStream(analysis.url, 10, () => {});
      navigate(`/analysis/${result.analysis_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-analysis failed.");
      setReanalyzing(false);
    }
  }

  function ask(value: string) {
    const query = value.trim();
    if (query) navigate(`ask?q=${encodeURIComponent(query)}`);
  }

  const title = analysis.website_title || new URL(analysis.url).hostname;
  const suggested = (
    analysis.suggested_questions.length ? analysis.suggested_questions : FALLBACK_QUESTIONS
  ).slice(0, 5);

  const sourceCoverage = sources.length
    ? Math.round(
        (sources.filter((s) => s.crawl_status === "ok").length / sources.length) * 100,
      )
    : analysis.pages_crawled > 0
      ? 100
      : 0;

  const actions = buildActions(analysis.website_type, analysis.has_pricing, navigate, ask);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex items-start justify-between gap-stack-md flex-wrap">
        <div>
          <span className="text-label-caps uppercase text-[#6366F1]">Website Overview</span>
          <h1 className="mt-1 text-[30px] leading-tight font-bold text-[#0F172A]">{title}</h1>
          <a
            href={analysis.url}
            target="_blank"
            rel="noreferrer"
            className="text-body-sm text-[#64748B] hover:text-[#4F46E5]"
          >
            {analysis.url}
          </a>
        </div>
        <button
          onClick={reanalyze}
          disabled={reanalyzing}
          className="inline-flex items-center gap-stack-sm rounded-lg border border-[#CBD5E1] bg-white px-stack-md py-stack-sm text-body-sm font-bold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"
        >
          <Icon
            name={reanalyzing ? "progress_activity" : "refresh"}
            className={reanalyzing ? "animate-spin" : ""}
          />
          {reanalyzing ? "Re-analyzing..." : "Analyze Again"}
        </button>
      </div>

      {error && <ErrorState message={error} />}

      <div className="grid gap-stack-sm sm:grid-cols-3">
        <Stat value={analysis.pages_crawled} label="Pages Crawled" />
        <Stat value={analysis.chunks_indexed} label="Chunks Indexed" />
        <Stat value={`${sourceCoverage}%`} label="Source Coverage" accent />
      </div>

      <section className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
        <div className="mb-stack-sm flex items-center gap-stack-sm">
          <Icon name="summarize" className="text-[#06B6D4]" />
          <h2 className="text-body-lg font-bold">Source-Backed Summary</h2>
        </div>
        <p className="whitespace-pre-line text-body-md leading-7 text-[#475569]">
          {analysis.summary || "A summary was not available from the crawled sources."}
        </p>
        {analysis.key_topics.length > 0 && (
          <div className="mt-stack-md">
            <span className="mb-stack-sm block text-label-caps uppercase text-[#64748B]">
              Key Topics
            </span>
            <div className="flex flex-wrap gap-stack-sm">
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
      </section>

      <section>
        <h2 className="mb-stack-sm text-body-md font-bold text-[#334155]">Analysis Actions</h2>
        <div className="grid gap-stack-sm sm:grid-cols-2">
          {actions.primary.map((a) => (
            <Action key={a.label} icon={a.icon} label={a.label} onClick={a.action} />
          ))}
        </div>
        {actions.cta && (
          <button
            onClick={actions.cta.action}
            className="mt-stack-sm flex w-full items-center justify-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-md text-body-sm font-bold text-white hover:bg-[#4F46E5]"
          >
            <Icon name={actions.cta.icon} /> {actions.cta.label}
          </button>
        )}
      </section>

      <section>
        <div className="mb-stack-sm flex items-center justify-between">
          <h2 className="text-body-md font-bold text-[#334155]">Top Sources</h2>
          <button
            onClick={() => navigate("sources")}
            className="text-body-sm font-bold text-[#6366F1] hover:text-[#4F46E5]"
          >
            View All
          </button>
        </div>
        <div className="grid gap-stack-sm md:grid-cols-3">
          {sources.slice(0, 3).map((source) => (
            <button
              key={source.id}
              onClick={() => navigate("sources")}
              className="rounded-xl border border-[#E2E8F0] bg-white p-stack-md text-left shadow-sm hover:border-[#A5B4FC]"
            >
              <div className="mb-stack-sm flex items-center gap-stack-sm text-[#0891B2]">
                <Icon name="description" />
                <span className="truncate text-mono-data">
                  {new URL(source.page_url).pathname || "/"}
                </span>
              </div>
              <h3 className="line-clamp-2 text-body-md font-bold">
                {source.page_title || source.page_url}
              </h3>
              {source.preview && source.preview.length > 10 && (
                <p className="mt-1 line-clamp-3 text-body-sm text-[#64748B]">{source.preview}</p>
              )}
            </button>
          ))}
          {sources.length === 0 && (
            <p className="text-body-sm text-[#64748B]">No source previews are available.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-stack-sm text-body-md font-bold text-[#334155]">Find Answers</h2>
        <div className="flex flex-col gap-stack-sm">
          {suggested.map((item) => (
            <button
              key={item}
              onClick={() => ask(item)}
              className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-white px-stack-md py-stack-sm text-left text-body-sm hover:border-[#A5B4FC]"
            >
              <span>{item}</span>
              <Icon name="north_east" className="text-base text-[#6366F1]" />
            </button>
          ))}
        </div>
        <div className="mt-stack-md flex overflow-hidden rounded-full border border-[#C7D2FE] bg-white focus-within:ring-2 focus-within:ring-[#A5B4FC]">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="Ask a custom question..."
            className="min-w-0 flex-1 bg-transparent px-stack-md py-stack-sm text-body-md outline-none placeholder:text-[#94A3B8]"
          />
          <button
            onClick={() => ask(question)}
            disabled={!question.trim()}
            className="m-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#6366F1] text-white disabled:opacity-40"
          >
            <Icon name="send" />
          </button>
        </div>
      </section>
    </div>
  );
}

function buildActions(
  websiteType: string,
  hasPricing: boolean,
  navigate: (to: string) => void,
  ask: (q: string) => void,
): { primary: ActionDef[]; cta: ActionDef | null } {
  const summarize: ActionDef = {
    icon: "summarize",
    label: "Summarize",
    action: () => ask("Summarize the main information on this website."),
  };
  const generateReport: ActionDef = {
    icon: "article",
    label: "Generate Report",
    action: () => navigate("brief"),
  };
  const askWebsite: ActionDef = {
    icon: "chat_bubble",
    label: "Find Answers",
    action: () => navigate("ask"),
  };
  const compareCta: ActionDef = {
    icon: "compare_arrows",
    label: "Compare with Another Website",
    action: () => navigate("compare"),
  };

  const findPricing: ActionDef = {
    icon: "payments",
    label: "Find Pricing",
    action: () => ask("What pricing information is available on this website?"),
  };

  const typeActions: Record<string, ActionDef> = {
    documentation: {
      icon: "menu_book",
      label: "View Documentation",
      action: () => ask("What documentation and guides are available on this website?"),
    },
    government: {
      icon: "public",
      label: "Find Public Resources",
      action: () => ask("What public resources and programs are available on this website?"),
    },
    educational: {
      icon: "school",
      label: "Explore Programs",
      action: () => ask("What programs, courses, or learning resources are available?"),
    },
    nonprofit: {
      icon: "volunteer_activism",
      label: "Learn About Programs",
      action: () => ask("What programs and initiatives does this organization offer?"),
    },
    community: {
      icon: "people",
      label: "Find Community Resources",
      action: () => ask("What community resources and support are available?"),
    },
    commercial: {
      icon: "inventory_2",
      label: "Find Features",
      action: () => ask("What products, features, or services does this website offer?"),
    },
  };

  // Keep the action grid stable across website types.
  const primary: ActionDef[] = [summarize];

  const typeAction = typeActions[websiteType];
  if (typeAction) primary.push(typeAction);

  // Do not offer pricing research unless the crawled content indicates pricing exists.
  if (hasPricing) primary.push(findPricing);

  primary.push(generateReport);

  if (primary.length < 4) primary.push(askWebsite);
  const trimmed = primary.slice(0, 4);

  return { primary: trimmed, cta: compareCta };
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-stack-md text-center shadow-sm ${
        accent ? "border-[#C7D2FE] bg-[#EEF2FF]" : "border-[#E2E8F0]"
      }`}
    >
      <div className={`text-h3 font-bold ${accent ? "text-[#6366F1]" : "text-[#0F172A]"}`}>
        {value}
      </div>
      <div className="mt-1 text-label-caps uppercase text-[#475569]">{label}</div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-stack-md rounded-xl border border-[#E2E8F0] bg-white px-stack-md py-stack-md text-left shadow-sm hover:border-[#A5B4FC]"
    >
      <Icon name={icon} className="text-[#6366F1]" />
      <span className="text-body-md font-bold">{label}</span>
    </button>
  );
}
