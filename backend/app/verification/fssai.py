"""FSSAI verifier — abstract base, format-only default, FastAPI dependency."""
from __future__ import annotations

from abc import ABC, abstractmethod


class FssaiVerifier(ABC):
    """Abstract FSSAI verifier. Subclass to add network-based verification."""

    @abstractmethod
    def verify(self, fssai_number: str) -> None:
        """Raise AppError if the FSSAI number fails verification."""


class FormatOnlyFssaiVerifier(FssaiVerifier):
    """Default verifier: format is already validated upstream by service.validate_fssai.

    This implementation is intentionally a no-op; it exists so the dependency
    injection point can be overridden in tests or by a future network verifier.
    """

    def verify(self, fssai_number: str) -> None:  # noqa: ARG002
        pass


_default_verifier: FssaiVerifier = FormatOnlyFssaiVerifier()


def get_fssai_verifier() -> FssaiVerifier:
    """FastAPI dependency — returns the default (format-only) verifier."""
    return _default_verifier
