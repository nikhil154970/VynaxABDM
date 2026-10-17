"""
formatters package
-----------------
Module-specific response formatters.
"""

from .pharmacy_formatters import format_pharmacy_response, PHARMACY_TEMPLATES
from .patient_formatters import format_patient_response, PATIENT_TEMPLATES

__all__ = [
    "format_pharmacy_response",
    "PHARMACY_TEMPLATES",
    "format_patient_response",
    "PATIENT_TEMPLATES",
]
