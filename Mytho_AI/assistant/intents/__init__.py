"""
intents package
---------------
Module-specific intent definitions and role-based access control.
"""

from .shared_intents import SHARED_INTENTS, ROLE_PERMISSIONS, get_module_intents, filter_by_role
from .pharmacy_intents import PHARMACY_INTENTS, PHARMACY_RULES
from .patient_intents import PATIENT_INTENTS, PATIENT_RULES

__all__ = [
    "SHARED_INTENTS",
    "ROLE_PERMISSIONS",
    "get_module_intents",
    "filter_by_role",
    "PHARMACY_INTENTS",
    "PHARMACY_RULES",
    "PATIENT_INTENTS",
    "PATIENT_RULES",
]
