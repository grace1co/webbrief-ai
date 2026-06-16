import { useState } from "react";
import { useAnalysis } from "./AnalysisLayout";
import { api } from "../lib/api";
import type { CompareResponse, ComparisonSite } from "../types";
import { ErrorState, Icon, Spinner, fieldClassName } from "../components/ui";

const NOT_FOUND = "Not found in the crawled website sources.";
const MAX_SITES = 5;

export default function Compare() {
  const { analysis } = useAnalysis();
  const [competitorUrls, setCompetitorUrls] = useState([""]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCompetitors = competitorUrls.map((url) => url.trim()).filter(Boolean);
  const totalSites = 1 + filledCompetitors.length;

  function updateCompetitor(index: number, value: string) {
    setCompetitorUrls((current) => current.map((url, i) => (i === index ? value : url)));
  }

  function addCompetitor() {
    if (competitorUrls.length >= MAX_SITES - 1) return;
    setCompetitorUrls((current) => [...current, ""]);
  }

  function removeCompetitor(index: number) {
    setCompetitorUrls((current) => current.filter((_, i) => i !== index));
  }

  async function run() {
    if (filledCompetitors.length < 1 || loading) return;
    setError(null);
    setLoading(true);
    try {
      setResult(
        await api.compareWebsites({
          sites: [
            {
              analysis_id: analysis.analysis_id,
              label: analysis.website_title || analysis.url,
            },
            ...filledCompetitors.map((url, index) => ({
              url,
              label: `Competitor ${index + 1}`,
            })),
          ],
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  const sites = getSites(result);

  return (
    <div className="flex flex-col gap-stack-md">
      <div>
        <span className="text-label-caps uppercase text-[#6366F1]">Website Comparison</span>
        <h1 className="mt-1 text-h2 font-bold">Compare up to 5 Websites</h1>
        <p className="text-body-sm text-[#64748B]">
          Compare only the information supported by each website's crawled sources.
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
        <div className="flex flex-col gap-stack-md">
          <SiteInput label="Current Website" value={analysis.website_title || analysis.url} locked />
          {competitorUrls.map((url, index) => (
            <div key={index} className="flex items-end gap-stack-sm">
              <div className="flex-1">
                <SiteInput
                  label={`Competitor Website ${index + 1}`}
                  value={url}
                  onChange={(value) => updateCompetitor(index, value)}
                />
              </div>
              {competitorUrls.length > 1 && (
                <button
                  onClick={() => removeCompetitor(index)}
                  className="mb-[1px] rounded-lg border border-[#CBD5E1] px-stack-sm py-stack-sm text-[#64748B] hover:border-[#EF4444] hover:text-[#EF4444]"
                  aria-label={`Remove competitor ${index + 1}`}
                  title={`Remove competitor ${index + 1}`}
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-stack-md flex flex-col gap-stack-sm sm:flex-row">
          <button
            onClick={addCompetitor}
            disabled={competitorUrls.length >= MAX_SITES - 1}
            className="inline-flex items-center justify-center gap-stack-sm rounded-lg border border-[#CBD5E1] px-gutter py-stack-sm text-body-sm font-bold text-[#475569] hover:border-[#6366F1] hover:text-[#6366F1] disabled:opacity-40"
          >
            <Icon name="add" /> Add Site
          </button>
          <button
            onClick={run}
            disabled={filledCompetitors.length < 1 || loading}
            className="flex flex-1 items-center justify-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-sm text-body-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40"
          >
            <Icon name="compare_arrows" /> Compare {totalSites} Websites
          </button>
        </div>
        <p className="mt-stack-sm text-body-sm text-[#64748B]">
          Competitor websites will be crawled before comparison. You can compare 2 to 5 sites total.
        </p>
      </div>

      {error && <ErrorState message={error} />}
      {loading && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter">
          <Spinner label="Crawling and comparing websites..." />
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-stack-md">
          {sites.length > 0 && (
            <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-3">
              {sites.map((site) => (
                <SiteSummaryCard key={site.site_key} site={site} />
              ))}
            </div>
          )}

          {result.dimensions.length > 0 ? (
            result.dimensions.map((dim) => (
              <ComparisonGrid
                key={dim.key}
                title={dim.label}
                sites={sites}
                values={dim.values?.length ? dim.values : [
                  { site_key: "site_1", finding: dim.site_a },
                  { site_key: "site_2", finding: dim.site_b },
                ]}
              />
            ))
          ) : (
            <>
              {result.product_service_comparison && (
                <ComparisonField title="Offerings" value={result.product_service_comparison} />
              )}
              {result.pricing_comparison && (
                <ComparisonField title="Pricing" value={result.pricing_comparison} />
              )}
              {result.trust_comparison && (
                <ComparisonField title="Trust Signals" value={result.trust_comparison} />
              )}
              {result.clarity_comparison && (
                <ComparisonField title="Content Completeness" value={result.clarity_comparison} />
              )}
            </>
          )}

          {result.similarities.length > 0 && (
            <ListSection title="Similarities" icon="check_circle" iconClassName="text-[#10B981]" items={result.similarities} />
          )}

          {result.differences.length > 0 && (
            <ListSection title="Key Differences" icon="compare" iconClassName="text-[#F59E0B]" items={result.differences} />
          )}

          <div className="rounded-xl border border-[#C7D2FE] bg-white p-gutter shadow-sm">
            <div className="mb-stack-sm flex items-center gap-stack-sm">
              <Icon name="summarize" className="text-[#06B6D4]" />
              <h2 className="text-body-lg font-bold">Final Comparison Notes</h2>
            </div>
            <p className="whitespace-pre-line text-body-md text-[#475569]">
              {result.final_summary || NOT_FOUND}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getSites(result: CompareResponse | null): ComparisonSite[] {
  if (!result) return [];
  if (result.sites?.length) return result.sites;
  return [
    {
      site_key: "site_1",
      label: "Current Website",
      summary: result.website_a_summary,
      website_type: result.website_a_type,
      has_pricing: result.has_pricing_a,
    },
    {
      site_key: "site_2",
      label: "Competitor Website",
      summary: result.website_b_summary,
      website_type: result.website_b_type,
      has_pricing: result.has_pricing_b,
    },
  ];
}

function SiteInput({
  label,
  value,
  locked,
  onChange,
}: {
  label: string;
  value: string;
  locked?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-label-caps uppercase text-[#64748B]">{label}</span>
      <input
        value={value}
        readOnly={locked}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="https://competitor.com"
        className={`mt-stack-sm w-full rounded-lg px-stack-md py-stack-sm text-body-md outline-none focus:border-[#6366F1] ${
          locked ? "bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1]" : fieldClassName
        }`}
      />
    </label>
  );
}

function SiteSummaryCard({ site }: { site: ComparisonSite }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
      <span className="text-label-caps uppercase text-[#6366F1]">{site.label}</span>
      {site.website_type && (
        <span className="ml-stack-sm rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-stack-sm py-0.5 text-label-caps uppercase text-[#6366F1]">
          {site.website_type}
        </span>
      )}
      <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
        {site.summary || NOT_FOUND}
      </p>
    </div>
  );
}

function ComparisonGrid({
  title,
  sites,
  values,
}: {
  title: string;
  sites: ComparisonSite[];
  values: { site_key: string; finding: string }[];
}) {
  return (
    <section>
      <div className="mb-stack-sm flex items-center gap-stack-sm">
        <Icon name="compare_arrows" className="text-[#06B6D4]" />
        <h2 className="text-body-lg font-bold">{title}</h2>
      </div>
      <div className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site, index) => {
          const value = values.find((entry) => entry.site_key === site.site_key)?.finding;
          return (
            <div key={site.site_key} className={`p-gutter ${index > 0 ? "border-t border-[#E2E8F0] md:border-l md:border-t-0" : ""}`}>
              <span className="text-label-caps uppercase text-[#6366F1]">{site.label}</span>
              <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
                {value || NOT_FOUND}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComparisonField({ title, value }: { title: string; value?: string }) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
      <div className="mb-stack-sm flex items-center gap-stack-sm">
        <Icon name="fact_check" className="text-[#06B6D4]" />
        <h2 className="text-body-lg font-bold">{title}</h2>
      </div>
      <p className="whitespace-pre-line text-body-sm text-[#475569]">{value || NOT_FOUND}</p>
    </section>
  );
}

function ListSection({
  title,
  icon,
  iconClassName,
  items,
}: {
  title: string;
  icon: string;
  iconClassName: string;
  items: string[];
}) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
      <div className="mb-stack-sm flex items-center gap-stack-sm">
        <Icon name={icon} className={iconClassName} />
        <h2 className="text-body-lg font-bold">{title}</h2>
      </div>
      <ul className="flex flex-col gap-stack-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-stack-sm text-body-sm text-[#475569]">
            <Icon name="fiber_manual_record" className={`mt-1 text-[10px] shrink-0 ${iconClassName}`} />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
