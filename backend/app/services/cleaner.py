from __future__ import annotations

import re

from selectolax.parser import HTMLParser

REMOVE_TAGS = (
    "script", "style", "noscript", "nav", "footer", "header", "aside",
    "form", "iframe", "svg", "button", "template",
)

# These class and ID fragments usually identify page chrome rather than content.
BOILERPLATE_HINTS = (
    "cookie", "consent", "banner", "navbar", "menu", "sidebar",
    "advert", "ads-", "popup", "modal", "newsletter", "social",
    "breadcrumb",
)

# Remove fallback notices that can appear when crawled pages do not run scripts.
BOILERPLATE_TEXT_PATTERNS = (
    re.compile(
        r"Notice:\s*This\s+page\s+displays\s+a\s+fallback\s+because\s+interactive\s+scripts\s+did\s+not\s+run\.?",
        re.IGNORECASE,
    ),
    re.compile(
        r"Possible\s+causes\s+include\s+disabled\s+JavaScript\s+or\s+failure\s+to\s+load\s+scripts\s+or\s+stylesheets\.?",
        re.IGNORECASE,
    ),
)


def remove_known_boilerplate(text: str) -> str:
    """Remove known fallback notices without altering surrounding page content."""
    for pattern in BOILERPLATE_TEXT_PATTERNS:
        text = pattern.sub("", text)
    return text


def clean_html(raw_html: str) -> str:
    """Return readable plain text with nav/ads/scripts removed."""
    if not raw_html:
        return ""

    tree = HTMLParser(raw_html)

    for tag in REMOVE_TAGS:
        for node in tree.css(tag):
            node.decompose()

    for node in tree.css("[class], [id]"):
        attr = (node.attributes.get("class") or "") + " " + (node.attributes.get("id") or "")
        attr = attr.lower()
        if any(hint in attr for hint in BOILERPLATE_HINTS):
            node.decompose()

    body = tree.body or tree
    text = remove_known_boilerplate(body.text(separator="\n", strip=True))

    # Remove layout whitespace and repeated adjacent lines without rewriting content.
    lines: list[str] = []
    prev = None
    for line in text.splitlines():
        line = re.sub(r"[ \t]+", " ", line).strip()
        if not line or line == prev:
            continue
        lines.append(line)
        prev = line

    return "\n".join(lines)


def word_count(text: str) -> int:
    return len(text.split())
