from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.throttling import ScopedRateThrottle
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta

from .models import (
    TravelAgency, TravelConsultant, TravelRequest, TravelQuote,
    QuoteLineItem, TripRoom, TripRoomMessage, PaymentSchedule,
    TripInsurance, LeadAssignment,
)
from userauths.views import notify
from .serializers import (
    TravelAgencySerializer, TravelConsultantSerializer,
    TravelRequestSerializer, TravelRequestCreateSerializer,
    TravelQuoteSerializer, QuoteLineItemSerializer,
    TripRoomSerializer, TripRoomMessageSerializer,
    PaymentScheduleSerializer, ConsultantDashboardSerializer,
)


def _assign_lead(travel_request):
    """Notifie les top agences pour un nouveau lead."""
    matching_agencies = TravelAgency.objects.filter(
        is_active=True, is_verified=True
    ).order_by("-rating_avg")[:3]

    deadline = timezone.now() + timedelta(hours=4)
    for agency in matching_agencies:
        LeadAssignment.objects.create(
            request=travel_request,
            agency=agency,
            deadline=deadline,
        )
        if agency.owner:
            notify(agency.owner, "booking", "Nouveau lead voyage 🧳",
                   f"Une nouvelle demande de séjour vient d'arriver — acceptez-la dans les 4h.", "/admin/travel")

    travel_request.first_contact_deadline = timezone.now() + timedelta(hours=48)
    travel_request.status = "assigned" if matching_agencies.exists() else "new"
    travel_request.save()


# =========================================================
# Agences
# =========================================================

class TravelAgencyListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = TravelAgency.objects.filter(is_active=True, is_verified=True)
        specialty = request.query_params.get("specialty")
        language = request.query_params.get("language")
        if specialty:
            qs = qs.filter(specialties__contains=[specialty])
        if language:
            qs = qs.filter(languages__contains=[language])
        return Response(TravelAgencySerializer(qs, many=True, context={"request": request}).data)


class TravelAgencyDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        agency = get_object_or_404(TravelAgency, pk=pk, is_active=True)
        data = TravelAgencySerializer(agency, context={"request": request}).data
        data["consultants"] = TravelConsultantSerializer(
            agency.consultants.filter(user__is_active=True),
            many=True, context={"request": request}
        ).data
        return Response(data)


# =========================================================
# Demande de voyage (formulaire de qualification)
# =========================================================

class TravelRequestCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "travel_request"

    def post(self, request):
        serializer = TravelRequestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        destinations_ids = request.data.get("destination_ids", [])
        travel_request = serializer.save(
            user=request.user if request.user.is_authenticated else None
        )

        if destinations_ids:
            from destinations.models import Destination
            travel_request.destinations.set(
                Destination.objects.filter(id__in=destinations_ids)
            )

        _assign_lead(travel_request)

        return Response(
            TravelRequestSerializer(travel_request, context={"request": request}).data,
            status=status.HTTP_201_CREATED
        )


class MyTravelRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = TravelRequest.objects.filter(user=request.user).order_by("-created_at")
        return Response(TravelRequestSerializer(qs, many=True, context={"request": request}).data)


class TravelRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        tr = get_object_or_404(TravelRequest, pk=pk)
        if tr.user != request.user and not request.user.is_staff:
            try:
                if tr.assigned_consultant.user != request.user:
                    return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)
        return Response(TravelRequestSerializer(tr, context={"request": request}).data)


# =========================================================
# Espace Conseiller
# =========================================================

class ConsultantDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            consultant = request.user.consultant_profile
        except Exception:
            return Response({"detail": "Profil conseiller introuvable."}, status=status.HTTP_404_NOT_FOUND)

        active_leads = TravelRequest.objects.filter(
            assigned_consultant=consultant,
            status__in=["assigned", "quoted", "negotiating"]
        ).count()
        pending_quotes = TravelQuote.objects.filter(
            consultant=consultant, status="sent"
        ).count()
        in_progress = TravelRequest.objects.filter(
            assigned_consultant=consultant, status="in_progress"
        ).count()
        completed = TravelRequest.objects.filter(
            assigned_consultant=consultant, status="completed"
        ).count()

        return Response({
            "active_leads": active_leads,
            "pending_quotes": pending_quotes,
            "in_progress_trips": in_progress,
            "completed_trips": completed,
            "total_revenue": 0,
        })


class ConsultantLeadsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            consultant = request.user.consultant_profile
        except Exception:
            return Response({"detail": "Profil conseiller introuvable."}, status=status.HTTP_404_NOT_FOUND)
        qs = TravelRequest.objects.filter(assigned_consultant=consultant).order_by("-created_at")
        return Response(TravelRequestSerializer(qs, many=True, context={"request": request}).data)


class ConsultantAcceptLeadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            consultant = request.user.consultant_profile
        except Exception:
            return Response({"detail": "Profil conseiller introuvable."}, status=status.HTTP_404_NOT_FOUND)

        assignment = get_object_or_404(
            LeadAssignment, request_id=pk,
            agency=consultant.agency
        )

        tr = assignment.request
        if tr.assigned_consultant:
            return Response({"detail": "Lead déjà assigné."}, status=status.HTTP_400_BAD_REQUEST)

        assignment.accepted_at = timezone.now()
        assignment.save()

        tr.assigned_consultant = consultant
        tr.assigned_agency = consultant.agency
        tr.assigned_at = timezone.now()
        tr.status = "assigned"
        tr.save()

        if tr.user:
            notify(tr.user, "booking", "Conseiller assigné ✈️",
                   f"Un conseiller a pris en charge votre demande de séjour. Votre Trip Room sera bientôt disponible.", f"/voyager/ma-demande/{tr.pk}")

        return Response(TravelRequestSerializer(tr, context={"request": request}).data)


# =========================================================
# Devis
# =========================================================

class QuoteCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        try:
            consultant = request.user.consultant_profile
        except Exception:
            return Response({"detail": "Profil conseiller requis."}, status=status.HTTP_403_FORBIDDEN)

        last_version = tr.quotes.aggregate(
            max_v=__import__("django.db.models", fromlist=["Max"]).Max("version")
        )["max_v"] or 0

        if last_version > 0:
            TravelQuote.objects.filter(request=tr, status="sent").update(status="superseded")

        quote = TravelQuote.objects.create(
            request=tr,
            consultant=consultant,
            version=last_version + 1,
            notes=request.data.get("notes", ""),
            validity_until=request.data.get("validity_until"),
        )

        line_items_data = request.data.get("line_items", [])
        for item_data in line_items_data:
            QuoteLineItem.objects.create(
                quote=quote,
                category=item_data.get("category", "other"),
                label=item_data.get("label", ""),
                description=item_data.get("description", ""),
                consultant_note=item_data.get("consultant_note", ""),
                unit_price_fcfa=item_data.get("unit_price_fcfa", 0),
                quantity=item_data.get("quantity", 1),
                linked_listing_id=item_data.get("linked_listing_id"),
                linked_guide_id=item_data.get("linked_guide_id"),
                linked_vehicle_id=item_data.get("linked_vehicle_id"),
                linked_activity_id=item_data.get("linked_activity_id"),
                order=item_data.get("order", 0),
            )

        quote.calculate_totals()
        quote.save()

        tr.status = "quoted"
        tr.save()

        return Response(TravelQuoteSerializer(quote, context={"request": request}).data, status=status.HTTP_201_CREATED)


class QuoteDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        quote = get_object_or_404(TravelQuote, pk=pk)
        return Response(TravelQuoteSerializer(quote, context={"request": request}).data)

    def put(self, request, pk):
        quote = get_object_or_404(TravelQuote, pk=pk)
        if quote.status not in ("draft", "sent", "superseded"):
            return Response({"detail": "Ce devis ne peut plus être modifié."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get("notes")
        validity_until = request.data.get("validity_until")
        if notes is not None:
            quote.notes = notes
        if validity_until:
            quote.validity_until = validity_until

        line_items_data = request.data.get("line_items")
        if line_items_data is not None:
            quote.line_items.all().delete()
            for item_data in line_items_data:
                QuoteLineItem.objects.create(
                    quote=quote,
                    category=item_data.get("category", "other"),
                    label=item_data.get("label", ""),
                    description=item_data.get("description", ""),
                    consultant_note=item_data.get("consultant_note", ""),
                    unit_price_fcfa=item_data.get("unit_price_fcfa", 0),
                    quantity=item_data.get("quantity", 1),
                    order=item_data.get("order", 0),
                )

        quote.calculate_totals()
        quote.save()

        return Response(TravelQuoteSerializer(quote, context={"request": request}).data)


class QuoteSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        quote = get_object_or_404(TravelQuote, pk=pk)
        quote.status = "sent"
        quote.sent_at = timezone.now()
        quote.save()
        if quote.request.user:
            notify(quote.request.user, "quote", f"Nouveau devis V{quote.version} disponible 📋",
                   f"Votre conseiller vient d'envoyer un devis pour votre séjour en Côte d'Ivoire.", f"/voyager/ma-demande/{quote.request.pk}")
        return Response({"detail": "Devis envoyé au client."})


class QuoteAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        quote = get_object_or_404(TravelQuote, pk=pk, status="sent")
        tr = quote.request

        if tr.user != request.user:
            return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)

        quote.status = "accepted"
        quote.accepted_at = timezone.now()
        quote.client_comment = request.data.get("comment", "")
        quote.save()

        tr.status = "confirmed"
        tr.save()

        TripRoom.objects.get_or_create(request=tr, defaults={
            "checklist": [
                {"item": "Vérifier validité passeport", "done": False},
                {"item": "Obtenir vaccin fièvre jaune", "done": False},
                {"item": "Souscrire assurance voyage", "done": False},
                {"item": "Acheter carte SIM CI (Orange/MTN)", "done": False},
                {"item": "Changer de l'argent (XOF/FCFA)", "done": False},
                {"item": "Télécharger l'app Babiresi offline", "done": False},
            ]
        })

        deposit = int(quote.total_fcfa * 0.30)
        balance = quote.total_fcfa - deposit
        from django.utils.timezone import now
        from datetime import timedelta
        balance_due = tr.desired_start_date - timedelta(days=14) if tr.desired_start_date else None

        PaymentSchedule.objects.get_or_create(
            request=tr,
            defaults={
                "deposit_amount": deposit,
                "balance_amount": balance,
                "balance_due_date": balance_due,
            }
        )

        if quote.consultant and quote.consultant.user:
            notify(quote.consultant.user, "booking", "Devis accepté 🎉",
                   f"Le client a accepté votre devis V{quote.version}. Le voyage est confirmé !", f"/admin/travel")

        return Response({"detail": "Devis accepté. Trip Room créée.", "trip_room_created": True})


class QuoteRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        quote = get_object_or_404(TravelQuote, pk=pk, status="sent")
        tr = quote.request
        if tr.user != request.user:
            return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)

        quote.status = "rejected"
        quote.rejected_at = timezone.now()
        quote.rejection_reason = request.data.get("reason", "")
        quote.save()

        tr.status = "negotiating"
        tr.save()

        if quote.consultant and quote.consultant.user:
            notify(quote.consultant.user, "quote", "Devis refusé",
                   f"Le client a refusé le devis V{quote.version}. Préparez une nouvelle proposition.", f"/admin/travel")

        return Response({"detail": "Devis refusé. Le conseiller peut en préparer un nouveau."})


class QuoteVersionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        quotes = tr.quotes.all()
        return Response(TravelQuoteSerializer(quotes, many=True, context={"request": request}).data)


# =========================================================
# Trip Room
# =========================================================

class TripRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        trip_room = get_object_or_404(TripRoom, request=tr)

        if tr.user != request.user and not request.user.is_staff:
            try:
                if tr.assigned_consultant.user != request.user:
                    return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)

        return Response(TripRoomSerializer(trip_room, context={"request": request}).data)

    def patch(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        trip_room = get_object_or_404(TripRoom, request=tr)

        for field in ["itinerary", "checklist", "emergency_contacts", "map_points", "kit_voyage"]:
            if field in request.data:
                setattr(trip_room, field, request.data[field])
        trip_room.save()

        return Response(TripRoomSerializer(trip_room, context={"request": request}).data)


class TripRoomMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        trip_room = get_object_or_404(TripRoom, request=tr)
        messages = trip_room.messages.all()
        TripRoomMessage.objects.filter(
            trip_room=trip_room, is_read=False
        ).exclude(author=request.user).update(is_read=True)
        return Response(TripRoomMessageSerializer(messages, many=True, context={"request": request}).data)

    def post(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk)
        trip_room = get_object_or_404(TripRoom, request=tr)

        message_text = request.data.get("message", "").strip()
        if not message_text:
            return Response({"detail": "Message vide."}, status=status.HTTP_400_BAD_REQUEST)

        msg = TripRoomMessage.objects.create(
            trip_room=trip_room,
            author=request.user,
            message=message_text,
            attachment_url=request.data.get("attachment_url", ""),
        )

        # Notify the other party (client ↔ consultant)
        tr_obj = trip_room.request
        if request.user == tr_obj.user and tr_obj.assigned_consultant and tr_obj.assigned_consultant.user:
            notify(tr_obj.assigned_consultant.user, "message", "Nouveau message client 💬",
                   f"{request.user.get_full_name() or request.user.username} : {message_text[:80]}", f"/admin/travel")
        elif tr_obj.user and request.user != tr_obj.user:
            notify(tr_obj.user, "message", "Message de votre conseiller 💬",
                   f"{request.user.get_full_name() or request.user.username} : {message_text[:80]}", f"/voyager/ma-demande/{tr_obj.pk}")

        return Response(TripRoomMessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


# =========================================================
# Paiement progressif
# =========================================================

class PaymentScheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk, user=request.user)
        schedule = get_object_or_404(PaymentSchedule, request=tr)
        return Response(PaymentScheduleSerializer(schedule).data)


class PayDepositView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk, user=request.user)
        schedule = get_object_or_404(PaymentSchedule, request=tr)

        if schedule.deposit_paid_at:
            return Response({"detail": "Acompte déjà payé."}, status=status.HTTP_400_BAD_REQUEST)

        # TODO: intégrer Paystack pour l'acompte
        schedule.deposit_paid_at = timezone.now()
        schedule.deposit_reference = request.data.get("reference", "")
        schedule.status = "deposit_paid"
        schedule.save()

        tr.status = "paid_deposit"
        tr.save()

        if tr.assigned_consultant and tr.assigned_consultant.user:
            notify(tr.assigned_consultant.user, "payment", "Acompte reçu 💰",
                   f"L'acompte de {schedule.deposit_amount} FCFA a été confirmé pour le voyage de {tr.first_name} {tr.last_name}.", f"/admin/travel")

        return Response({"detail": "Acompte confirmé.", "amount": schedule.deposit_amount})


class PayBalanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk, user=request.user)
        schedule = get_object_or_404(PaymentSchedule, request=tr)

        if not schedule.deposit_paid_at:
            return Response({"detail": "Acompte non encore payé."}, status=status.HTTP_400_BAD_REQUEST)
        if schedule.balance_paid_at:
            return Response({"detail": "Solde déjà payé."}, status=status.HTTP_400_BAD_REQUEST)

        # TODO: intégrer Paystack pour le solde
        schedule.balance_paid_at = timezone.now()
        schedule.balance_reference = request.data.get("reference", "")
        schedule.status = "fully_paid"
        schedule.save()

        tr.status = "paid_full"
        tr.save()

        if tr.assigned_consultant and tr.assigned_consultant.user:
            notify(tr.assigned_consultant.user, "payment", "Paiement complet reçu ✅",
                   f"Le solde de {schedule.balance_amount} FCFA a été confirmé. Voyage entièrement payé !", f"/admin/travel")
        notify(tr.user, "payment", "Voyage entièrement payé 🎊",
               "Votre voyage est 100% réglé. Bon voyage en Côte d'Ivoire !", f"/voyager/ma-demande/{tr.pk}")

        return Response({"detail": "Solde confirmé. Voyage entièrement payé.", "amount": schedule.balance_amount})


# =========================================================
# Assurance voyage
# =========================================================

class TripInsuranceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, request_pk):
        tr = get_object_or_404(TravelRequest, pk=request_pk, user=request.user)
        total_persons = tr.adults_count + tr.children_count
        price_per_person = 27750  # ~45€ en FCFA

        insurance, created = TripInsurance.objects.get_or_create(
            request=tr,
            defaults={
                "provider": "Partenaire Assurance",
                "coverage_type": ["annulation", "médical", "rapatriement", "bagages"],
                "price_per_person": price_per_person,
                "total_price": price_per_person * total_persons,
                "is_subscribed": True,
            }
        )

        if not created:
            insurance.is_subscribed = True
            insurance.save()

        return Response({
            "detail": "Assurance souscrite.",
            "total_price_fcfa": insurance.total_price,
            "coverage": insurance.coverage_type,
        })


# =========================================================
# Admin Travel
# =========================================================

class AdminTravelRequestListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = TravelRequest.objects.all().order_by("-created_at")
        status_filter = request.query_params.get("status")
        sla_breached = request.query_params.get("sla_breached")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if sla_breached:
            qs = qs.filter(sla_breached=True)
        return Response(TravelRequestSerializer(qs[:50], many=True, context={"request": request}).data)


class AdminAgencyManageView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = TravelAgency.objects.all()
        return Response(TravelAgencySerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = TravelAgencySerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
