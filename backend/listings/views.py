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
from rest_framework.throttling import ScopedRateThrottle
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


import os
import json
import logging
from django.conf import settings
from django.utils import timezone
from pywebpush import webpush, WebPushException
import time
from urllib.parse import urlparse
logger = logging.getLogger("push")  # ✅ utilise le logger "push" du settings.LOGGING


def send_push_to_user(user, title: str, body: str, data: dict = None):
    subs = PushSubscription.objects.filter(user=user)

    logger.info(
        "PUSH_NOTIFY start user=%s subs_count=%s title=%s",
        getattr(user, "id", None),
        subs.count(),
        title,
    )

    if not subs.exists():
        logger.warning("PUSH_NOTIFY no subs for user=%s", getattr(user, "id", None))
        return False

    # ✅ IMPORTANT: on passe un PATH vers le PEM (pas le contenu)
    vapid_private_key_path = getattr(settings, "VAPID_PRIVATE_KEY_PATH", "") or ""
    base_sub = getattr(settings, "VAPID_CLAIMS", {}).get("sub") or "mailto:support@decrouresi.com"

    if not vapid_private_key_path:
        logger.error("VAPID_PRIVATE_KEY_PATH missing in settings")
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
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }

        logger.info(
            "PUSH_NOTIFY try user=%s sub_id=%s endpoint=%s ua=%s",
            getattr(user, "id", None),
            sub.id,
            (sub.endpoint[:80] + "...") if sub.endpoint else None,
            sub.user_agent,
        )

        try:
    # ✅ IMPORTANT: on récupère la réponse HTTP du push service (FCM/APNs)
            # ✅ VAPID claims PRO: aud + exp doivent matcher le push service (FCM vs Apple)
            parsed = urlparse(sub.endpoint)
            aud = f"{parsed.scheme}://{parsed.netloc}"
            claims = {
                "sub": base_sub,
                "aud": aud,
                "exp": int(time.time()) + 60 * 60,  # ✅ 1h (Apple aime les exp courts)
            }
            resp = webpush(
                subscription_info=subscription_info,
                data=json.dumps(payload),
                vapid_private_key=vapid_private_key_path,  # tu passes le PATH -> ok
                vapid_claims=claims,
                ttl=60 * 10,          # ✅ 10 min
                content_encoding="aes128gcm",
            )

            # ✅ LOGS COMPLETS côté serveur push
            logger.info(
                "WEBPUSH resp user=%s sub_id=%s status=%s headers=%s body=%s",
                getattr(user, "id", None),
                sub.id,
                getattr(resp, "status_code", None),
                dict(getattr(resp, "headers", {}) or {}),
                (getattr(resp, "text", "")[:300] if getattr(resp, "text", None) else None),
            )

            sent += 1
            PushSubscription.objects.filter(id=sub.id).update(last_seen_at=timezone.now())

        except WebPushException as ex:
            status_code = getattr(ex.response, "status_code", None)
            resp_text = None
            try:
                resp_text = ex.response.text
            except Exception:
                pass

            if status_code in [404, 410]:
                sub.delete()
                removed += 1
                logger.warning("WEBPUSH expired sub deleted user=%s sub=%s status=%s", user.id, sub.id, status_code)
                continue

            logger.error("WEBPUSH failed user=%s sub=%s status=%s resp=%s", user.id, sub.id, status_code, resp_text)

        except Exception as e:
            logger.exception("WEBPUSH unknown error user=%s sub=%s err=%s", user.id, sub.id, str(e))


    logger.info("PUSH_NOTIFY done user=%s sent=%s removed=%s", user.id, sent, removed)
    return sent > 0

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import logging

push_logger = logging.getLogger("push")

