import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAnalysis } from "./AnalysisLayout";
import { api } from "../lib/api";
import type { Citation } from "../types";
import { CopyButton, ErrorState, Icon, Spinner } from "../components/ui";

interface Turn {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

interface QAPair {
  question: string;
  answer: string;
  citations: Citation[];
  isLoading: boolean;
}

export default function Ask() {
  const { analysis } = useAnalysis();
  const [params] = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Prevent duplicate questions when StrictMode reruns the initial effect.
  const initFired = useRef(false);

  useEffect(() => {
    if (initFired.current) return;
    initFired.current = true;
    const q = params.get("q");
    if (q) void send(q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setInput("");
    setLoading(true);
    // Keep each question adjacent to its streamed answer.
    setTurns((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "", citations: [] },
    ]);
    try {
      await api.chatStream(
        analysis.analysis_id,
        q,
        (citations) =>
          setTurns((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], citations };
            return next;
          }),
        (token) =>
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            // The stream does not send a separate final answer.
            next[next.length - 1] = { ...last, content: last.content + token };
            return next;
          })
      );
      // Show a grounded fallback if the stream ends without answer tokens.
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content.trim()) {
          next[next.length - 1] = {
            ...last,
            content: "This information was not found in the crawled website content.",
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Question failed.");
      // Remove the failed pair to preserve the alternating turn order.
      setTurns((prev) => prev.slice(0, -2));
    } finally {
      setLoading(false);
    }
  }

  const questions = (
    analysis.suggested_questions.length
      ? analysis.suggested_questions
      : [
          "What does this website provide?",
          "What information is available from the crawled pages?",
          "What information appears to be missing?",
          "What are the main topics covered?",
        ]
  ).slice(0, 5);

  // Pair adjacent turns for the combined question-and-answer cards.
  const pairs: QAPair[] = [];
  for (let i = 0; i < turns.length; i += 2) {
    const user = turns[i];
    const assistant = turns[i + 1];
    if (user?.role === "user") {
      pairs.push({
        question: user.content,
        answer: assistant?.content ?? "",
        citations: assistant?.citations ?? [],
        isLoading: loading && i + 2 >= turns.length,
      });
    }
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <div>
        <span className="text-label-caps uppercase text-[#6366F1]">Ask</span>
        <h1 className="mt-1 text-h2 font-bold">Ask About This Site</h1>
        <p className="text-body-sm text-[#64748B]">
          Answers are based only on the crawled pages for{" "}
          {analysis.website_title || analysis.url}.
        </p>
      </div>

      {pairs.length === 0 && !loading && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-gutter shadow-sm">
          <h2 className="mb-stack-sm text-body-md font-bold">Suggested questions</h2>
          <div className="flex flex-col gap-stack-sm">
            {questions.map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="flex items-center justify-between rounded-lg border border-[#E2E8F0] p-stack-sm text-left hover:border-[#A5B4FC] hover:bg-[#F8FAFC]"
              >
                <span className="text-body-sm">{q}</span>
                <Icon name="north_east" className="text-[#6366F1]" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-stack-md">
        {pairs.map((pair, i) => (
          <div
            key={`${pair.question}-${i}`}
            className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden"
          >
            <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-gutter py-stack-md">
              <span className="mb-1 block text-label-caps uppercase text-[#6366F1]">
                Your Question
              </span>
              <p className="text-body-md text-[#0F172A] font-medium">{pair.question}</p>
            </div>

            <div className="p-gutter">
              {pair.isLoading && !pair.answer ? (
                <Spinner label="Retrieving grounded sources..." />
              ) : pair.answer ? (
                <>
                  <div className="flex items-center justify-between gap-stack-sm mb-stack-sm">
                    <span className="text-label-caps uppercase text-[#6366F1]">
                      Source-Backed Answer
                    </span>
                    {!pair.isLoading && (
                      <CopyButton
                        text={pair.answer}
                        className="text-[#64748B] hover:text-[#0F172A]"
                      />
                    )}
                  </div>
                  <div className="text-[#334155]">
                    <ReactMarkdown>{pair.answer}</ReactMarkdown>
                  </div>

                  {pair.citations.length > 0 && (
                    <div className="mt-stack-md border-t border-[#E2E8F0] pt-stack-md">
                      <span className="text-label-caps uppercase text-[#0891B2]">Citations</span>
                      <div className="mt-stack-sm grid gap-stack-sm">
                        {pair.citations.map((citation, j) => (
                          <a
                            key={j}
                            href={citation.page_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg border border-[#CFFAFE] bg-[#F8FAFC] p-stack-sm hover:border-[#06B6D4]"
                          >
                            <div className="flex items-center gap-stack-sm">
                              <Icon name="description" className="text-[#06B6D4]" />
                              <span className="truncate text-body-sm font-bold">
                                {citation.page_title || citation.page_url}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-3 text-mono-data text-[#64748B]">
                              {citation.excerpt}
                            </p>
                            <span className="mt-1 block truncate text-mono-data text-[#0891B2]">
                              {citation.page_url}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <ErrorState message={error} />}

      <div className="sticky bottom-0 bg-[#F1F5F9] pt-stack-sm">
        <div className="flex gap-stack-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask a custom question..."
            disabled={loading}
            className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-stack-md py-stack-sm text-body-md outline-none focus:border-[#6366F1] disabled:opacity-60"
          />
          <button
            onClick={() => void send(input)}
            disabled={!input.trim() || loading}
            className="inline-flex items-center gap-stack-sm rounded-lg bg-[#6366F1] px-gutter py-stack-sm text-body-sm font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40"
          >
            Send <Icon name="send" />
          </button>
        </div>
      </div>
    </div>
  );
}