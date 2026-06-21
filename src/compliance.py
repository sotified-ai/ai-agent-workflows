import os
import re
import hashlib
from typing import Dict, Tuple

class ComplianceGuard:
    """
    Handles PII / sensitive data scrubbing (dual-way mapping) and local semantic caching
    to enable compliance-safe, fast, and secure local LLM deployment.
    """
    def __init__(self):
        # Regular expressions for common PII and sensitive data patterns
        self.patterns = {
            "EMAIL": r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
            "IP_ADDRESS": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
            "API_KEY": r"(?:api[_-]?key|secret|token|password|auth|passwd|credential)\s*[:=]\s*['\"][a-zA-Z0-9_\\-]{12,}['\"]",
            "CREDIT_CARD": r"\b(?:\d[ -]*?){13,16}\b",
            "PHONE": r"\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b",
        }

    def mask(self, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Masks sensitive terms in the input text.
        Returns the masked text and the translation map to restore the text later.
        """
        if not text:
            return "", {}

        translation_map = {}
        masked_text = text
        counter = 0

        for key, pattern in self.patterns.items():
            matches = list(set(re.findall(pattern, masked_text, re.IGNORECASE)))
            for match in matches:
                # Skip short matching strings that could be false positives
                if len(match) < 4:
                    continue
                placeholder = f"__SAFE_{key}_{counter}__"
                translation_map[placeholder] = match
                masked_text = masked_text.replace(match, placeholder)
                counter += 1

        return masked_text, translation_map

    def unmask(self, text: str, translation_map: Dict[str, str]) -> str:
        """
        Restores the original sensitive text using the translation map.
        """
        if not text or not translation_map:
            return text

        unmasked_text = text
        for placeholder, original in translation_map.items():
            unmasked_text = unmasked_text.replace(placeholder, original)

        return unmasked_text

class LocalSemanticCache:
    """
    Local-first execution cache to avoid redundant, expensive LLM calls
    and accelerate local test generation pipelines.
    """
    def __init__(self, cache_dir: str = ".cache"):
        self.cache_dir = cache_dir
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)

    def _get_hash(self, key: str) -> str:
        return hashlib.sha256(key.encode("utf-8")).hexdigest()

    def get(self, prompt: str) -> str:
        h = self._get_hash(prompt)
        cache_path = os.path.join(self.cache_dir, f"{h}.cache")
        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def set(self, prompt: str, response: str) -> None:
        h = self._get_hash(prompt)
        cache_path = os.path.join(self.cache_dir, f"{h}.cache")
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(response)
