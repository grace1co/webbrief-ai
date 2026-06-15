"""Crawl public pages from the same domain with robots.txt and page limits."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from selectolax.parser import HTMLParser

from app.config import settings
from app.utils.url_guard import same_domain, validate_public_url, UrlValidationError

logger = logging.getLogger(__name__)

# Skip files that are not useful for text extraction.
SKIP_EXTENSIONS = (
    ".pdf", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".mp4", ".mp3", ".css", ".js", ".ico", ".woff", ".woff2", ".ttf",
    ".xml", ".json", ".rss",
)


@dataclass
class CrawledPageData:
    url: str
    title: str | None
    raw_html: str
    status: str = "ok"


@dataclass
class CrawlResult:
    root_url: str
    pages: list[CrawledPageData] = field(default_factory=list)
    site_title: str | None = None


def _robot_parser(root: str) -> RobotFileParser:
    rp = RobotFileParser()
    parsed = urlparse(root)
    rp.set_url(f"{parsed.scheme}://{parsed.netloc}/robots.txt")
    try:
        rp.read()
    except Exception:  # noqa: BLE001 - an unreadable robots file should not block the crawl
        rp.parse([])
    return rp


def _extract_links(html: str, base_url: str) -> list[str]:
    tree = HTMLParser(html)
    links: list[str] = []
    for node in tree.css("a[href]"):
        href = node.attributes.get("href")
        if not href:
            continue
        absolute, _ = urldefrag(urljoin(base_url, href))
        if absolute.lower().endswith(SKIP_EXTENSIONS):
            continue
        links.append(absolute)
    return links


def _title(html: str) -> str | None:
    tree = HTMLParser(html)
    node = tree.css_first("title")
    return node.text(strip=True) if node else None


def crawl_site(root_url: str, max_pages: int) -> CrawlResult:
    """Crawl same-domain HTML pages up to the requested page limit."""
    root = validate_public_url(root_url)
    max_pages = min(max_pages, settings.crawl_max_pages_cap)

    robots = _robot_parser(root)
    result = CrawlResult(root_url=root)

    queue: list[str] = [root]
    seen: set[str] = {root}
    headers = {"User-Agent": "WebBriefAI/1.0 (+research crawler)"}

    with httpx.Client(
        timeout=settings.crawl_timeout_seconds,
        follow_redirects=True,
        headers=headers,
    ) as client:
        while queue and len(result.pages) < max_pages:
            url = queue.pop(0)

            if not robots.can_fetch(headers["User-Agent"], url):
                logger.info("robots.txt disallows %s", url)
                continue

            try:
                validate_public_url(url)  # Redirects must pass the same private-network checks.
                resp = client.get(url)
                resp.raise_for_status()
                ctype = resp.headers.get("content-type", "")
                if "text/html" not in ctype:
                    continue
                html = resp.text
            except (httpx.HTTPError, UrlValidationError) as exc:
                logger.warning("crawl failed for %s: %s", url, exc)
                result.pages.append(
                    CrawledPageData(url=url, title=None, raw_html="", status="failed")
                )
                continue

            page = CrawledPageData(url=url, title=_title(html), raw_html=html)
            result.pages.append(page)
            if result.site_title is None and page.title:
                result.site_title = page.title

            for link in _extract_links(html, url):
                if link not in seen and same_domain(link, root):
                    seen.add(link)
                    queue.append(link)

    if result.site_title is None:
        result.site_title = urlparse(root).netloc
    return result
