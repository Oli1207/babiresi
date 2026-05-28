"""
Shared utility helpers.
"""
import os


def hybrid_image_url(field, request=None):
    """
    Return the correct URL for an ImageField, handling both:
    - Old images stored locally in MEDIA_ROOT  → backend MEDIA_URL
    - New images uploaded to Cloudinary         → Cloudinary absolute URL

    Usage:
        hybrid_image_url(obj.image, request)
    """
    from django.conf import settings as django_settings

    if not field or not getattr(field, "name", None):
        return None
    try:
        local_path = os.path.join(str(django_settings.MEDIA_ROOT), field.name)
        if os.path.exists(local_path):
            path = django_settings.MEDIA_URL + field.name
            return request.build_absolute_uri(path) if request else path
        url = field.url
        if url.startswith("http://") or url.startswith("https://"):
            return url
        return request.build_absolute_uri(url) if request else url
    except Exception:
        return None