class PushPingView(APIView):
    permission_classes = [AllowAny]  # le SW n'a pas de token JWT simple, donc AllowAny

    def post(self, request, *args, **kwargs):
        push_logger.info("SW_PING received: %s", request.data)
        return Response({"ok": True})
    
    def get(self, request, *args, **kwargs):
        push_logger.info("SW_PING received (GET): %s", dict(request.query_params))
        return Response({"ok": True})

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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "booking_request"

    def perform_create(self, serializer):
        booking = serializer.save()

        # ✅ Notification PWA au gérant (placeholder log)
        owner = booking.listing.author
        if owner:
            try:
                send_push_to_user(
                    owner,
                    title="Nouvelle demande de réservation",
                    body=f"{booking.user} veut réserver {booking.listing.title} ({booking.duration_days} jours)",
                    data={"type": "booking_request", "booking_id": booking.id, "url": "/owner/inbox"},
                )
            except Exception as e:
                # ✅ Ne jamais casser la création booking à cause du push
                logger.exception("PUSH_NOTIFY booking_request failed booking=%s err=%s", booking.id, str(e))


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

# class PushSubscribeView(generics.CreateAPIView):
#     """
#     ✅ Client/Gérant: enregistrer un device pour recevoir notifications PWA
#     POST /push/subscribe/
#     body:
#     {
#       "endpoint": "...",
#       "keys": {"p256dh":"...", "auth":"..."},
#       "user_agent": "..."
#     }
#     """
#     serializer_class = PushSubscriptionSerializer
#     permission_classes = [permissions.IsAuthenticated]

# listings/views.py
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework import status
from .serializers import PushSubscriptionSerializer

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

    def create(self, request, *args, **kwargs):
        # ✅ IMPORTANT: injecter request dans serializer.context
        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


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


# =========================================================
# ✅ ADMIN DASHBOARD ENDPOINTS (paste at end of views.py)
# =========================================================

from datetime import datetime
from django.db import transaction
from django.db.models import Q, Sum, Count, Max, F
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.exceptions import ValidationError, PermissionDenied

from .models import Booking, Listing, PaymentTransaction, Payout, Dispute, DisputeMessage, AuditLog
from .permissions import IsAdminDashboard, IsSupportDashboard, IsPayoutManager

# -------------------------
# Helpers
# -------------------------

def _parse_date(s: str):
    """Parse YYYY-MM-DD -> aware datetime range start/end (UTC)."""
    if not s:
        return None
    try:
        d = datetime.strptime(s, "%Y-%m-%d").date()
        # Start of day in UTC
        return timezone.make_aware(datetime(d.year, d.month, d.day, 0, 0, 0))
    except Exception:
        raise ValidationError({"date": "Format attendu: YYYY-MM-DD"})

def _date_range_from_params(request):
    date_from = _parse_date(request.query_params.get("date_from"))
    date_to = _parse_date(request.query_params.get("date_to"))
    if date_to:
        # end exclusive: +1 day
        date_to = date_to + timezone.timedelta(days=1)
    return date_from, date_to

def _apply_date_filter(qs, field: str, date_from, date_to):
    if date_from:
        qs = qs.filter(**{f"{field}__gte": date_from})
    if date_to:
        qs = qs.filter(**{f"{field}__lt": date_to})
    return qs

def audit(actor, action: str, obj, metadata=None):
    """Create an audit log entry, never fails the main request."""
    try:
        AuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            action=action,
            object_type=obj.__class__.__name__,
            object_id=str(getattr(obj, "id", "")),
            metadata=metadata or {},
        )
    except Exception:
        pass

def ensure_payout_for_booking(booking: Booking, actor=None):
    """Create/ensure payout object when booking becomes checked_in."""
    if booking.status != "checked_in":
        return None

    owner = getattr(booking.listing, "author", None)
    amount = max(int(getattr(booking, "deposit_amount", 0)) - int(getattr(booking, "platform_commission", 0)), 0)

    payout, created = Payout.objects.get_or_create(
        booking=booking,
        defaults={
            "owner": owner,
            "amount": amount,
            "status": "pending",
            "method": "manual",
        },
    )

    if not created:
        # keep amount up-to-date if commission rules changed
        update_fields = []
        if payout.owner_id is None and owner:
            payout.owner = owner
            update_fields.append("owner")
        if payout.amount != amount:
            payout.amount = amount
            update_fields.append("amount")
        if update_fields:
            payout.save(update_fields=update_fields)

    audit(actor, "PAYOUT_ENSURED", booking, {"payout_id": payout.id, "amount": payout.amount})
    return payout


class AdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


# -------------------------
# Lightweight serializers (admin-only)
# (kept inside views.py for speed; you can move later)
# -------------------------

