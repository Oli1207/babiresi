from django.db import models
from django.utils.text import slugify


REGION_CHOICES = (
    ("abidjan", "Abidjan"),
    ("bas_sassandra", "Bas-Sassandra"),
    ("comoe", "Comoé"),
    ("denguele", "Denguélé"),
    ("goh_djiboua", "Gôh-Djiboua"),
    ("lacs", "Lacs"),
    ("lagunes", "Lagunes"),
    ("marahoue", "Marahoué"),
    ("montagnes", "Montagnes"),
    ("savanes", "Savanes"),
    ("vallee_du_bandama", "Vallée du Bandama"),
    ("woroba", "Woroba"),
    ("yamoussoukro", "Yamoussoukro"),
    ("zanzan", "Zanzan"),
)


class Destination(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=120, blank=True)
    region = models.CharField(max_length=80, choices=REGION_CHOICES, blank=True)
    description = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="destinations/covers/", null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    practical_info = models.JSONField(default=dict, blank=True)
    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "name"]
        indexes = [
            models.Index(fields=["is_published", "is_featured"]),
            models.Index(fields=["region"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
