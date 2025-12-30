"""Prometheus metrics for URL Shortener Service."""
from prometheus_client import Counter, Histogram, Gauge

# URL creation metrics
urls_created_total = Counter(
    "urlshortener_urls_created_total",
    "Total number of URLs created",
    ["status"]  
)

# Redirect metrics
redirects_total = Counter(
    "urlshortener_redirects_total",
    "Total number of redirect requests",
    ["status"] )

redirect_latency = Histogram(
    "urlshortener_redirect_latency_seconds",
    "Redirect response time in seconds",
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Cache metrics
cache_hits_total = Counter(
    "urlshortener_cache_hits_total",
    "Total number of Redis cache hits"
)

cache_misses_total = Counter(
    "urlshortener_cache_misses_total",
    "Total number of Redis cache misses"
)

# URL lookup metrics
url_lookups_total = Counter(
    "urlshortener_url_lookups_total",
    "Total number of URL lookup requests",
    ["source"]  
)

# Active URLs gauge
active_urls = Gauge(
    "urlshortener_active_urls",
    "Number of currently active (non-expired) URLs"
)

# QR code generation
qr_codes_generated_total = Counter(
    "urlshortener_qr_codes_generated_total",
    "Total number of QR codes generated"
)

# URL claims
urls_claimed_total = Counter(
    "urlshortener_urls_claimed_total",
    "Total number of guest URLs claimed by users"
)