def _booking_card(b: Booking):
    listing = getattr(b, "listing", None)
    owner = getattr(listing, "author", None) if listing else None
    user = getattr(b, "user", None)

    # Prefer image_url if you have it in your serializer; otherwise keep blank
    cover = ""
    try:
        imgs = getattr(listing, "images", None)
        if imgs is not None:
            first = imgs.filter(is_cover=True).first() or imgs.first()
            cover = getattr(first, "image_url", "") or ""
    except Exception:
        pass

    return {
        "id": b.id,
        "status": b.status,
        "created_at": b.created_at,
        "start_date": getattr(b, "start_date", None),
        "end_date": getattr(b, "end_date", None),
        "total_price": getattr(b, "total_price", 0),
        "deposit_amount": getattr(b, "deposit_amount", 0),
        "platform_commission": getattr(b, "platform_commission", 0),
        "payout_amount": getattr(b, "payout_amount", 0),
        "checked_in_at": getattr(b, "checked_in_at", None),
        "listing": {
            "id": listing.id if listing else None,
            "title": getattr(listing, "title", "") if listing else "",
            "city": getattr(listing, "city", "") if listing else "",
            "cover": cover,
        },
        "client": {
            "id": user.id if user else None,
            "full_name": getattr(user, "full_name", "") if user else "",
            "email": getattr(user, "email", "") if user else "",
            "phone": getattr(user, "phone", "") if user else "",
        },
        "owner": {
            "id": owner.id if owner else None,
            "full_name": getattr(owner, "full_name", "") if owner else "",
            "email": getattr(owner, "email", "") if owner else "",
            "phone": getattr(owner, "phone", "") if owner else "",
        },
    }


def _payout_card(p: Payout):
    return {
        "id": p.id,
        "booking_id": p.booking_id,
        "owner_id": p.owner_id,
        "amount": p.amount,
        "status": p.status,
        "method": p.method,
        "reference": p.reference,
        "processed_by_id": p.processed_by_id,
        "processed_at": p.processed_at,
        "created_at": p.created_at,
    }


def _dispute_card(d: Dispute):
    return {
        "id": d.id,
        "booking_id": d.booking_id,
        "title": d.title,
        "category": d.category,
        "priority": d.priority,
        "status": d.status,
        "opened_by_id": d.opened_by_id,
        "assigned_to_id": d.assigned_to_id,
        "last_message_at": d.last_message_at,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


def _audit_card(a: AuditLog):
    return {
        "id": a.id,
        "actor_id": a.actor_id,
        "action": a.action,
        "object_type": a.object_type,
        "object_id": a.object_id,
        "metadata": a.metadata,
        "created_at": a.created_at,
    }


# =========================================================
# 1) METRICS
# =========================================================

class AdminMetricsView(APIView):
    permission_classes = [IsAdminDashboard]
    parser_classes = [JSONParser]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timezone.timedelta(days=7)
        month_start = today_start - timezone.timedelta(days=30)

        qs = Booking.objects.select_related("listing", "user", "listing__author")

        # Count by status (global)
        by_status = dict(
            qs.values("status").annotate(c=Count("id")).values_list("status", "c")
        )

        # Money aggregates (only meaningful for paid/checked_in/released)
        money_qs = qs.filter(status__in=["paid", "checked_in", "released"])
        money = money_qs.aggregate(
            total_deposit=Sum("deposit_amount"),
            total_commission=Sum("platform_commission"),
            total_payout=Sum("payout_amount"),
        )

        # Pending payout amount (based on Payout model if exists, else fallback)
        pending_payout_sum = Payout.objects.filter(status="pending").aggregate(s=Sum("amount"))["s"] or 0

        # “Now to handle”
        to_handle = {
            "awaiting_owner_decision": qs.filter(status="requested").count(),
            "awaiting_payment": qs.filter(status="approved").count(),
            "awaiting_checkin": qs.filter(status="paid").count(),
            "awaiting_payout": qs.filter(status="checked_in").count(),
            "open_disputes": Dispute.objects.filter(status__in=["open", "in_review"]).count(),
        }

        # Recent activity (audit)
        recent_audit = AuditLog.objects.all()[:20]
        recent_audit = [_audit_card(a) for a in recent_audit]

        # Trends by period
        def period_counts(start):
            q = qs.filter(created_at__gte=start)
            return {
                "bookings": q.count(),
                "paid": q.filter(status__in=["paid", "checked_in", "released"]).count(),
                "disputes": Dispute.objects.filter(created_at__gte=start).count(),
            }

        data = {
            "by_status": by_status,
            "money": {
                "total_deposit": money["total_deposit"] or 0,
                "total_commission": money["total_commission"] or 0,
                "total_payout": money["total_payout"] or 0,
                "pending_payout": pending_payout_sum,
            },
            "to_handle": to_handle,
            "periods": {
                "today": period_counts(today_start),
                "last_7_days": period_counts(week_start),
                "last_30_days": period_counts(month_start),
            },
            "recent_activity": recent_audit,
        }
        return Response(data)


# =========================================================
# 2) BOOKINGS (list/detail/override)
# =========================================================

class AdminBookingListView(generics.ListAPIView):
    permission_classes = [IsAdminDashboard]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Booking.objects.select_related("listing", "user", "listing__author").all()

        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(user__email__icontains=q)
                | Q(user__phone__icontains=q)
                | Q(user__username__icontains=q)
                | Q(listing__title__icontains=q)
                | Q(listing__city__icontains=q)
            )

        city = self.request.query_params.get("city")
        if city:
            qs = qs.filter(listing__city__icontains=city)

        owner_id = self.request.query_params.get("owner")
        if owner_id:
            qs = qs.filter(listing__author_id=owner_id)

        listing_id = self.request.query_params.get("listing")
        if listing_id:
            qs = qs.filter(listing_id=listing_id)

        date_from, date_to = _date_range_from_params(self.request)
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        ordering = self.request.query_params.get("ordering") or "-created_at"
        allowed = {"created_at", "-created_at", "deposit_amount", "-deposit_amount", "total_price", "-total_price"}
        if ordering not in allowed:
            ordering = "-created_at"
        return qs.order_by(ordering)

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        data = [_booking_card(b) for b in page]
        return self.get_paginated_response(data)


