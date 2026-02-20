#listings/views.py
import json
import hmac
import hashlib
import logging
import secrets
import string
import requests

from django.conf import settings
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import (
    Listing,
    Booking,
    PaymentTransaction,
    PushSubscription,
)
from .serializers import (
    ListingSerializer,
    BookingPublicSerializer,
    BookingRequestCreateSerializer,
    BookingOwnerDecisionSerializer,
    BookingPaymentPrepareSerializer,
    BookingValidateKeySerializer,
    PushSubscriptionSerializer,
    PaymentTransactionSerializer,
)
from .geocode import reverse_geocode_nominatim, forward_geocode_nominatim
from .permissions import IsOwnerOrReadOnly

logger = logging.getLogger(__name__)


# =========================================================
# ✅ Helpers: Paystack + Code + Notifications
# =========================================================

def _paystack_headers():
    secret = getattr(settings, "PAYSTACK_SECRET_KEY", None)
    if not secret:
        raise RuntimeError("PAYSTACK_SECRET_KEY missing in settings")
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def paystack_initialize(email: str, amount_cfa: int, reference: str, callback_url: str = None, metadata: dict = None):
    """
    Paystack attend souvent amount en plus petite unité.
    ⚠️ En XOF, Paystack utilise généralement l'unité de base (pas kobo),
    mais ça dépend du setup. On garde CFA ici. Tu ajusteras si besoin.
    """
    url = "https://api.paystack.co/transaction/initialize"

    payload = {
        "email": email,
        "amount": int(amount_cfa),
        "reference": reference,
    }
    if callback_url:
        payload["callback_url"] = callback_url
    if metadata:
        payload["metadata"] = metadata

    r = requests.post(url, headers=_paystack_headers(), data=json.dumps(payload), timeout=20)
    r.raise_for_status()
    return r.json()


def paystack_verify(reference: str):
    url = f"https://api.paystack.co/transaction/verify/{reference}"
    r = requests.get(url, headers=_paystack_headers(), timeout=20)
    r.raise_for_status()
    return r.json()


def generate_reference(prefix="bk"):
    # ✅ unique-ish reference
    return f"{prefix}_{secrets.token_urlsafe(10)}"


def generate_6_digit_code():
    # ✅ 6 chiffres, pas de lettres
    return "".join(secrets.choice(string.digits) for _ in range(6))

# ✅ AJOUT: endpoint pour exposer la VAPID public key au frontend
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

