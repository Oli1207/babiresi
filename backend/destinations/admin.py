from django.contrib import admin
from .models import Destination

@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ["name", "region", "is_published", "is_featured", "order"]
    list_editable = ["is_published", "is_featured", "order"]
    list_filter = ["region", "is_published", "is_featured"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}