class AdminBookingDetailView(APIView):
    permission_classes = [IsAdminDashboard]
    parser_classes = [JSONParser]

    def get(self, request, booking_id: int):
        booking = get_object_or_404(
            Booking.objects.select_related("listing", "user", "listing__author"),
            id=booking_id,
        )

        # Payment transactions (if you store them)
        payments = list(
            PaymentTransaction.objects.filter(booking=booking).order_by("-created_at").values(
                "id", "provider", "reference", "amount", "status", "created_at"
            )
        )

        # Payout
        payout = None
        try:
            payout_obj = getattr(booking, "payout", None)
            if payout_obj:
                payout = _payout_card(payout_obj)
        except Exception:
            payout = None

        # Disputes
        disputes = [_dispute_card(d) for d in booking.disputes.all().order_by("-created_at")]

        # Audit
        audit_logs = [_audit_card(a) for a in AuditLog.objects.filter(object_type="Booking", object_id=str(booking.id))[:50]]

        data = _booking_card(booking)
        data.update(
            {
                "payments": payments,
                "payout": payout,
                "disputes": disputes,
                "audit": audit_logs,
            }
        )
        return Response(data)


class AdminBookingOverrideStatusView(APIView):
    permission_classes = [IsSupportDashboard]  # support can override; admin too
    parser_classes = [JSONParser]

    def patch(self, request, booking_id: int):
        booking = get_object_or_404(Booking, id=booking_id)

        new_status = request.data.get("status")
        reason = request.data.get("reason") or ""
        allowed = {"requested", "approved", "paid", "checked_in", "released", "cancelled", "expired"}

        if new_status not in allowed:
            raise ValidationError({"status": "Statut invalide."})

        old = booking.status
        booking.status = new_status

        # minimal timestamp upkeep
        if new_status == "checked_in" and not booking.checked_in_at:
            booking.checked_in_at = timezone.now()
        if new_status == "released" and not booking.released_at:
            booking.released_at = timezone.now()

        booking.save()

        # Ensure payout if checked_in
        if new_status == "checked_in":
            ensure_payout_for_booking(booking, actor=request.user)

        audit(
            request.user,
            "BOOKING_STATUS_OVERRIDDEN",
            booking,
            {"from": old, "to": new_status, "reason": reason},
        )
        return Response({"detail": "Statut mis à jour.", "from": old, "to": new_status})


