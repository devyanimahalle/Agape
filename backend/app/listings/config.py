"""Listing settings (kept in Role B's folder, deviation D5)."""
import os

# Estimate constant: 0.4 kg of food per meal. Configurable via env MEAL_KG.
MEAL_KG = float(os.getenv("MEAL_KG", "0.4"))
EXPIRY_INTERVAL_SECONDS = int(os.getenv("EXPIRY_INTERVAL_SECONDS", "60"))
