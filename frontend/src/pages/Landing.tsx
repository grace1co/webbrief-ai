import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Card, ErrorState, Icon, Shell, fieldClassName } from "../components/ui";

const CRAWL_STEPS = [
  "Validating URL",
  "Crawling website",
  "Extracting readable text",
  "Cleaning content",
  "Creating chunks",
  "Generating embeddings",
  "Indexing in Qdrant",
  "Creating website summary",
  "Generating website score",
  "Generating research brief",
  "Building dashboard",
];

// Map backend progress events to the loading checklist.
const STEP_MAP: Record<string, number> = {
  crawling: 1,
  cleaning: 2,
  chunking: 4,
  embedding: 5,
  indexing: 6,
  summarizing: 7,
  scoring: 8,
  reporting: 9,
  completing: 10,
};

const FEATURES = [
  { icon: "verified", title: "Source-Grounded Q&A", body: "Every answer cites the exact pages it came from." },
  { icon: "summarize", title: "Instant Summaries", body: "Summarize key information from crawled website content." },
  { icon: "article", title: "Research Briefs", body: "Generate structured reports based on cited website sources." },
  { icon: "fact_check", title: "Quality Scoring", body: "Score clarity, trust, pricing, and completeness." },
  { icon: "compare_arrows", title: "Competitor Comparison", body: "Put two sites side by side, evidence-first." },
  { icon: "history", title: "Analysis History", body: "Reopen recent analyses or bookmark important ones." },
];

const EXAMPLES = ["https://python.org", "https://mailchimp.com", "https://nasa.gov"];

function looksLikeWebsiteUrl(value: string) {
  const input = value.trim();
  if (!input || /\s/.test(input)) return false;

  try {
    const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const labels = parsed.hostname.split(".");
    const validLabels = labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );

    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      labels.length >= 2 &&
      labels[labels.length - 1].length >= 2 &&
      validLabels
    );
  } catch {
    return false;
  }
}

export default function Landing() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState<number | "">(5);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const canAnalyze =
    looksLikeWebsiteUrl(url) && maxPages !== "" && maxPages >= 1 && maxPages <= 25;

  async function analyze() {
    if (!canAnalyze) return;
    setError(null);
    setLoading(true);
    setStepIndex(0);

  try {
    const res = await api.analyzeUrlStream(url.trim(), maxPages, (step) => {
      const idx = STEP_MAP[step];
      if (idx !== undefined) setStepIndex(idx);
    });

    setStepIndex(CRAWL_STEPS.length - 1);
    navigate(`/analysis/${res.analysis_id}`);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Something went wrong.");
  } finally {
    setLoading(false);
  }
  }

  if (loading) {
    return (
      <Shell>
        <div className="max-w-xl mx-auto px-gutter py-stack-lg">
          <Card>
            <h2 className="text-h3 font-bold mb-stack-md">Analyzing {url}</h2>
            <ol className="flex flex-col gap-stack-sm">
              {CRAWL_STEPS.map((step, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                return (
                  <li key={step} className="flex items-center gap-stack-sm">
                    <span
                      className={`material-symbols-outlined ${
                        done ? "text-secondary" : active ? "text-primary animate-pulse" : "text-outline"
                      }`}
                    >
                      {done ? "check_circle" : active ? "progress_activity" : "radio_button_unchecked"}
                    </span>
                    <span
                      className={`text-body-sm ${
                        active ? "text-on-surface font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-[900px] mx-auto px-gutter py-stack-md flex flex-col gap-stack-lg">
        <section className="text-center pt-stack-md">
          <span className="text-label-caps uppercase text-[rgb(0_194_235)] dark:text-secondary">
            Source-Backed Website Analysis
          </span>
          <h1 className="text-[32px] sm:text-[34px] leading-tight tracking-[-0.02em] font-bold mt-stack-sm">
            Review website content with source-backed analysis
          </h1>
          <p className="text-body-lg text-slate-600 dark:text-on-surface-variant mt-stack-md max-w-2xl mx-auto">
            Paste a public website URL. WebBrief AI crawls the site, organizes the content, and
            helps answer questions, summarize key information, score website quality, and compare
            findings based on the website's own sources.
          </p>
        </section>

        <Card className="flex flex-col gap-stack-md">
          <label className="text-label-caps uppercase text-slate-500 dark:text-on-surface-variant">Website URL</label>
          <div className="flex flex-col sm:flex-row gap-stack-sm">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAnalyze) {
                  void analyze();
                }
              }}
              placeholder="https://example.com"
              className={`flex-1 rounded-lg px-stack-md py-stack-sm text-body-md font-[Geist] focus:outline-none focus:border-primary ${fieldClassName}`}
            />
            <Button
              onClick={analyze}
              disabled={!canAnalyze}
              className="bg-[#6366F1] text-white hover:bg-[#4F46E5] focus-visible:ring-[#6366F1]"
            >
              <Icon name="search" /> Analyze Website
            </Button>
          </div>
          <div className="flex items-end gap-stack-md flex-wrap">
            <label className="flex flex-col gap-stack-sm text-body-sm text-slate-500 dark:text-on-surface-variant">
              <span>Max pages to crawl</span>
              <input
                type="number"
                min={1}
                max={25}
                value={maxPages}
                onChange={(e) => setMaxPages(e.target.value === "" ? "" : Number(e.target.value))}
                className={`w-28 rounded px-stack-sm py-1 focus:outline-none focus:border-primary ${fieldClassName}`}
              />
            </label>
            <p className="text-body-sm text-slate-500 dark:text-on-surface-variant">
              More pages may improve source coverage, but can take longer to analyze.
            </p>
            <div className="flex items-center gap-stack-sm flex-wrap">
              <span className="text-body-sm text-slate-500 dark:text-on-surface-variant">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setUrl(ex)}
                  className="rounded-full border border-slate-300 bg-white px-stack-sm py-1 text-body-sm text-indigo-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:border-outline-variant dark:bg-surface-container-high dark:text-secondary dark:hover:border-secondary dark:hover:bg-surface-container-highest"
                >
                  {ex.replace("https://", "")}
                </button>
              ))}
            </div>
          </div>
          {error && <ErrorState message={error} />}
        </Card>

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex flex-col gap-stack-sm">
              <Icon name={f.icon} className="text-[rgb(0_194_235)] dark:text-secondary text-2xl" />
              <h3 className="text-body-md font-bold">{f.title}</h3>
              <p className="text-body-sm text-slate-500 dark:text-on-surface-variant">{f.body}</p>
            </Card>
          ))}
        </section>
      </div>
    </Shell>
  );
}
