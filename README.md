````markdown
# WebBrief AI

**Turn any website into a source-grounded research brief.**

WebBrief AI is a full-stack web app that crawls public websites, indexes their content with vector search, and generates grounded Q&A, structured research briefs, website quality scores, and competitor comparisons.

My goal with this project was to create a more reliable way to analyze website content. I wanted users to be able to ask questions, review summaries, compare sites, and understand a website’s strengths without having to manually search through every page. To keep the results trustworthy, answers are based only on crawled pages, include source citations, and clearly mark information as not found when the website does not provide it.

## Features

- **Source-grounded Q&A** — answers are based only on crawled website content and include source cards.
- **Instant summaries** — generates an overview, key topics, and suggested questions after each crawl.
- **Research briefs** — creates structured, skimmable reports with Markdown export.
- **Website scoring** — scores websites from 0–10 across clarity, trustworthiness, pricing transparency, content completeness, navigation, customer readiness, and usefulness.
- **Competitor comparison** — compares two websites side by side.
- **History and saved analyses** — tracks recent analyses and lets users save important ones.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL, SQLAlchemy 2.0 |
| Vector Search | Qdrant |
| AI | OpenAI-compatible chat and embedding APIs, custom RAG pipeline |
| Crawling | httpx, selectolax, robots.txt-aware crawling, SSRF protection |

## Architecture

WebBrief AI uses a React frontend, FastAPI backend, PostgreSQL database, and Qdrant vector store.

Basic data flow:

1. A user submits a public URL.
2. The backend creates a new analysis record.
3. The crawler fetches pages from the website.
4. The cleaner extracts readable text.
5. The chunker splits content into smaller sections.
6. Embeddings are generated and stored in Qdrant.
7. The RAG service retrieves relevant chunks for Q&A and citations.
8. Generation services create summaries, reports, scores, and comparisons.

Storage:

- **PostgreSQL** stores analyses, crawled pages, chunks, chat history, reports, scores, and comparisons.
- **Qdrant** stores vector embeddings for retrieval.

Every vector search is filtered by `analysis_id`, which keeps answers tied to the correct website and prevents results from mixing across analyses. If no relevant content is found, the app returns a clear fallback instead of guessing.

## Environment Variables

### Backend

Create `backend/.env`:

```env
# PostgreSQL
DATABASE_URL=postgresql+psycopg://...

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=webbrief_chunks

# Chat LLM
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Embeddings
EMBEDDING_API_KEY=...
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536

# App URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000

# Tuning
CRAWL_MAX_PAGES=10
CHUNK_SIZE_TOKENS=512
RETRIEVAL_TOP_K=10
```

### Frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

Copy `.env.example` to `.env` in each folder and add your API keys. The defaults assume OpenAI-compatible APIs. If you change the embedding model, update `EMBEDDING_DIM` to match the model output size.

## Setup

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL and Qdrant.

### 2. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The database tables are created on startup. The Qdrant collection is created during the first analysis.

API docs are available at:

```text
http://localhost:8000/docs
```

### 3. Start the frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

## API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/analyze-url` | Crawl, clean, chunk, embed, and index a website |
| `GET` | `/api/analysis/{id}` | Get analysis metadata, summary, topics, and score preview |
| `GET` | `/api/analysis/{id}/sources` | Get crawled pages and chunks |
| `POST` | `/api/chat` | Ask source-grounded questions |
| `POST` | `/api/generate-report` | Generate a structured research brief |
| `POST` | `/api/score-website` | Generate website quality scores |
| `POST` | `/api/compare-websites` | Compare two websites |
| `GET` | `/api/history` | View recent analyses |
| `GET` | `/api/saved` | View saved analyses |
| `DELETE` | `/api/analysis/{id}` | Delete an analysis from PostgreSQL and Qdrant |

## Database Tables

Main tables:

```text
users
website_analyses
crawled_pages
content_chunks
chat_messages
generated_reports
website_scores
website_comparisons
```

Models are defined in:

```text
backend/app/models/__init__.py
```

## Safety

- Blocks localhost, private, loopback, link-local, and reserved IP ranges.
- Normalizes and validates URLs before crawling.
- Stays on the same domain during crawls.
- Respects `robots.txt`.
- Limits the number of crawled pages.
- Uses request timeouts.
- Does not execute website scripts.
- Keeps API keys in backend environment variables only.

## Future Improvements

- Background job queue for longer crawls.
- User accounts so analyses, saved reports, and history can belong to individual profiles.
- PDF export for research briefs.
- Incremental re-crawling and change detection.
- Streaming chat responses.

## Demo

1. Start Docker:

```bash
docker compose up -d
```

2. Start the backend and frontend.
3. Open:

```text
http://localhost:5173
```

4. Paste a public website URL and click **Analyze Website**.
5. Explore the Overview, Ask, Sources, Brief, Score, and Compare pages.
````
