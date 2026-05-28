from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from vlogs.models import Vlog
from services.models import Guide, Activity, Artisan, Restaurant
from listings.models import Listing


def _bounds_filter(qs, params, lat_field="latitude", lng_field="longitude"):
    """Filter queryset to map bounds (ne/sw)."""
    try:
        ne_lat = float(params.get("ne_lat", 0))
        ne_lng = float(params.get("ne_lng", 0))
        sw_lat = float(params.get("sw_lat", 0))
        sw_lng = float(params.get("sw_lng", 0))
        if not all([ne_lat, ne_lng, sw_lat, sw_lng]):
            return qs
        return qs.filter(**{
            f"{lat_field}__gte": min(sw_lat, ne_lat),
            f"{lat_field}__lte": max(sw_lat, ne_lat),
            f"{lng_field}__gte": min(sw_lng, ne_lng),
            f"{lng_field}__lte": max(sw_lng, ne_lng),
        })
    except (TypeError, ValueError):
        return qs


def _cover_url(request, field):
    """Build absolute URL for an ImageField, or return None."""
    if not field:
        return None
    try:
        return request.build_absolute_uri(field.url)
    except Exception:
        return None


class MapPinsView(APIView):
    """
    GET /api/v1/map/pins/
    Query params:
      layers=vlogs,listings,activities,restaurants,guides,artisans  (default: all)
      ne_lat, ne_lng, sw_lat, sw_lng  — Leaflet bounds
    Returns lightweight pin objects per layer (max 200 each).
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        layers_param = request.query_params.get("layers", "")
        all_layers = {"vlogs", "listings", "activities", "restaurants", "guides", "artisans"}
        if layers_param:
            layers = {l.strip() for l in layers_param.split(",") if l.strip()} & all_layers
        else:
            layers = all_layers

        result = {}

        # ── Vlogs ──────────────────────────────────────────────
        if "vlogs" in layers:
            qs = Vlog.objects.filter(
                is_published=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).select_related("author", "destination")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for v in qs[:200]:
                pins.append({
                    "id": v.id,
                    "lat": v.latitude,
                    "lng": v.longitude,
                    "title": v.title,
                    "thumb": v.thumbnail_url or None,
                    "author_name": v.author.full_name or v.author.email,
                    "views_count": v.views_count,
                    "likes_count": v.likes_count,
                    "category": v.category,
                    "region": v.region,
                    "city": v.city,
                    "destination_slug": v.destination.slug if v.destination else None,
                    "cloudinary_url": v.cloudinary_url or None,
                    "is_featured": v.is_featured,
                })
            result["vlogs"] = pins

        # ── Listings ───────────────────────────────────────────
        if "listings" in layers:
            qs = Listing.objects.filter(
                is_active=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).prefetch_related("images")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for l in qs[:200]:
                imgs = l.images.all()
                cover = next((i for i in imgs if i.is_cover), imgs[0] if imgs else None)
                thumb = _cover_url(request, cover.image) if cover else None
                pins.append({
                    "id": l.id,
                    "lat": l.latitude,
                    "lng": l.longitude,
                    "title": l.title,
                    "thumb": thumb,
                    "price_per_night": l.price_per_night,
                    "city": l.city,
                    "area": l.area,
                    "listing_type": l.listing_type,
                })
            result["listings"] = pins

        # ── Activities ─────────────────────────────────────────
        if "activities" in layers:
            qs = Activity.objects.filter(
                is_active=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).select_related("destination")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for a in qs[:200]:
                pins.append({
                    "id": a.id,
                    "lat": a.latitude,
                    "lng": a.longitude,
                    "title": a.title,
                    "thumb": _cover_url(request, a.cover_image),
                    "price_per_person": a.price_per_person,
                    "category": a.category,
                    "rating_avg": float(a.rating_avg),
                    "destination_slug": a.destination.slug if a.destination else None,
                })
            result["activities"] = pins

        # ── Restaurants ────────────────────────────────────────
        if "restaurants" in layers:
            qs = Restaurant.objects.filter(
                is_active=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).select_related("destination")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for r in qs[:200]:
                pins.append({
                    "id": r.id,
                    "lat": r.latitude,
                    "lng": r.longitude,
                    "title": r.name,
                    "thumb": _cover_url(request, r.cover_image),
                    "category": r.category,
                    "price_range": r.price_range,
                    "rating_avg": float(r.rating_avg),
                    "destination_slug": r.destination.slug if r.destination else None,
                })
            result["restaurants"] = pins

        # ── Guides ─────────────────────────────────────────────
        if "guides" in layers:
            qs = Guide.objects.filter(
                is_verified=True,
                is_available=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).select_related("user")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for g in qs[:200]:
                pins.append({
                    "id": g.id,
                    "lat": g.latitude,
                    "lng": g.longitude,
                    "title": g.user.full_name or g.user.email,
                    "thumb": _cover_url(request, g.photo),
                    "half_day_price": g.half_day_price,
                    "rating_avg": float(g.rating_avg),
                    "specialties": g.specialties,
                })
            result["guides"] = pins

        # ── Artisans ───────────────────────────────────────────
        if "artisans" in layers:
            qs = Artisan.objects.filter(
                is_verified=True,
                latitude__isnull=False,
                longitude__isnull=False,
            ).select_related("user", "destination")
            qs = _bounds_filter(qs, request.query_params)
            pins = []
            for a in qs[:200]:
                pins.append({
                    "id": a.id,
                    "lat": a.latitude,
                    "lng": a.longitude,
                    "title": a.user.full_name or a.user.email,
                    "thumb": _cover_url(request, a.photo),
                    "craft_type": a.craft_type,
                    "rating_avg": float(a.rating_avg),
                    "destination_slug": a.destination.slug if a.destination else None,
                })
            result["artisans"] = pins

        return Response(result)