# =========================================================
# 3) PAYOUTS (list + mark-paid)
# =========================================================

class AdminPayoutListView(generics.ListAPIView):
    permission_classes = [IsPayoutManager]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Payout.objects.select_related("booking", "owner", "processed_by", "booking__listing", "booking__listing__author").all()

        status_q = self.request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)

        owner_id = self.request.query_params.get("owner")
        if owner_id:
            qs = qs.filter(owner_id=owner_id)

        booking_id = self.request.query_params.get("booking")
        if booking_id:
            qs = qs.filter(booking_id=booking_id)

        date_from, date_to = _date_range_from_params(self.request)
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        ordering = self.request.query_params.get("ordering") or "-created_at"
        allowed = {"created_at", "-created_at", "amount", "-amount", "status", "-status"}
        if ordering not in allowed:
            ordering = "-created_at"
        return qs.order_by(ordering)

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        data = [_payout_card(p) for p in page]
        return self.get_paginated_response(data)


class AdminPayoutMarkPaidView(APIView):
    permission_classes = [IsPayoutManager]
    parser_classes = [JSONParser]

    @transaction.atomic
    def post(self, request, payout_id: int):
        payout = get_object_or_404(Payout.objects.select_related("booking"), id=payout_id)

        if payout.status == "paid":
            return Response({"detail": "Déjà payé."}, status=200)

        reference = request.data.get("reference") or ""
        if not reference:
            raise ValidationError({"reference": "Référence requise (preuve / id transfert)."})


        payout.status = "paid"
        payout.reference = reference
        payout.processed_by = request.user
        payout.processed_at = timezone.now()
        payout.save()

        # Update booking payout status too (if you keep that field)
        booking = payout.booking
        try:
            booking.payout_status = "paid"
            booking.released_at = booking.released_at or timezone.now()
            if booking.status != "released":
                booking.status = "released"
            booking.save()
        except Exception:
            pass

        audit(request.user, "PAYOUT_MARKED_PAID", payout, {"reference": reference})
        return Response({"detail": "Reversement marqué payé.", "payout": _payout_card(payout)})


# =========================================================
# 4) DISPUTES (support)
# =========================================================

class AdminDisputeListCreateView(APIView):
    permission_classes = [IsSupportDashboard]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        qs = Dispute.objects.select_related("booking", "opened_by", "assigned_to").all()

        status_q = request.query_params.get("status")
        if status_q:
            qs = qs.filter(status=status_q)

        priority = request.query_params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        assigned_to = request.query_params.get("assigned_to")
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)

        booking_id = request.query_params.get("booking")
        if booking_id:
            qs = qs.filter(booking_id=booking_id)

        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(category__icontains=q)
            )

        date_from, date_to = _date_range_from_params(request)
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        qs = qs.order_by("-created_at")
        # Manual pagination (since we are in APIView)
        paginator = AdminPagination()
        page = paginator.paginate_queryset(qs, request)
        data = [_dispute_card(d) for d in page]
        return paginator.get_paginated_response(data)

    @transaction.atomic
    def post(self, request):
        booking_id = request.data.get("booking_id")
        if not booking_id:
            raise ValidationError({"booking_id": "Requis."})

        booking = get_object_or_404(Booking, id=booking_id)

        d = Dispute.objects.create(
            booking=booking,
            opened_by=request.user,
            assigned_to_id=request.data.get("assigned_to_id") or None,
            category=request.data.get("category") or "general",
            priority=request.data.get("priority") or "normal",
            status="open",
            title=request.data.get("title") or "Réclamation",
            description=request.data.get("description") or "",
            last_message_at=timezone.now(),
        )

        # first message optional
        msg = request.data.get("message")
        if msg:
            DisputeMessage.objects.create(dispute=d, author=request.user, message=msg)

        audit(request.user, "DISPUTE_CREATED", d, {"booking_id": booking_id})
        return Response({"detail": "Réclamation créée.", "dispute": _dispute_card(d)}, status=201)


