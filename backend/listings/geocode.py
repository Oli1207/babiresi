import time
import unicodedata
from typing import Optional, Dict, Any, List, Tuple

import requests


# ✅ Liste des 10 communes d'Abidjan (classique)
ABIDJAN_COMMUNES = [
    "abobo",
    "adjame",      # sans accent pour matcher facilement
    "anyama",
    "attecoube",
    "bingerville",
    "cocody",
    "koumassi",
    "marcory",
    "plateau",
    "yopougon",
]

# ✅ Cache mémoire simple (utile en dev) pour éviter de spammer Nominatim
_REVERSE_CACHE: Dict[Tuple[float, float], Dict[str, Any]] = {}
_REVERSE_CACHE_MAX = 500


def _norm(s: str) -> str:
    """
    ✅ Normalise une string :
    - lower
    - enlève accents
    - remplace ponctuation par espaces
    """
    s = (s or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    for ch in [",", ";", ".", ":", "-", "_", "/", "|", "(", ")", "[", "]"]:
        s = s.replace(ch, " ")

    return s


def detect_abidjan_commune(display_name: Optional[str], addr: Dict[str, Any]) -> Optional[str]:
    """
    ✅ Cherche une commune d'Abidjan dans :
    - display_name
    - toutes les valeurs de addr (raw.address)
    Peu importe l'ordre ou les virgules.
    """
    haystack = _norm(display_name or "")

    if isinstance(addr, dict):
        for v in addr.values():
            if isinstance(v, str):
                haystack += " " + _norm(v)

    words = set(haystack.split())

    for c in ABIDJAN_COMMUNES:
        if c in words:
            # ✅ retourne une version "jolie"
            pretty_map = {
                "adjame": "Adjamé",
                "attecoube": "Attécoubé",
            }
            return pretty_map.get(c, c.capitalize())

    return None


def reverse_geocode_nominatim(latitude: float, longitude: float, timeout: int = 15, retries: int = 2) -> dict:
    """
    Retourne un dict normalisé:
    {
      "address_label": "...",
      "city": "...",
      "area": "...",     # ✅ commune/zone
      "borough": "...",  # ✅ quartier
      "raw": {...}
    }

    ✅ timeout augmenté
    ✅ retries en cas de timeout
    ✅ cache simple (coords arrondies) pour éviter spam Nominatim
    ✅ force commune d'Abidjan si détectée dans l'adresse
    """
    # ✅ arrondir coords -> rend le cache efficace (et évite spam)
    lat_r = round(float(latitude), 5)
    lng_r = round(float(longitude), 5)
    cache_key = (lat_r, lng_r)

    if cache_key in _REVERSE_CACHE:
        return _REVERSE_CACHE[cache_key]

    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "format": "jsonv2",
        "lat": lat_r,
        "lon": lng_r,
        "zoom": 18,
        "addressdetails": 1,
    }
    headers = {
        # ✅ User-Agent propre (évite les rejets)
        "User-Agent": "DecrouResi/1.0 (Abidjan, CI) reverse-geocode",
    }

    last_err: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            r.raise_for_status()
            data = r.json() or {}

            addr = data.get("address", {}) or {}
            display = data.get("display_name")

            # ✅ city = ville
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("state")

            # ✅ borough = quartier (on prend neighbourhood/quarter en priorité)
            borough = (
                addr.get("neighbourhood")
                or addr.get("quarter")
                or addr.get("city_district")
                or addr.get("district")
            )

            # ✅ area = commune/zone (Abidjan)
            # IMPORTANT: on force si on détecte une des 10 communes dans l'adresse complète
            forced_commune = detect_abidjan_commune(display, addr)

            area = forced_commune or (
                addr.get("suburb")  # ✅ souvent commune à Abidjan
                or addr.get("city_district")
                or addr.get("municipality")
                or addr.get("county")
                or addr.get("state_district")
            )

            result = {
                 "address_label": display,
                 "city": city,
                 "area": area,
                 "borough": borough,
                 "latitude": lat_r,
                 "longitude": lng_r,
                 "raw": data,
            }


            # ✅ cache (et purge si trop gros)
            if len(_REVERSE_CACHE) >= _REVERSE_CACHE_MAX:
                _REVERSE_CACHE.clear()
            _REVERSE_CACHE[cache_key] = result

            return result

        except requests.exceptions.Timeout as e:
            last_err = e
            # ✅ petit backoff avant retry
            time.sleep(0.35 * (attempt + 1))
        except Exception as e:
            # ✅ autres erreurs -> on remonte
            raise e

    # ✅ si on a échoué uniquement par timeout
    raise last_err  # type: ignore


def forward_geocode_nominatim(query: str, limit: int = 6, timeout: int = 12, retries: int = 1) -> list:
    """
    ✅ Forward geocoding (texte -> coordonnées + infos)
    Retourne une liste:
    [
      {"address_label": "...", "latitude": ..., "longitude": ..., "city": "...", "area": "...", "borough": "..."},
      ...
    ]

    ✅ timeout augmenté + retry
    ✅ force commune Abidjan si détectée
    """
    query = (query or "").strip()
    if not query:
        return []

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": limit,
        "countrycodes": "ci",  # ✅ CI
    }
    headers = {"User-Agent": "DecrouResi/1.0 (Abidjan, CI) forward-geocode"}

    last_err: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            r.raise_for_status()
            results = r.json() or []

            cleaned = []
            for item in results:
                addr = item.get("address", {}) or {}
                display = item.get("display_name")

                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("state")

                borough = (
                    addr.get("neighbourhood")
                    or addr.get("quarter")
                    or addr.get("city_district")
                    or addr.get("district")
                )

                forced_commune = detect_abidjan_commune(display, addr)
                area = forced_commune or (
                    addr.get("suburb")
                    or addr.get("city_district")
                    or addr.get("municipality")
                    or addr.get("county")
                    or addr.get("state_district")
                )

                lat_val = float(item.get("lat")) if item.get("lat") else None
                lng_val = float(item.get("lon")) if item.get("lon") else None

                if lat_val is None or lng_val is None:
                    continue

                cleaned.append(
                    {
                        "address_label": display,
                        "latitude": lat_val,
                        "longitude": lng_val,
                        "city": city,
                        "area": area,
                        "borough": borough,
                    }
                )

            return cleaned

        except requests.exceptions.Timeout as e:
            last_err = e
            time.sleep(0.25 * (attempt + 1))
        except Exception as e:
            raise e

    raise last_err  # type: ignore
