from rest_framework import serializers
from .models import (
    TravelAgency, TravelConsultant, TravelRequest, TravelQuote,
    QuoteLineItem, TripRoom, TripRoomMessage, PaymentSchedule,
    TripInsurance, LeadAssignment,
)


class TravelAgencySerializer(serializers.ModelSerializer):
    consultants_count = serializers.SerializerMethodField()

    class Meta:
        model = TravelAgency
        fields = [
            "id", "name", "logo", "description",
            "specialties", "languages", "phone", "whatsapp", "email",
            "is_verified", "is_platform_agency",
            "rating_avg", "total_reviews", "total_trips_organized",
            "consultants_count",
        ]

    def get_consultants_count(self, obj):
        return obj.consultants.filter(user__is_active=True).count()


class TravelConsultantSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_photo = serializers.SerializerMethodField()
    agency_name = serializers.SerializerMethodField()

    class Meta:
        model = TravelConsultant
        fields = [
            "id", "user_name", "user_photo", "agency", "agency_name",
            "bio", "photo", "languages", "specialties",
            "is_available", "rating_avg", "total_trips",
        ]

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email

    def get_user_photo(self, obj):
        try:
            return obj.user.profile.image.url if obj.user.profile.image else None
        except Exception:
            return None

    def get_agency_name(self, obj):
        return obj.agency.name if obj.agency else "Babiresi Voyages"


class QuoteLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteLineItem
        fields = [
            "id", "category", "label", "description", "consultant_note",
            "unit_price_fcfa", "quantity", "total_fcfa",
            "linked_listing_id", "linked_guide_id", "linked_vehicle_id", "linked_activity_id",
            "order",
        ]
        read_only_fields = ["total_fcfa"]


class TravelQuoteSerializer(serializers.ModelSerializer):
    line_items = QuoteLineItemSerializer(many=True, read_only=True)
    consultant_name = serializers.SerializerMethodField()

    class Meta:
        model = TravelQuote
        fields = [
            "id", "request", "consultant", "consultant_name", "version", "status",
            "notes", "validity_until",
            "subtotal_fcfa", "service_fee_fcfa", "total_fcfa",
            "client_comment", "rejection_reason",
            "sent_at", "accepted_at", "rejected_at", "created_at",
            "line_items",
        ]
        read_only_fields = ["version", "subtotal_fcfa", "service_fee_fcfa", "total_fcfa"]

    def get_consultant_name(self, obj):
        if obj.consultant:
            return obj.consultant.user.full_name or obj.consultant.user.email
        return None


class TravelRequestSerializer(serializers.ModelSerializer):
    destinations_list = serializers.SerializerMethodField()
    latest_quote = serializers.SerializerMethodField()

    class Meta:
        model = TravelRequest
        fields = [
            "id", "full_name", "email", "whatsapp",
            "preferred_contact_method", "preferred_contact_time", "timezone",
            "nationality", "residence_country",
            "adults_count", "children_count", "group_type", "special_occasion",
            "desired_start_date", "desired_end_date", "is_dates_flexible", "duration_days",
            "destinations_list", "interests",
            "accommodation_style", "comfort_level", "rooms_needed",
            "transport_type", "vehicle_type",
            "wants_guide", "wants_cooking_class", "wants_excursions", "wants_artisan_visits",
            "budget_range", "currency_preference",
            "status", "assigned_agency", "assigned_consultant",
            "sla_breached", "first_contact_deadline",
            "created_at", "latest_quote",
        ]
        read_only_fields = [
            "status", "assigned_agency", "assigned_consultant",
            "sla_breached", "first_contact_deadline",
        ]

    def get_destinations_list(self, obj):
        return [{"id": d.id, "name": d.name} for d in obj.destinations.all()]

    def get_latest_quote(self, obj):
        quote = obj.quotes.filter(status__in=["sent", "accepted"]).order_by("-version").first()
        if quote:
            return {"id": quote.id, "version": quote.version, "status": quote.status, "total_fcfa": quote.total_fcfa}
        return None


class TravelRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelRequest
        exclude = [
            "status", "assigned_consultant", "assigned_agency", "assigned_at",
            "first_contact_deadline", "sla_breached", "user",
            "created_at", "updated_at",
        ]


class TripRoomMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = TripRoomMessage
        fields = ["id", "author_name", "is_mine", "message", "attachment_url", "is_read", "created_at"]
        read_only_fields = ["author_name", "is_mine"]

    def get_author_name(self, obj):
        return obj.author.full_name or obj.author.email

    def get_is_mine(self, obj):
        request = self.context.get("request")
        return request and request.user == obj.author


class TripRoomSerializer(serializers.ModelSerializer):
    messages = TripRoomMessageSerializer(many=True, read_only=True)
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = TripRoom
        fields = [
            "id", "itinerary", "checklist", "emergency_contacts",
            "map_points", "kit_voyage", "is_active",
            "messages", "unread_count", "created_at",
        ]

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(author=request.user).count()
        return 0


class PaymentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSchedule
        fields = [
            "deposit_amount", "deposit_due_date", "deposit_paid_at",
            "balance_amount", "balance_due_date", "balance_paid_at",
            "status",
        ]


class ConsultantDashboardSerializer(serializers.Serializer):
    active_leads = serializers.IntegerField()
    pending_quotes = serializers.IntegerField()
    in_progress_trips = serializers.IntegerField()
    completed_trips = serializers.IntegerField()
    total_revenue = serializers.IntegerField()