class AdminDisputeDetailUpdateView(APIView):
    permission_classes = [IsSupportDashboard]
    parser_classes = [JSONParser]

    def get(self, request, pk: int):
        d = get_object_or_404(Dispute.objects.select_related("booking", "opened_by", "assigned_to"), id=pk)
        messages = list(
            d.messages.select_related("author").values(
                "id",
                "author_id",
                "message",
                "attachment",
                "created_at",
            )
        )
        data = _dispute_card(d)
        data["messages"] = messages
        return Response(data)

    @transaction.atomic
    def patch(self, request, pk: int):
        d = get_object_or_404(Dispute, id=pk)

        allowed_status = {"open", "in_review", "resolved", "rejected"}
        allowed_priority = {"low", "normal", "high", "urgent"}

        if "status" in request.data:
            st = request.data.get("status")
            if st not in allowed_status:
                raise ValidationError({"status": "Statut invalide."})
            d.status = st

        if "priority" in request.data:
            pr = request.data.get("priority")
            if pr not in allowed_priority:
                raise ValidationError({"priority": "Priorité invalide."})
            d.priority = pr

        if "assigned_to_id" in request.data:
            d.assigned_to_id = request.data.get("assigned_to_id") or None

        if "title" in request.data:
            d.title = request.data.get("title") or d.title

        if "description" in request.data:
            d.description = request.data.get("description") or d.description

        d.save()
        audit(request.user, "DISPUTE_UPDATED", d, {"fields": list(request.data.keys())})
        return Response({"detail": "Réclamation mise à jour.", "dispute": _dispute_card(d)})


class AdminDisputeAddMessageView(APIView):
    permission_classes = [IsSupportDashboard]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, dispute_id: int):
        d = get_object_or_404(Dispute, id=dispute_id)
        message = request.data.get("message")
        if not message:
            raise ValidationError({"message": "Message requis."})

        m = DisputeMessage.objects.create(
            dispute=d,
            author=request.user,
            message=message,
            attachment=request.FILES.get("attachment"),
        )
        d.last_message_at = timezone.now()
        d.save(update_fields=["last_message_at", "updated_at"])

        audit(request.user, "DISPUTE_MESSAGE_ADDED", d, {"message_id": m.id})
        return Response({"detail": "Message ajouté.", "message_id": m.id}, status=201)


# =========================================================
# 5) AUDIT
# =========================================================

class AdminAuditLogListView(generics.ListAPIView):
    permission_classes = [IsAdminDashboard]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor").all()

        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)

        object_type = self.request.query_params.get("object_type")
        if object_type:
            qs = qs.filter(object_type=object_type)

        object_id = self.request.query_params.get("object_id")
        if object_id:
            qs = qs.filter(object_id=str(object_id))

        actor_id = self.request.query_params.get("actor")
        if actor_id:
            qs = qs.filter(actor_id=actor_id)

        date_from, date_to = _date_range_from_params(self.request)
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        return qs.order_by("-created_at")

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        data = [_audit_card(a) for a in page]
        return self.get_paginated_response(data)


# =========================================================
# 6) STATS
# =========================================================

