"""Great-circle distance utility."""
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in kilometres between two (lat, lng) points given in degrees."""
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = phi2 - phi1
    d_lambda = radians(lng2 - lng1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(min(1.0, sqrt(a)))
