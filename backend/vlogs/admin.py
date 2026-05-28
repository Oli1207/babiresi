from django.contrib import admin
from .models import (
    Vlog, VlogSeries, VlogLike, VlogSave, VlogView, VlogComment,
    CreatorPoints, PointTransaction, PointWithdrawal,
    VlogChallenge, ChallengeEntry,
)

@admin.register(Vlog)
class VlogAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "region", "is_published", "is_featured", "views_count", "likes_count", "created_at"]
    list_editable = ["is_published", "is_featured"]
    list_filter = ["category", "region", "is_published", "is_featured"]
    search_fields = ["title", "author__email"]
    raw_id_fields = ["author", "series", "destination"]

@admin.register(VlogSeries)
class VlogSeriesAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "created_at"]
    search_fields = ["title"]

@admin.register(CreatorPoints)
class CreatorPointsAdmin(admin.ModelAdmin):
    list_display = ["user", "total_points", "available_points", "withdrawn_points", "level"]
    list_filter = ["level"]
    search_fields = ["user__email"]
    readonly_fields = ["total_points", "available_points", "withdrawn_points"]

@admin.register(PointWithdrawal)
class PointWithdrawalAdmin(admin.ModelAdmin):
    list_display = ["user", "amount_points", "amount_fcfa", "method", "phone_number", "status", "created_at"]
    list_editable = ["status"]
    list_filter = ["status", "method"]
    search_fields = ["user__email", "phone_number"]

@admin.register(VlogChallenge)
class VlogChallengeAdmin(admin.ModelAdmin):
    list_display = ["title", "theme", "prize_amount_fcfa", "start_date", "end_date", "is_active"]
    list_editable = ["is_active"]

admin.site.register(PointTransaction)
admin.site.register(ChallengeEntry)
