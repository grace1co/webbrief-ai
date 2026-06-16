import type {
  AnalysisDetail,
  AnalysisListItem,
  AnalyzeResponse,
  ChatResponse,
  Citation,
  CompareResponse,
  GenerateReportResponse,
  HistorySettings,
  ScoreResponse,
  SourcePage,
} from "../types";

const BASE = `${(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "")}/api`;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* Preserve the HTTP status when the server returns a non-JSON error. */
    }
    throw new ApiError(detail, res.status);
  }

  return res.json() as Promise<T>;
}

async function readSseStream(
  path: string,
  body: unknown,
  onEvent: (event: Record<string, unknown>) => boolean | void
): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const b = await res.json();
      if (b?.detail) detail = b.detail;
    } catch {
      /* Fall back to the status message for non-JSON stream errors. */
    }
    throw new ApiError(detail, res.status);
  }

  if (!res.body) {
    throw new Error("Response stream is not available.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      try {
        const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (onEvent(event) === false) return;
      } catch {
        /* Ignore incomplete or malformed stream events without ending the request. */
      }
    }
  }
}
export const api = {
  analyzeUrl: (url: string, maxPages = 10) =>
    request<AnalyzeResponse>("/analyze-url", {
      method: "POST",
      body: JSON.stringify({ url, max_pages: maxPages }),
    }),

  analyzeUrlStream: (
    url: string,
    maxPages: number,
    onProgress: (step: string, message: string) => void
  ): Promise<AnalyzeResponse> =>
    new Promise((resolve, reject) => {
      readSseStream("/analyze-url/stream", { url, max_pages: maxPages }, (event) => {
        if (event.event === "progress") {
          onProgress(event.step as string, event.message as string);
        } else if (event.event === "complete") {
          resolve(event as unknown as AnalyzeResponse);
          return false;
        } else if (event.event === "error") {
          reject(new Error(event.message as string));
          return false;
        }
      }).catch(reject);
    }),

  chatStream: (
    analysisId: string,
    question: string,
    onCitations: (citations: Citation[]) => void,
    onToken: (token: string) => void
  ): Promise<void> =>
    readSseStream("/chat/stream", { analysis_id: analysisId, question }, (event) => {
      if (event.event === "citations") onCitations(event.data as Citation[]);
      else if (event.event === "token") onToken(event.data as string);
    }),

  getAnalysis: (id: string) => request<AnalysisDetail>(`/analysis/${id}`),

  listAnalyses: () => request<AnalysisListItem[]>("/analyses"),

  listHistory: () => request<AnalysisListItem[]>("/history"),

  listSaved: () => request<AnalysisListItem[]>("/saved"),

  saveAnalysis: (id: string) =>
    request<{ analysis_id: string; is_saved: boolean }>(`/analysis/${id}/saved`, {
      method: "PUT",
    }),

  unsaveAnalysis: (id: string) =>
    request<{ analysis_id: string; is_saved: boolean }>(`/analysis/${id}/saved`, {
      method: "DELETE",
    }),

  getHistorySettings: () => request<HistorySettings>("/history/settings"),

  updateHistorySettings: (retentionDays: 7 | 30 | 90 | null) =>
    request<HistorySettings>("/history/settings", {
      method: "PUT",
      body: JSON.stringify({ retention_days: retentionDays }),
    }),

  clearHistory: () => request<{ deleted: number }>("/history", { method: "DELETE" }),

  getSources: (id: string) => request<SourcePage[]>(`/analysis/${id}/sources`),

  deleteAnalysis: (id: string) =>
    request<{ deleted: string }>(`/analysis/${id}`, { method: "DELETE" }),

  chat: (analysisId: string, question: string) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, question }),
    }),

  generateReport: (analysisId: string) =>
    request<GenerateReportResponse>("/generate-report", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId }),
    }),

  getReport: (analysisId: string) =>
    request<GenerateReportResponse>(`/analysis/${analysisId}/report`),

  scoreWebsite: (analysisId: string) =>
    request<ScoreResponse>("/score-website", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId }),
    }),

  getScore: (analysisId: string) =>
    request<ScoreResponse>(`/analysis/${analysisId}/score`),

  compareWebsites: (body: {
    analysis_id_a?: string;
    analysis_id_b?: string;
    url_a?: string;
    url_b?: string;
    sites?: { analysis_id?: string; url?: string; label?: string }[];
  }) =>
    request<CompareResponse>("/compare-websites", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
