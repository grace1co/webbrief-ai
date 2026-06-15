import { useEffect, useState } from "react";
import { useAnalysis } from "./AnalysisLayout";
import { api } from "../lib/api";
import type { SourcePage } from "../types";
import { ErrorState, Icon, Spinner } from "../components/ui";

export default function Sources() {
  const { analysis } = useAnalysis();
  const [pages, setPages] = useState<SourcePage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.getSources(analysis.analysis_id).then(setPages).catch((e) => setError(e instanceof Error ? e.message : "Failed to load sources.")); }, [analysis.analysis_id]);

  return <div className="flex flex-col gap-stack-md">
    <div><span className="text-label-caps uppercase text-[#6366F1]">Evidence Library</span><h1 className="mt-1 text-h2 font-bold">Crawled Pages</h1><p className="text-body-sm text-[#64748B]">Review the exact pages and chunks used by this analysis.</p></div>
    {error && <ErrorState message={error} />}{!pages && !error && <Spinner label="Loading sources..." className="text-[#64748B]" />}{pages?.length === 0 && <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-stack-lg text-center text-[#64748B]"><Icon name="menu_book" className="mb-stack-sm text-3xl text-[#06B6D4]" /><p className="text-body-md font-bold text-[#0F172A]">No source pages recorded.</p></div>}
    {pages?.map((page) => <div key={page.id} className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm"><button className="flex w-full items-start justify-between gap-stack-md text-left" onClick={() => setOpen(open === page.id ? null : page.id)}><div className="min-w-0 flex-1"><div className="flex items-center gap-stack-sm"><span className={`h-2 w-2 rounded-full ${page.crawl_status === "ok" ? "bg-[#06B6D4]" : "bg-[#EF4444]"}`} /><span className="truncate text-body-md font-bold">{page.page_title || page.page_url}</span></div><p className="truncate text-mono-data text-[#64748B]">{page.page_url}</p>{page.preview && <p className="mt-stack-sm line-clamp-3 text-body-sm text-[#64748B]">{page.preview}</p>}</div><div className="flex shrink-0 items-center gap-stack-md text-body-sm text-[#64748B]"><span className="hidden sm:inline">{page.crawl_status}</span><span>{page.word_count} words</span><span>{page.chunk_count} chunks</span><span className="hidden lg:inline">{new Date(page.date_crawled).toLocaleDateString()}</span><Icon name={open === page.id ? "expand_less" : "expand_more"} /></div></button>{open === page.id && <div className="mt-stack-md flex flex-col gap-stack-sm border-t border-[#E2E8F0] pt-stack-md">{page.chunks.map((chunk) => <div key={chunk.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-stack-sm"><span className="text-label-caps uppercase text-[#0891B2]">Chunk {chunk.chunk_index} · {chunk.token_count} tokens</span><p className="mt-1 text-mono-data text-[#475569]">{chunk.chunk_text}</p></div>)}</div>}</div>)}
  </div>;
}
