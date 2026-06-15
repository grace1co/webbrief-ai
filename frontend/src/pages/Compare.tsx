import { useState } from "react";
import { useAnalysis } from "./AnalysisLayout";
import { api } from "../lib/api";
import type { CompareResponse } from "../types";
import { ErrorState, Icon, Spinner } from "../components/ui";

const NOT_FOUND = "Not found in the crawled website sources.";

export default function Compare() {
  const { analysis } = useAnalysis();
  const [otherUrl, setOtherUrl] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!otherUrl.trim()) return;
    setError(null);
    setLoading(true);
    try {
      setResult(
        await api.compareWebsites({
          analysis_id_a: analysis.analysis_id,
          url_b: otherUrl.trim(),
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <div>
        <span className="text-label-caps uppercase text-[#6366F1]">Website Comparison</span>
        <h1 className="mt-1 text-h2 font-bold">Compare with Another Website</h1>
        <p className="text-body-sm text-[#64748B]">
          Compare only the information supported by each website's crawled sources.
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
        <div className="grid gap-gutter sm:grid-cols-2">
          <SiteInput label="Current Website" value={analysis.website_title || analysis.url} locked />
          <SiteInput label="Competitor Website" value={otherUrl} onChange={setOtherUrl} />
        </div>
        <button
          onClick={run}
          disabled={!otherUrl.trim() || loading}
          className="mt-stack-md flex w-full items-center justify-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-md text-body-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40"
        >
          <Icon name="compare_arrows" /> Compare Websites
        </button>
        <p className="mt-stack-sm text-body-sm text-[#64748B]">
          The competitor website will be crawled before comparison.
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
          {(result.website_a_type || result.website_b_type) && (
            <div className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm sm:grid-cols-2">
              <div className="border-b border-[#E2E8F0] p-gutter sm:border-b-0 sm:border-r">
                <span className="text-label-caps uppercase text-[#6366F1]">Current Website</span>
                {result.website_a_type && (
                  <span className="ml-stack-sm rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-stack-sm py-0.5 text-label-caps uppercase text-[#6366F1]">
                    {result.website_a_type}
                  </span>
                )}
                <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
                  {result.website_a_summary || NOT_FOUND}
                </p>
              </div>
              <div className="p-gutter">
                <span className="text-label-caps uppercase text-[#6366F1]">Competitor Website</span>
                {result.website_b_type && (
                  <span className="ml-stack-sm rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-stack-sm py-0.5 text-label-caps uppercase text-[#6366F1]">
                    {result.website_b_type}
                  </span>
                )}
                <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
                  {result.website_b_summary || NOT_FOUND}
                </p>
              </div>
            </div>
          )}

          {result.dimensions.length > 0 ? (
            result.dimensions.map((dim) => (
              <ComparisonRow
                key={dim.key}
                title={dim.label}
                left={dim.site_a}
                right={dim.site_b}
              />
            ))
          ) : (
            /* Older comparison records use fixed fields instead of dimensions. */
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
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
              <div className="mb-stack-sm flex items-center gap-stack-sm">
                <Icon name="check_circle" className="text-[#10B981]" />
                <h2 className="text-body-lg font-bold">Similarities</h2>
              </div>
              <ul className="flex flex-col gap-stack-sm">
                {result.similarities.map((item, i) => (
                  <li key={i} className="flex items-start gap-stack-sm text-body-sm text-[#475569]">
                    <Icon name="fiber_manual_record" className="mt-1 text-[10px] text-[#10B981] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.differences.length > 0 && (
            <section className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
              <div className="mb-stack-sm flex items-center gap-stack-sm">
                <Icon name="compare" className="text-[#F59E0B]" />
                <h2 className="text-body-lg font-bold">Key Differences</h2>
              </div>
              <ul className="flex flex-col gap-stack-sm">
                {result.differences.map((item, i) => (
                  <li key={i} className="flex items-start gap-stack-sm text-body-sm text-[#475569]">
                    <Icon name="fiber_manual_record" className="mt-1 text-[10px] text-[#F59E0B] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
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
        className={`mt-stack-sm w-full rounded-lg border border-[#CBD5E1] px-stack-md py-stack-sm text-body-md outline-none focus:border-[#6366F1] ${
          locked ? "bg-[#F8FAFC] text-[#475569]" : "bg-white"
        }`}
      />
    </label>
  );
}

function ComparisonRow({
  title,
  left,
  right,
}: {
  title: string;
  left?: string;
  right?: string;
}) {
  return (
    <section>
      <div className="mb-stack-sm flex items-center gap-stack-sm">
        <Icon name="compare_arrows" className="text-[#06B6D4]" />
        <h2 className="text-body-lg font-bold">{title}</h2>
      </div>
      <div className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm sm:grid-cols-2">
        <div className="border-b border-[#E2E8F0] p-gutter sm:border-b-0 sm:border-r">
          <span className="text-label-caps uppercase text-[#6366F1]">Current Website</span>
          <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
            {left || NOT_FOUND}
          </p>
        </div>
        <div className="p-gutter">
          <span className="text-label-caps uppercase text-[#6366F1]">Competitor Website</span>
          <p className="mt-stack-sm whitespace-pre-line text-body-sm text-[#475569]">
            {right || NOT_FOUND}
          </p>
        </div>
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
