from django.contrib import admin
from .models import (
    TravelAgency, TravelConsultant, TravelRequest, TravelQuote,
    QuoteLineItem, TripRoom, TripRoomMessage, PaymentSchedule,
    TripInsurance, LeadAssignment,
)

@admin.register(TravelAgency)
class TravelAgencyAdmin(admin.ModelAdmin):
    list_display = ["name", "is_verified", "is_active", "is_platform_agency", "rating_avg", "total_trips_organized", "sla_violations"]
    list_editable = ["is_verified", "is_active", "is_platform_agency"]
    search_fields = ["name"]

@admin.register(TravelConsultant)
class TravelConsultantAdmin(admin.ModelAdmin):
    list_display = ["user", "agency", "is_available", "rating_avg", "total_trips"]
    list_editable = ["is_available"]
    search_fields = ["user__email", "user__full_name"]
    raw_id_fields = ["user", "agency"]

@admin.register(TravelRequest)
class TravelRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "full_name", "email", "status", "assigned_agency", "assigned_consultant", "sla_breached", "created_at"]
    list_filter = ["status", "group_type", "budget_range", "sla_breached"]
    search_fields = ["full_name", "email", "whatsapp"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields = ["assigned_consultant", "assigned_agency", "user"]

@admin.register(TravelQuote)
class TravelQuoteAdmin(admin.ModelAdmin):
    list_display = ["id", "request", "version", "status", "total_fcfa", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["request", "consultant"]

@admin.register(TripRoom)
class TripRoomAdmin(admin.ModelAdmin):
    list_display = ["request", "is_active", "created_at"]
    list_editable = ["is_active"]

admin.site.register(QuoteLineItem)
admin.site.register(TripRoomMessage)
admin.site.register(PaymentSchedule)
admin.site.register(TripInsurance)
admin.site.register(LeadAssignment)
