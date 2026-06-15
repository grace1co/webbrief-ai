"""URL validation and SSRF protection utilities."""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse


class UrlValidationError(ValueError):
    """Raised when a URL is invalid or blocked for safety reasons."""


def normalize_url(url: str) -> str:
    """Normalize user-entered URLs before crawling."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.netloc:
        raise UrlValidationError("URL has no host.")
    path = parsed.path.rstrip("/") or "/"
    return urlunparse(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, "", parsed.query, "")
    )


def _is_blocked_ip(host: str) -> bool:
    """Block hosts that resolve to private or unsafe IP ranges."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UrlValidationError(f"Could not resolve host: {host}") from exc

    for info in infos:
        addr = info[4][0]
        ip = ipaddress.ip_address(addr)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return True
    return False


def validate_public_url(url: str) -> str:
    """Return a normalized public URL or raise if the target is unsafe."""
    normalized = normalize_url(url)
    parsed = urlparse(normalized)

    if parsed.scheme not in ("http", "https"):
        raise UrlValidationError("Only http/https URLs are allowed.")

    host = parsed.hostname or ""
    if host in ("localhost", "0.0.0.0", "metadata.google.internal"):
        raise UrlValidationError("Internal hosts are not allowed.")

    if _is_blocked_ip(host):
        raise UrlValidationError("URL resolves to a private or reserved address.")

    return normalized


def same_domain(url: str, root: str) -> bool:
    """Return True when both URLs use the same hostname."""
    return urlparse(url).hostname == urlparse(root).hostname