class PushVapidPublicKeyView(APIView):
    """
    ✅ Retourne la VAPID public key au frontend
    - AllowAny: pas besoin d'être connecté juste pour lire la clé publique
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        return Response({
            "public_key": getattr(settings, "VAPID_PUBLIC_KEY", "")
        })


from pywebpush import webpush, WebPushException  # ✅ NEW
import json  # (déjà importé chez toi)

def send_push_to_user(user, title: str, body: str, data: dict = None):
    """
    ✅ Envoi Web Push réel (PWA)
    - envoie à tous les devices du user
    - supprime les subscriptions expirées (410/404)
    """
    subs = PushSubscription.objects.filter(user=user)
    if not subs.exists():
        logger.warning("PUSH_NOTIFY no subs for user=%s", user.id)
        return False

    vapid_private = getattr(settings, "VAPID_PRIVATE_KEY", None)
    vapid_claims = getattr(settings, "VAPID_CLAIMS", {"sub": "mailto:admin@example.com"})
    if not vapid_private:
        logger.error("VAPID_PRIVATE_KEY missing in settings")
        return False

    payload = {
        "title": title,
        "body": body,
        "data": data or {},
    }

    sent = 0
    removed = 0

    for sub in subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=vapid_private,
                vapid_claims=vapid_claims,
            )
            sent += 1
            # ✅ last_seen_at
            PushSubscription.objects.filter(id=sub.id).update(last_seen_at=timezone.now())

        except WebPushException as ex:
            status_code = getattr(ex.response, "status_code", None)

            # ✅ subscription morte => on supprime
            if status_code in [404, 410]:
                sub.delete()
                removed += 1
                continue

            logger.exception("WEBPUSH failed user=%s sub=%s err=%s", user.id, sub.id, str(ex))

        except Exception as e:
            logger.exception("WEBPUSH unknown error user=%s sub=%s err=%s", user.id, sub.id, str(e))

    logger.warning("PUSH_NOTIFY done user=%s sent=%s removed=%s", user.id, sent, removed)
    return sent > 0



# =========================================================
# ✅ UTILS: GEO
# =========================================================

class ReverseGeocodeView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        lat = request.data.get("latitude")
        lng = request.data.get("longitude")

        logger.warning("REVERSE_GEOCODE incoming data=%s", request.data)

        if lat is None or lng is None:
            return Response({"detail": "latitude et longitude sont requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat = float(lat)
            lng = float(lng)
            logger.warning("REVERSE_GEOCODE lat=%s lng=%s", lat, lng)

            data = reverse_geocode_nominatim(lat, lng)

            logger.warning("REVERSE_GEOCODE ok address_label=%s", data.get("address_label"))
            logger.warning("REVERSE_GEOCODE ok city=%s area=%s borough=%s", data.get("city"), data.get("area"), data.get("borough"))

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("REVERSE_GEOCODE failed: %s", str(e))
            msg = str(e)

            if "Read timed out" in msg or "Timeout" in msg:
                return Response(
                    {
                        "address_label": None,
                        "city": None,
                        "area": None,
                        "borough": None,
                        "raw": None,
                        "warning": "geocode_timeout",
                    },
                    status=status.HTTP_200_OK
                )

            return Response({"detail": "reverse geocoding failed", "error": msg}, status=status.HTTP_400_BAD_REQUEST)


class PlaceSearchView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        q = request.query_params.get("q", "")
        limit = request.query_params.get("limit", "6")

        try:
            limit = int(limit)
        except Exception:
            limit = 6

        logger.warning("SEARCH_PLACES q=%s limit=%s", q, limit)

        try:
            results = forward_geocode_nominatim(q, limit=limit)
            return Response({"results": results}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("SEARCH_PLACES failed: %s", str(e))
            return Response({"results": []}, status=status.HTTP_200_OK)


# =========================================================
# ✅ LISTINGS
# =========================================================
from django.db.models import Q
from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser


class ListingListCreateView(generics.ListCreateAPIView):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related("author")
            .prefetch_related("images")
        )

        # ✅ Public: only active
        qs = qs.filter(is_active=True)

        # ✅ query params
        q = (self.request.query_params.get("q") or "").strip()
        city = self.request.query_params.get("city")
        area = self.request.query_params.get("area")
        borough = self.request.query_params.get("borough")
        max_price = self.request.query_params.get("max_price")
        guests = self.request.query_params.get("guests")

        # ✅ rooms (min)
        min_bedrooms = self.request.query_params.get("min_bedrooms")
        min_bathrooms = self.request.query_params.get("min_bathrooms")
        min_living_rooms = self.request.query_params.get("min_living_rooms")
        min_kitchens = self.request.query_params.get("min_kitchens")
        min_beds = self.request.query_params.get("min_beds")
        listing_type = self.request.query_params.get("listing_type")
        
        
        if listing_type:
            qs = qs.filter(listing_type=listing_type)


        # ✅ text search
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(address_label__icontains=q)
                | Q(city__icontains=q)
                | Q(area__icontains=q)
                | Q(borough__icontains=q)
            )

        # ✅ location filters
        if city:
            qs = qs.filter(city__icontains=city)
        if area:
            qs = qs.filter(area__icontains=area)
        if borough:
            qs = qs.filter(borough__icontains=borough)

        # ✅ price & guests
        try:
            if max_price:
                qs = qs.filter(price_per_night__lte=int(max_price))
            if guests:
                qs = qs.filter(max_guests__gte=int(guests))
        except (ValueError, TypeError):
            pass

        # ✅ min rooms (bulk check)
        try:
            if min_bedrooms:
                qs = qs.filter(bedrooms__gte=int(min_bedrooms))
            if min_bathrooms:
                qs = qs.filter(bathrooms__gte=int(min_bathrooms))
            if min_living_rooms:
                qs = qs.filter(living_rooms__gte=int(min_living_rooms))
            if min_kitchens:
                qs = qs.filter(kitchens__gte=int(min_kitchens))
            if min_beds:
                qs = qs.filter(beds__gte=int(min_beds))
        except (ValueError, TypeError):
            pass

        # ✅ amenities bool
        def _as_bool(v):
            return str(v).lower() in ["1", "true", "yes", "y", "on"]

        amenities = [
            "has_wifi", "has_ac", "has_parking", "has_tv", "has_kitchen",
            "has_hot_water", "has_garden", "has_balcony", "has_generator",
            "has_security", "allows_pets", "allows_smoking",
        ]
        for field in amenities:
            val = self.request.query_params.get(field)
            if val is not None and _as_bool(val):
                qs = qs.filter(**{field: True})

        # =========================================================
        # ✅ MODE MAP: Filtrage par coordonnées (Sans PostGIS)
        # =========================================================
        map_mode = self.request.query_params.get("map")
        if str(map_mode).lower() in ["1", "true", "yes", "on"]:
            ne_lat = self.request.query_params.get("ne_lat")
            ne_lng = self.request.query_params.get("ne_lng")
            sw_lat = self.request.query_params.get("sw_lat")
            sw_lng = self.request.query_params.get("sw_lng")

            if all([ne_lat, ne_lng, sw_lat, sw_lng]):
                try:
                    # Conversion en float
                    nelat, nelng = float(ne_lat), float(ne_lng)
                    swlat, swlng = float(sw_lat), float(sw_lng)

                    # Filtrage standard sur les colonnes FloatField
                    # min/max sécurisent le cas où l'utilisateur traverse l'antiméridien
                    qs = qs.filter(
                        latitude__gte=min(swlat, nelat),
                        latitude__lte=max(swlat, nelat),
                        longitude__gte=min(swlng, nelng),
                        longitude__lte=max(swlng, nelng),
                    )
                except (ValueError, TypeError):
                    pass

        return qs.order_by("-date_posted", "-id")

    def list(self, request, *args, **kwargs):
        map_mode = request.query_params.get("map")
        if str(map_mode).lower() in ["1", "true", "yes", "on"]:
            qs = self.filter_queryset(self.get_queryset())

            # limit markers (default 250)
            limit = request.query_params.get("limit", "250")
            try:
                limit = int(limit)
            except (ValueError, TypeError):
                limit = 250
            limit = max(50, min(limit, 500))

            qs = qs[:limit]
            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)

        return super().list(request, *args, **kwargs)


class ListingRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    # ✅ CHANGE: pas de delete, on force à passer par is_active
    def delete(self, request, *args, **kwargs):
        return Response(
            {"detail": "Pour des raisons de sécurité les résidences ne peuvent être supprimées totalement. Cependant, elle n'apparaitra que sur votre profil."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

# =========================================================
# ✅ BOOKINGS — NEW FLOW
# =========================================================

class BookingRequestCreateView(generics.CreateAPIView):
    """
    ✅ Client crée une DEMANDE de réservation (requested)
    -> notifie le gérant (listing.author)
    """
    serializer_class = BookingRequestCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        booking = serializer.save()

        # ✅ Notification PWA au gérant (placeholder log)
        owner = booking.listing.author
        if owner:
            send_push_to_user(
                owner,
                title="Nouvelle demande de réservation",
                body=f"{booking.user} veut réserver {booking.listing.title} ({booking.duration_days} jours)",
                data={"type": "booking_request", "booking_id": booking.id, "url": "/owner/inbox"},
            )


class MyBookingsView(generics.ListAPIView):
    """
    ✅ Client: voir ses bookings
    """
    serializer_class = BookingPublicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).select_related("listing").order_by("-created_at")


class BookingDetailView(generics.RetrieveAPIView):
    """
    ✅ Client: voir le détail d'une demande/réservation
    GET /bookings/<id>/
    """
    serializer_class = BookingPublicSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "booking_id"
    
    def get_queryset(self):
        # ✅ le client ne peut voir que ses bookings
        return Booking.objects.filter(user=self.request.user).select_related("listing")



class OwnerBookingsInboxView(generics.ListAPIView):
    """
    ✅ Gérant: inbox des demandes
    - Par défaut: status=requested
    """
    serializer_class = BookingPublicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        status_q = self.request.query_params.get("status", "requested")
        return (
            Booking.objects
            .filter(listing__author=self.request.user, status=status_q)
            .select_related("listing", "user")
            .order_by("-created_at")
        )


class OwnerBookingDecisionView(APIView):
    """
    ✅ Gérant: approve/reject une demande
    POST /bookings/<id>/decision/
    body:
    {
      "action": "approve",
      "start_date": "2026-01-22",   # optionnel si desired_start_date existe
      "owner_note": "OK"
    }

    ou reject:
    {
      "action": "reject",
      "owner_note": "Déjà pris",
      "proposals": [{"start_date":"2026-02-01","end_date":"2026-02-03","note":"dispo"}]
    }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        # ✅ sécurité: propriétaire uniquement
        if booking.listing.author_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        serializer = BookingOwnerDecisionSerializer(
            data=request.data,
            context={"request": request, "booking": booking},
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        # ✅ Notif au client (placeholder)
        if updated.status == "awaiting_payment":
            send_push_to_user(
                updated.user,
                title="Réservation acceptée",
                body="Le gérant a validé ta demande. Tu peux payer l'acompte.",
                data={"type": "booking_approved", "booking_id": updated.id, "url": f"/bookings/{updated.id}"},
            )
        elif updated.status == "rejected":
            send_push_to_user(
                updated.user,
                title="Réservation refusée",
                body="Le gérant a indiqué que ce n'est pas disponible.",
                data={"type": "booking_rejected", "booking_id": updated.id},
            )

        return Response(BookingPublicSerializer(updated).data, status=status.HTTP_200_OK)


class BookingPaymentInfoView(APIView):
    """
    ✅ Client: récupérer les montants et savoir si le bouton payer doit s’afficher
    GET /bookings/<id>/payment-info/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        if booking.user_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        return Response(BookingPaymentPrepareSerializer(booking).data, status=status.HTTP_200_OK)


# =========================================================
# ✅ PAYSTACK — initialize / verify / webhook
# =========================================================

class PaystackInitializeView(APIView):
    """
    ✅ Client: init paiement acompte
    POST /bookings/<id>/paystack/initialize/
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        if booking.user_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != "awaiting_payment":
            return Response({"detail": "Paiement non disponible pour ce statut."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ créer transaction
        reference = generate_reference("pay")
        tx = PaymentTransaction.objects.create(
            booking=booking,
            provider="paystack",
            reference=reference,
            status="initiated",
            amount=int(booking.amount_to_pay),
        )

        # ✅ callback_url optionnel (ex: front url)
        callback_url = getattr(settings, "PAYSTACK_CALLBACK_URL", None)

        # ✅ email utilisateur
        user_email = getattr(request.user, "email", None) or "customer@example.com"

        try:
            resp = paystack_initialize(
    email=user_email,
    amount_cfa=int(booking.amount_to_pay) * 100,  # ✅ FIX PAYSTACK
    reference=reference,
    callback_url=callback_url,
    metadata={"booking_id": booking.id},
)


            # Paystack data.authorization_url
            auth_url = (resp.get("data") or {}).get("authorization_url")

            return Response(
                {
                    "authorization_url": auth_url,
                    "reference": reference,
                    "transaction": PaymentTransactionSerializer(tx).data,
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.exception("PAYSTACK init failed: %s", str(e))
            tx.status = "failed"
            tx.raw = {"error": str(e)}
            tx.save()
            return Response({"detail": "Paystack init failed", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PaystackVerifyView(APIView):
    """
    ✅ Client: verify après callback (ou écran de retour)
    POST /payments/paystack/verify/
    body: { "reference": "..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        reference = request.data.get("reference")
        if not reference:
            return Response({"detail": "reference requis"}, status=status.HTTP_400_BAD_REQUEST)

        tx = get_object_or_404(PaymentTransaction, reference=reference, provider="paystack")
        if tx.status == "success":
                    return Response(
                        {"detail": "payment already verified", "booking_id": booking.id},
                        status=status.HTTP_200_OK
                    )
        booking = tx.booking

        # ✅ sécurité: le client doit être le propriétaire de la réservation
        if booking.user_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        try:
            resp = paystack_verify(reference)
            tx.raw = resp

            data = resp.get("data") or {}
            pay_status = data.get("status")

            if pay_status == "success":
                tx.status = "success"
                

                tx.save()

                # ✅ marquer booking paid + escrow + générer code
                if booking.status in ["awaiting_payment", "approved"]:  # approved ne devrait pas arriver mais safe
                    booking.status = "paid"
                    booking.escrow_amount = int(booking.deposit_amount)

                    # ✅ code clé 6 chiffres hashé
                    # ✅ code clé 6 chiffres (MVP: stocké en clair)
                    code = generate_6_digit_code()
                    booking.key_code = code  #  CHANGE

                    # ✅ expiration: 2 jours après start_date si présent, sinon 48h from now
                    if booking.start_date:
                        booking.key_code_expires_at = timezone.make_aware(
                            timezone.datetime.combine(booking.start_date, timezone.datetime.min.time())
                        ) + timezone.timedelta(days=2)  #  CHANGE: 2 jours
                    else:
                        booking.key_code_expires_at = timezone.now() + timezone.timedelta(hours=48)

                    booking.save()

                    # ✅ notif au client (code affiché côté front via endpoint code)
                    send_push_to_user(
                        booking.user,
                        title="Paiement confirmé",
                        body="Ton acompte est payé. Tu peux récupérer ton code de remise.",
                        data={"type": "booking_paid", "booking_id": booking.id},
                    )

                    return Response(
                        {
                            "detail": "payment verified",
                            "booking_id": booking.id,
                            # ⚠️ IMPORTANT:
                            # On renvoie le code ici UNIQUEMENT si tu veux l'afficher direct.
                            # Sinon on met un endpoint dédié "my-code".
                            "key_code": code,
                            "expires_at": booking.key_code_expires_at,
                        },
                        status=status.HTTP_200_OK
                    )

                return Response({"detail": "payment already processed"}, status=status.HTTP_200_OK)

            tx.status = "failed"
            tx.save()
            return Response({"detail": "payment not successful", "paystack_status": pay_status}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("PAYSTACK verify failed: %s", str(e))
            tx.status = "failed"
            tx.raw = {"error": str(e)}
            tx.save()
            return Response({"detail": "verify failed", "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PaystackWebhookView(APIView):
    """
    ✅ Webhook Paystack (source of truth)
    POST /payments/paystack/webhook/
    - Vérifier x-paystack-signature (HMAC SHA512)
    - Mettre à jour transaction + booking
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = getattr(settings, "PAYSTACK_SECRET_KEY", "")
        signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE", "")

        raw_body = request.body or b""
        computed = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()

        if not hmac.compare_digest(computed, signature):
            return Response({"detail": "invalid signature"}, status=status.HTTP_400_BAD_REQUEST)

        payload = request.data or {}
        event = payload.get("event")
        data = payload.get("data") or {}
        reference = data.get("reference")

        logger.warning("PAYSTACK webhook event=%s ref=%s", event, reference)

        if not reference:
            return Response({"detail": "no reference"}, status=status.HTTP_200_OK)

        try:
            tx = PaymentTransaction.objects.filter(reference=reference, provider="paystack").first()
            if not tx:
                return Response({"detail": "tx not found"}, status=status.HTTP_200_OK)

            tx.raw = payload

            if event == "charge.success":
                tx.status = "success"
                tx.save()

                booking = tx.booking
                if booking.status != "paid" and booking.status == "awaiting_payment":
                    booking.status = "paid"
                    booking.escrow_amount = int(booking.deposit_amount)
                    code = generate_6_digit_code()
                    booking.key_code = code  # ✅ CHANGE

                    # ✅ expiration: 2 jours après start_date si présent, sinon 48h
                    if booking.start_date:
                        booking.key_code_expires_at = timezone.make_aware(
                            timezone.datetime.combine(booking.start_date, timezone.datetime.min.time())
                        ) + timezone.timedelta(days=2)
                    else:
                        booking.key_code_expires_at = timezone.now() + timezone.timedelta(hours=48)
                    booking.save()

                    # ✅ notif client
                    send_push_to_user(
                        booking.user,
                        title="Paiement confirmé",
                        body="Ton acompte est payé. Tu peux récupérer ton code de remise.",
                        data={"type": "booking_paid", "booking_id": booking.id},
                    )

            else:
                # autres events: mark failed si besoin
                tx.save()

            return Response({"ok": True}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("PAYSTACK webhook error: %s", str(e))
            return Response({"ok": True}, status=status.HTTP_200_OK)


# =========================================================
# ✅ KEY VALIDATION (owner) + ADMIN RELEASE
# =========================================================

class OwnerValidateKeyView(APIView):
    """
    ✅ Gérant: saisit code 6 chiffres -> checked_in
    POST /bookings/validate-key/
    body: { "code": "123456" }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookingValidateKeySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        # ✅ notif client
        send_push_to_user(
            booking.user,
            title="Check-in validé",
            body="Le gérant a validé ton arrivée.",
            data={"type": "checked_in", "booking_id": booking.id},
        )

        return Response(BookingPublicSerializer(booking).data, status=status.HTTP_200_OK)


class MyKeyCodeView(APIView):
    """
    ✅ Client: récupérer son code (simple)
    GET /bookings/<id>/my-key-code/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        if booking.user_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if booking.status != "paid":
            return Response({"detail": "Code indisponible pour ce statut."}, status=status.HTTP_400_BAD_REQUEST)

        if not booking.key_code or not booking.key_code_expires_at:
            return Response({"detail": "Code non généré."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.key_code_expires_at < timezone.now():
            return Response({"detail": "Code expiré."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"code": booking.key_code, "expires_at": booking.key_code_expires_at},
            status=status.HTTP_200_OK
        )

class AdminReleaseBookingView(APIView):
    """
    ✅ Admin: reversement manuel -> released
    POST /bookings/<id>/release/
    body: { "payout_reference": "MM-REF-123" }
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        if booking.status != "checked_in":
            return Response({"detail": "Booking doit être CHECKED_IN."}, status=status.HTTP_400_BAD_REQUEST)

        payout_ref = request.data.get("payout_reference") or ""
        if not payout_ref.strip():
            return Response({"detail": "payout_reference requis."}, status=status.HTTP_400_BAD_REQUEST)

        booking.payout_reference = payout_ref
        booking.payout_status = "paid"
        booking.released_at = timezone.now()
        booking.status = "released"
        booking.save()

        # ✅ notif gérant + client
        if booking.listing.author:
            send_push_to_user(
                booking.listing.author,
                title="Reversement effectué",
                body=f"Reversement OK pour booking #{booking.id}.",
                data={"type": "released", "booking_id": booking.id},
            )
        send_push_to_user(
            booking.user,
            title="Réservation terminée",
            body="Reversement effectué au gérant. Merci !",
            data={"type": "released", "booking_id": booking.id},
        )

        return Response(BookingPublicSerializer(booking).data, status=status.HTTP_200_OK)


# =========================================================
# ✅ PWA Push subscription
# =========================================================

class PushSubscribeView(generics.CreateAPIView):
    """
    ✅ Client/Gérant: enregistrer un device pour recevoir notifications PWA
    POST /push/subscribe/
    body:
    {
      "endpoint": "...",
      "keys": {"p256dh":"...", "auth":"..."},
      "user_agent": "..."
    }
    """
    serializer_class = PushSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]


# ✅ ADD at bottom of listings/views.py

from django.contrib.auth import get_user_model  # ✅ NEW
from userauths.models import Profile  # ✅ NEW
from userauths.serializers import SafeUserSerializer  # ✅ NEW

from .serializers import (
    PublicProfileSerializer,
    SellerPageSerializer,
    OwnerDashboardSerializer,
)

UserModel = get_user_model()


class OwnerDashboardMeView(APIView):
    """
    ✅ Gérant (privé): ses infos + ses résidences + stats
    GET /owners/me/dashboard/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # ✅ profile
        profile = Profile.objects.filter(user=request.user).first()

        # ✅ listings du gérant (tous)
        listings_qs = (
            Listing.objects
            .filter(author=request.user)
            .prefetch_related("images")
            .order_by("-date_posted")
        )

        stats = {
            "total_listings": listings_qs.count(),
            "active_listings": listings_qs.filter(is_active=True).count(),
            "inactive_listings": listings_qs.filter(is_active=False).count(),
        }

        payload = {
            "user": SafeUserSerializer(request.user).data,
            "profile": PublicProfileSerializer(profile, context={"request": request}).data if profile else None,
            "listings": ListingSerializer(listings_qs, many=True, context={"request": request}).data,
            "stats": stats,
        }
        return Response(payload, status=status.HTTP_200_OK)


class SellerPublicPageView(APIView):
    """
    ✅ Page vendeur (publique): infos vendeur + ses résidences actives
    GET /sellers/<user_id>/
    """
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id: int):
        seller = get_object_or_404(UserModel, id=user_id)
        profile = Profile.objects.filter(user=seller).first()

        listings_qs = (
            Listing.objects
            .filter(author=seller, is_active=True)  # ✅ public => seulement actives
            .prefetch_related("images")
            .order_by("-date_posted")
        )

        stats = {
            "active_listings": listings_qs.count(),
        }

        payload = {
            "profile": PublicProfileSerializer(profile, context={"request": request}).data if profile else {
                "id": None,
                "user": SafeUserSerializer(seller).data,
                "image_url": None,
                "full_name": seller.full_name or seller.username or seller.email,
                "about": "",
                "city": "",
                "country": "",
                "phone": seller.phone,
            },
            "listings": ListingSerializer(listings_qs, many=True, context={"request": request}).data,
            "stats": stats,
        }
        return Response(payload, status=status.HTTP_200_OK)


class OwnerListingDeleteView(APIView):
    """
    ✅ Delete sécurisé (optionnel).
    Tu peux aussi utiliser ton ListingRetrieveUpdateDestroyView qui le fait déjà.
    DELETE /owners/me/listings/<listing_id>/
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, listing_id: int):
        listing = get_object_or_404(Listing, id=listing_id)

        if listing.author_id != request.user.id:
            return Response({"detail": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        listing.delete()
        return Response({"detail": "Résidence supprimée."}, status=status.HTTP_204_NO_CONTENT)
