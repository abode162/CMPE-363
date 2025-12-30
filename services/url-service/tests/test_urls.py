import pytest
from app.utils import generate_short_code, is_valid_short_code, validate_url


class TestShortCodeGeneration:
    def test_generate_short_code_default_length(self):
        code = generate_short_code(6)
        assert len(code) == 6
        assert code.isalnum()

    def test_generate_short_code_custom_length(self):
        code = generate_short_code(10)
        assert len(code) == 10
        assert code.isalnum()

    def test_generate_short_code_uniqueness(self):
        codes = [generate_short_code(6) for _ in range(100)]
        assert len(set(codes)) == len(codes)


class TestShortCodeValidation:
    def test_valid_short_code(self):
        assert is_valid_short_code("abc123") is True
        assert is_valid_short_code("ABC") is True
        assert is_valid_short_code("a1b2c3d4e5") is True

    def test_invalid_short_code_too_short(self):
        assert is_valid_short_code("ab") is False
        assert is_valid_short_code("a") is False

    def test_invalid_short_code_too_long(self):
        assert is_valid_short_code("a" * 11) is False

    def test_invalid_short_code_special_chars(self):
        assert is_valid_short_code("abc-123") is False
        assert is_valid_short_code("abc_123") is False
        assert is_valid_short_code("abc 123") is False


class TestURLValidation:
    def test_valid_urls(self):
        assert validate_url("https://google.com") is True
        assert validate_url("http://example.com/path") is True
        assert validate_url("https://sub.domain.com/path?query=1") is True
        assert validate_url("http://localhost:3000") is True

    def test_invalid_urls(self):
        assert validate_url("not-a-url") is False
        assert validate_url("ftp://example.com") is False
        assert validate_url("") is False

    def test_url_with_whitespace(self):
        """Validator should reject or handle URLs with leading/trailing whitespace."""
        assert validate_url("  https://google.com  ") is False        
        assert validate_url("https://goo gle.com") is False