class AdminStatsOwnerEarningsView(APIView):
    """
    ✅ Gains par gérant, période filtrable.
    - total bookings payés/checked_in/released
    - total montant encaissé (deposit_amount)
    - commission plateforme
    - payout gérant (payout_amount)
    - top listings du gérant
    """
    permission_classes = [IsAdminDashboard]
    parser_classes = [JSONParser]

    def get(self, request):
        date_from, date_to = _date_range_from_params(request)

        qs = Booking.objects.filter(status__in=["paid", "checked_in", "released"]).select_related("listing", "listing__author")
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        owner_id = request.query_params.get("owner")
        if owner_id:
            qs = qs.filter(listing__author_id=owner_id)

        listing_id = request.query_params.get("listing")
        if listing_id:
            qs = qs.filter(listing_id=listing_id)

        # Group by owner
        rows = (
            qs.values(
                "listing__author_id",
                "listing__author__full_name",
                "listing__author__email",
                "listing__author__phone",
            )
            .annotate(
                bookings=Count("id"),
                total_deposit=Sum("deposit_amount"),
                total_commission=Sum("platform_commission"),
                total_payout=Sum("payout_amount"),
                last_booking=Max("created_at"),
            )
            .order_by("-total_payout", "-bookings")
        )

        # Optional: top listings per owner (small)
        include_listings = request.query_params.get("include_listings") == "1"
        owners = []
        for r in rows[:500]:
            item = {
                "owner_id": r["listing__author_id"],
                "owner_full_name": r["listing__author__full_name"],
                "owner_email": r["listing__author__email"],
                "owner_phone": r["listing__author__phone"],
                "bookings": r["bookings"] or 0,
                "total_deposit": r["total_deposit"] or 0,
                "total_commission": r["total_commission"] or 0,
                "total_payout": r["total_payout"] or 0,
                "last_booking": r["last_booking"],
            }

            if include_listings and item["owner_id"]:
                top = (
                    qs.filter(listing__author_id=item["owner_id"])
                    .values("listing_id", "listing__title", "listing__city")
                    .annotate(
                        bookings=Count("id"),
                        total_payout=Sum("payout_amount"),
                        total_deposit=Sum("deposit_amount"),
                    )
                    .order_by("-bookings", "-total_payout")[:10]
                )
                item["top_listings"] = list(top)

            owners.append(item)

        return Response(
            {
                "date_from": request.query_params.get("date_from"),
                "date_to": request.query_params.get("date_to"),
                "count": len(owners),
                "results": owners,
            }
        )


class AdminStatsTopListingsView(APIView):
    """
    ✅ Résidences les plus louées entre X et Y
    - nb de locations
    - montant total encaissé
    - payout gérant
    - commission plateforme
    """
    permission_classes = [IsAdminDashboard]
    parser_classes = [JSONParser]

    def get(self, request):
        date_from, date_to = _date_range_from_params(request)
        limit = int(request.query_params.get("limit") or 10)
        limit = max(1, min(limit, 100))

        qs = Booking.objects.filter(status__in=["paid", "checked_in", "released"]).select_related("listing", "listing__author")
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        city = request.query_params.get("city")
        if city:
            qs = qs.filter(listing__city__icontains=city)

        rows = (
            qs.values(
                "listing_id",
                "listing__title",
                "listing__city",
                "listing__author_id",
                "listing__author__full_name",
            )
            .annotate(
                bookings=Count("id"),
                total_deposit=Sum("deposit_amount"),
                total_commission=Sum("platform_commission"),
                total_payout=Sum("payout_amount"),
            )
            .order_by("-bookings", "-total_deposit")[:limit]
        )

        return Response(
            {
                "date_from": request.query_params.get("date_from"),
                "date_to": request.query_params.get("date_to"),
                "limit": limit,
                "results": list(rows),
            }
        )


class AdminStatsPlatformProfitView(APIView):
    """
    ✅ Profit plateforme global sur période
    - total encaissé (deposit_amount)
    - total commission (bénéfice brut plateforme)
    - total payouts gérants
    - pending payouts (via Payout model)
    """
    permission_classes = [IsAdminDashboard]
    parser_classes = [JSONParser]

    def get(self, request):
        date_from, date_to = _date_range_from_params(request)

        qs = Booking.objects.filter(status__in=["paid", "checked_in", "released"])
        qs = _apply_date_filter(qs, "created_at", date_from, date_to)

        agg = qs.aggregate(
            total_deposit=Sum("deposit_amount"),
            total_commission=Sum("platform_commission"),
            total_payout=Sum("payout_amount"),
            bookings=Count("id"),
        )

        # Pending payouts in same date range (optional)
        payout_qs = Payout.objects.all().select_related("booking")
        if date_from or date_to:
            payout_qs = payout_qs.filter(booking__in=qs.values("id"))
        pending_payout = payout_qs.filter(status="pending").aggregate(s=Sum("amount"))["s"] or 0
        paid_payout = payout_qs.filter(status="paid").aggregate(s=Sum("amount"))["s"] or 0

        return Response(
            {
                "date_from": request.query_params.get("date_from"),
                "date_to": request.query_params.get("date_to"),
                "bookings": agg["bookings"] or 0,
                "total_deposit": agg["total_deposit"] or 0,
                "platform_profit_commission": agg["total_commission"] or 0,
                "total_payout_to_owners": agg["total_payout"] or 0,
                "pending_payout": pending_payout,
                "paid_payout": paid_payout,
            }
        )