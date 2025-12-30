import secrets
import string
import re

from app.config import get_settings

settings = get_settings()

ALPHABET = string.ascii_letters + string.digits


def generate_short_code(length: int | None = None) -> str:
    if length is None:
        length = settings.short_code_length
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def is_valid_short_code(code: str) -> bool:
    pattern = r"^[a-zA-Z0-9]+$"
    return bool(re.match(pattern, code)) and 3 <= len(code) <= 10


def validate_url(url: str) -> bool:
    pattern = re.compile(
        r"^https?://"
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
        r"localhost|"
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
        r"(?::\d+)?"
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )
    return bool(pattern.match(url))
