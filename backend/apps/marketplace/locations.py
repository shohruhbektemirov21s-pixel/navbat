"""Versioned Uzbekistan region/district directory; no network calls during onboarding."""
import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def regions():
    data = json.loads((Path(__file__).parent / 'data' / 'uzbekistan_locations.json').read_text(encoding='utf-8'))
    return tuple(sorted(data['regions'], key=lambda region: region['name']))


def get_region(key):
    return next((region for region in regions() if key in (region['id'], region['name'])), None)


def get_district(region, key):
    return next((district for district in region['districts'] if district['id'] == key), None)


def city_for_district(region, district):
    """Keep existing city references (e.g. city-qarshi) while adding new locations on demand."""
    from .models import City

    name = district['name']
    candidates = [name]
    if name.endswith(' shahri'):
        candidates.append(name.removesuffix(' shahri'))
    existing = City.objects.filter(region=region['name'], name__in=candidates).order_by('id').first()
    if existing:
        return existing
    # City names are unique in the legacy schema. Never attach a location to a
    # namesake from another region, including manually entered older records.
    if City.objects.filter(name=name).exists():
        name = f"{district['name']} ({region['name']})"
    city, _ = City.objects.get_or_create(
        id=f"city-{region['id']}-{district['id']}",
        defaults={'name': name, 'region': region['name']},
    )
    return city
