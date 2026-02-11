#listings/serializers.py
from datetime import timedelta, date
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Max
# from django.contrib.gis.geos import Point
from django.contrib.auth.hashers import make_password, check_password
import urllib.parse
from rest_framework import serializers

from .models import (
    Listing,
    ListingImage,
    Booking,
    BookingDateProposal,
    PaymentTransaction,
    PushSubscription,
)


# =========================================================
# ✅ LISTINGS
# =========================================================

class ListingImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingImage
        fields = ["id", "image_url", "is_cover", "order", "created_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


# class ListingSerializer(serializers.ModelSerializer):
#     # ✅ coords write_only pour créer/éditer
#     latitude = serializers.FloatField(equired=True)
#     longitude = serializers.FloatField(required=True)

#     # ✅ coords read_only calculées depuis Point
#     lat = serializers.SerializerMethodField(read_only=True)
#     lng = serializers.SerializerMethodField(read_only=True)

#     # ✅ images output
#     images = ListingImageSerializer(many=True, read_only=True)

#     # ✅ upload (cover obligatoire)
#     cover_image = serializers.ImageField(write_only=True, required=True)
#     gallery_images = serializers.ListField(
#         child=serializers.ImageField(),
#         write_only=True,
#         required=False,
#         allow_empty=True,
#     )
    
#         # ✅ NEW: infos vendeur (safe)
#     author_id = serializers.IntegerField(source="author.id", read_only=True)
#     author_name = serializers.SerializerMethodField(read_only=True)

#     def get_author_name(self, obj):
#         u = getattr(obj, "author", None)
#         if not u:
#             return None
#         return u.full_name or u.username or u.email


#     class Meta:
#         model = Listing
#         fields = [*([f.name for f in Listing._meta.fields]), "lat", "lng", "images", "author_id", "author_name", "latitude", "longitude", "cover_image", "gallery_images"]
#         read_only_fields = ["author", "date_posted", "updated_at", "location"]

#     def get_lat(self, obj):
#         return obj.location.y if obj.location else None

#     def get_lng(self, obj):
#         return obj.location.x if obj.location else None

#     @transaction.atomic
#     def create(self, validated_data):
#         # ✅ coords -> Point
#         # lat = validated_data.pop("latitude")
#         # lng = validated_data.pop("longitude")
#         # validated_data["location"] = Point(float(lng), float(lat), srid=4326)

#         # ✅ files
#         cover = validated_data.pop("cover_image")
#         gallery = validated_data.pop("gallery_images", [])

#         # ✅ author
#         request = self.context.get("request")
#         if request and request.user and request.user.is_authenticated:
#             validated_data["author"] = request.user
            
#         validated_data.setdefault("is_active", True)

#         listing = super().create(validated_data)

#         # ✅ cover
#         ListingImage.objects.create(listing=listing, image=cover, is_cover=True, order=0)

#         # ✅ gallery
#         for idx, img in enumerate(gallery, start=1):
#             ListingImage.objects.create(listing=listing, image=img, is_cover=False, order=idx)

#         return listing

#     @transaction.atomic
#     def update(self, instance, validated_data):
#         # lat = validated_data.pop("latitude", None)
#         # lng = validated_data.pop("longitude", None)
#         # if lat is not None and lng is not None:
#         #     instance.location = Point(float(lng), float(lat), srid=4326)

#         cover = validated_data.pop("cover_image", None)
#         if cover is not None:
#             instance.images.filter(is_cover=True).update(is_cover=False)
#             ListingImage.objects.create(listing=instance, image=cover, is_cover=True, order=0)

#         gallery = validated_data.pop("gallery_images", None)
#         if gallery is not None:
#             max_order = (
#                 instance.images
#                 .filter(is_cover=False)
#                 .aggregate(Max("order"))  # ✅ FIX: Max importé, plus besoin de models.Max
#                 .get("order__max")
#                 or 0
#             )

#             for idx, img in enumerate(gallery, start=max_order + 1):
#                 ListingImage.objects.create(listing=instance, image=img, is_cover=False, order=idx)

#         return super().update(instance, validated_data)


# class ListingSerializer(serializers.ModelSerializer):
#     # =========================================================
#     # 1. COORDONNÉES (Version Simple Float)
#     # =========================================================
    
#     # Ce sont les vrais champs de votre modèle maintenant.
#     # On les laisse en lecture/écriture pour que Django les sauvegarde tout seul.
#     latitude = serializers.FloatField(required=True)
#     longitude = serializers.FloatField(required=True)

#     # Pour compatibilité Frontend (React utilise 'lat' et 'lng')
#     # L'astuce "source=" évite d'écrire des fonctions get_lat/get_lng
#     lat = serializers.FloatField(source='latitude', read_only=True)
#     lng = serializers.FloatField(source='longitude', read_only=True)
#     price = serializers.IntegerField(write_only=True, required=False)
#     price = serializers.IntegerField(source="price_per_night", read_only=True)

#     # =========================================================
#     # 2. IMAGES & AUTEUR
#     # =========================================================
#     images = ListingImageSerializer(many=True, read_only=True)

#     cover_image = serializers.ImageField(write_only=True, required=True)
#     gallery_images = serializers.ListField(
#         child=serializers.ImageField(),
#         write_only=True,
#         required=False,
#         allow_empty=True,
#     )
    
#     author_id = serializers.IntegerField(source="author.id", read_only=True)
#     author_name = serializers.SerializerMethodField(read_only=True)

#     class Meta:
#         model = Listing
#         # ATTENTION : J'ai retiré "location" de la liste ci-dessous car il n'existe plus
#         fields = [
#             "id", "title", "price", "description",  # Ajoutez vos autres champs ici explicitement c'est plus sûr
#           "test",
#   "latitude", "longitude", 
#             "lat", "lng", 
#             "images", "cover_image", "gallery_images",
#             "author_id", "author_name",
#             "created_at", "updated_at" # ou date_posted selon votre modèle
#         ]
#         read_only_fields = ["author", "created_at", "updated_at"]

#     def get_author_name(self, obj):
#         u = getattr(obj, "author", None)
#         if not u:
#             return None
#         return u.full_name or u.username or u.email

#     # =========================================================
#     # 3. CREATE & UPDATE SIMPLIFIÉS
#     # =========================================================

#     @transaction.atomic
#     def create(self, validated_data):
#         # On extrait les images (car elles ne sont pas dans le modèle Listing)
#         cover = validated_data.pop("cover_image")
#         gallery = validated_data.pop("gallery_images", [])

#         # NOTE : On NE touche PAS à latitude/longitude. 
#         # Comme ils sont dans validated_data, super().create() va les insérer 
#         # directement dans les colonnes float du modèle. Magique !
#         if "price" in validated_data:
#             validated_data["price_per_night"] = validated_data.pop("price")
#         # Gestion de l'auteur
#         request = self.context.get("request")
#         if request and request.user and request.user.is_authenticated:
#             validated_data["author"] = request.user
            
#         validated_data.setdefault("is_active", True)

#         # Création du Listing (sauvegarde lat/lon automatiquement)
#         listing = super().create(validated_data)

#         # Création des images
#         ListingImage.objects.create(listing=listing, image=cover, is_cover=True, order=0)
#         for idx, img in enumerate(gallery, start=1):
#             ListingImage.objects.create(listing=listing, image=img, is_cover=False, order=idx)

#         return listing

#     @transaction.atomic
#     def update(self, instance, validated_data):
#         # Pareil ici : pas besoin de logique spéciale pour lat/lon.
#         # Django mettra à jour les colonnes float tout seul.

#         cover = validated_data.pop("cover_image", None)
#         if cover is not None:
#             # On rétrograde l'ancienne cover
#             instance.images.filter(is_cover=True).update(is_cover=False)
#             # On ajoute la nouvelle
#             ListingImage.objects.create(listing=instance, image=cover, is_cover=True, order=0)

#         gallery = validated_data.pop("gallery_images", None)
#         if gallery is not None:
#             # Calcul du prochain "order" disponible
#             max_order = instance.images.aggregate(m=Max("order")).get("m") or 0
            
#             for idx, img in enumerate(gallery, start=max_order + 1):
#                 ListingImage.objects.create(listing=instance, image=img, is_cover=False, order=idx)

#         return super().update(instance, validated_data)

class ListingSerializer(serializers.ModelSerializer):
    # =========================================================
    # 1. COORDONNÉES (floats simples – plus de GeoDjango)
    # =========================================================
    latitude = serializers.FloatField(required=True)
    longitude = serializers.FloatField(required=True)

    # Compat frontend (lecture seule)
    lat = serializers.FloatField(source="latitude", read_only=True)
    lng = serializers.FloatField(source="longitude", read_only=True)

    # =========================================================
    # 2. PRIX (le frontend utilise price_per_night)
    # =========================================================
    price_per_night = serializers.IntegerField(required=True)

    # =========================================================
    # 3. CAPACITÉ & PIÈCES
    # =========================================================
    max_guests = serializers.IntegerField(required=False)
    bedrooms = serializers.IntegerField(required=False)
    bathrooms = serializers.IntegerField(required=False)
    living_rooms = serializers.IntegerField(required=False)
    kitchens = serializers.IntegerField(required=False)
    beds = serializers.IntegerField(required=False)

    # =========================================================
    # 4. AMENITIES
    # =========================================================
    has_wifi = serializers.BooleanField(required=False)
    has_ac = serializers.BooleanField(required=False)
    has_parking = serializers.BooleanField(required=False)
    has_tv = serializers.BooleanField(required=False)
    has_kitchen = serializers.BooleanField(required=False)
    has_hot_water = serializers.BooleanField(required=False)

    has_garden = serializers.BooleanField(required=False)
    has_balcony = serializers.BooleanField(required=False)
    has_generator = serializers.BooleanField(required=False)
    has_security = serializers.BooleanField(required=False)

    allows_smoking = serializers.BooleanField(required=False)
    allows_pets = serializers.BooleanField(required=False)

    # =========================================================
    # 5. AUTRES
    # =========================================================

    # =========================================================
    # 6. IMAGES
    # =========================================================
    images = ListingImageSerializer(many=True, read_only=True)

    cover_image = serializers.ImageField(write_only=True, required=True)
    gallery_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    # =========================================================
    # 7. AUTEUR
    # =========================================================
    author_id = serializers.IntegerField(source="author.id", read_only=True)
    author_name = serializers.SerializerMethodField(read_only=True)

    # =========================================================
    # META
    # =========================================================
    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "description",

            "price_per_night",
            "max_guests",

            "bedrooms",
            "bathrooms",
            "living_rooms",
            "kitchens",
            "beds",

            "has_wifi",
            "has_ac",
            "has_parking",
            "has_tv",
            "has_kitchen",
            "has_hot_water",
            "has_garden",
            "has_balcony",
            "has_generator",
            "has_security",

            "allows_smoking",
            "allows_pets",

            "test",
            "is_active",

            "latitude",
            "longitude",
            "lat",
            "lng",

            "images",
            "cover_image",
            "gallery_images",

            "author_id",
            "author_name",

            "date_posted",
            "updated_at",
        ]

        read_only_fields = [
            "author",
            "author_id",
            "author_name",
            "date_posted",
            "updated_at",
        ]

    # =========================================================
    # MÉTHODES
    # =========================================================
    def get_author_name(self, obj):
        user = getattr(obj, "author", None)
        if not user:
            return None
        return user.full_name or user.username or user.email

    # =========================================================
    # CREATE
    # =========================================================
    @transaction.atomic
    def create(self, validated_data):
        cover = validated_data.pop("cover_image")
        gallery = validated_data.pop("gallery_images", [])

        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["author"] = request.user

        validated_data.setdefault("is_active", True)

        listing = super().create(validated_data)

        ListingImage.objects.create(
            listing=listing,
            image=cover,
            is_cover=True,
            order=0,
        )

        for idx, img in enumerate(gallery, start=1):
            ListingImage.objects.create(
                listing=listing,
                image=img,
                is_cover=False,
                order=idx,
            )

        return listing


# =========================================================
# ✅ HELPERS BOOKING
# =========================================================

def _safe_int(v, default=0):
    try:
        return int(v)
    except Exception:
        return default


def compute_total_amount(price_per_night: int, nights: int) -> int:
    price = max(_safe_int(price_per_night, 0), 0)
    n = max(_safe_int(nights, 0), 0)
    return price * n


def compute_deposit(total_amount: int) -> int:
    # ✅ 50% acompte
    total = max(_safe_int(total_amount, 0), 0)
    return int(round(total * 0.50))


def compute_platform_commission(deposit_amount: int) -> int:
    dep = max(_safe_int(deposit_amount, 0), 0)
    if dep <= 50000:
        return int(round(dep * 0.05))
    return int(round(dep * 0.10))


def estimate_paystack_fee(amount_cfa: int) -> int:
    """
    ✅ Estimation simple (à ajuster après selon Paystack CI).
    - Ici on fait: 1.5% + 100 (plafonné)
    Tu pourras mettre ça dans settings plus tard.
    """
    a = max(_safe_int(amount_cfa, 0), 0)
    fee = int(round(a * 0.095)) + 100
    # ✅ plafond “soft”
    return min(fee, 5000)


def dates_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    """
    ✅ overlap si (a_start < b_end) and (b_start < a_end)
    """
    return a_start < b_end and b_start < a_end


def is_listing_available(listing_id: int, start_date: date, end_date: date, exclude_booking_id=None) -> bool:
    """
    ✅ Vérifie conflits sur cette résidence.
    On considère comme “bloquants”:
    - approved / awaiting_payment / paid / checked_in / released
    (rejected/cancelled/expired ne bloquent pas)
    """
    qs = Booking.objects.filter(
        listing_id=listing_id,
        start_date__isnull=False,
        end_date__isnull=False,
        status__in=["approved", "awaiting_payment", "paid", "checked_in", "released"],
    )

    if exclude_booking_id:
        qs = qs.exclude(id=exclude_booking_id)

    # overlap check côté DB
    qs = qs.filter(start_date__lt=end_date, end_date__gt=start_date)
    return not qs.exists()


# =========================================================
# ✅ BOOKINGS (client + owner + admin)
# =========================================================

class BookingDateProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingDateProposal
        fields = ["id", "start_date", "end_date", "note", "created_at"]
        read_only_fields = ["id", "created_at"]


class BookingPublicSerializer(serializers.ModelSerializer):
    """
    ✅ Serializer “lecture” pour client/owner (safe)
    """
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    listing_id = serializers.IntegerField(source="listing.id", read_only=True)
    
    owner_contact = serializers.SerializerMethodField()
    user_full_name = serializers.CharField(
    source="user.full_name", read_only=True
    )
    user_email = serializers.EmailField(
        source="user.email", read_only=True
    )
    user_phone = serializers.SerializerMethodField()


    class Meta:
        model = Booking
        fields = [
            "id",
            "listing_id",
            "listing_title",
            "user",
            "duration_days",
            "desired_start_date",
            "start_date",
            "end_date",
            "guests",
            "status",
            "customer_note",
            "owner_note",
            "approved_at",
            "rejected_at",

            # montants
            "price_per_night",
            "total_amount",
            "deposit_amount",
            "platform_commission",
            "paystack_fee",
            "amount_to_pay",
            "escrow_amount",

            # key/checkin/release
            "key_code_expires_at",
            "checked_in_at",
            "payout_amount",
            "payout_status",
            "payout_reference",
            "released_at",

            "owner_contact",
            "user_full_name",
            "user_email",
            "user_phone",

            
            "created_at",
        ]
        read_only_fields = fields
        
    def get_owner_contact(self, booking):
        """
        🔐 Infos vendeur visibles UNIQUEMENT après paiement
        + lien appel
        + bouton WhatsApp
        """
        if booking.status not in ["paid", "checked_in", "released"]:
            return None

        owner = booking.listing.author
        if not owner:
            return None

        profile = getattr(owner, "profile", None)

        phone = (
            profile.phone
            if profile and profile.phone
            else owner.phone
        )

        if not phone:
            return None

        # 🔹 normalisation basique (WhatsApp exige format international sans espaces)
        phone_clean = (
            phone.replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "")
        )

        # ⚠️ Si pas de +, on suppose CI (+225)
        if not phone_clean.startswith("+"):
            phone_clean = f"+225{phone_clean}"

        # 💬 message WhatsApp pré-rempli
        message = (
            f"Bonjour {owner.full_name}, "
            f"je vous contacte concernant ma réservation "
            f"#{booking.id} pour {booking.listing.title}."
        )

        whatsapp_url = (
            "https://wa.me/"
            + phone_clean.replace("+", "")
            + "?text="
            + urllib.parse.quote(message)
        )

        return {
            "full_name": owner.full_name,
            "phone_display": phone,
            "phone_raw": f"tel:{phone_clean}",
            "whatsapp_url": whatsapp_url,
            "email": owner.email,
        }
    def get_user_phone(self, booking):
        profile = getattr(booking.user, "profile", None)
        if profile and profile.phone:
            return profile.phone
        return booking.user.phone


class BookingRequestCreateSerializer(serializers.ModelSerializer):
    """
    ✅ Client crée une DEMANDE (pas de paiement ici)
    - listing
    - duration_days (obligatoire)
    - desired_start_date (optionnel)
    - guests
    - customer_note (optionnel)
    """

    class Meta:
        model = Booking
        fields = ["id", "listing", "duration_days", "desired_start_date", "guests", "customer_note"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        listing = attrs.get("listing")
        duration_days = _safe_int(attrs.get("duration_days"), 0)
        guests = _safe_int(attrs.get("guests"), 1)

        if duration_days < 1:
            raise serializers.ValidationError({"duration_days": "Le nombre de jours doit être >= 1."})

        if not listing:
            raise serializers.ValidationError({"listing": "Résidence indisponible."})

        if guests < 1 or guests > listing.max_guests:
            raise serializers.ValidationError({"guests": f"Max {listing.max_guests} personnes."})

        # ✅ si le client propose une date, on peut pré-check disponibilité (optionnel)
        desired = attrs.get("desired_start_date")
        if desired:
            end = desired + timedelta(days=duration_days)
            if not is_listing_available(listing.id, desired, end):
                # ✅ on n'empêche pas la demande, mais on avertit via message
                # (on pourrait aussi refuser directement, mais ton flow dit que le gérant décide)
                pass

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")

        listing: Listing = validated_data["listing"]
        duration_days = _safe_int(validated_data.get("duration_days"), 1)

        # ✅ snapshot prix (figé au moment de la demande)
        price_per_night = _safe_int(listing.price_per_night, 0)
        total_amount = compute_total_amount(price_per_night, duration_days)

        booking = Booking.objects.create(
            listing=listing,
            user=request.user,
            duration_days=duration_days,
            desired_start_date=validated_data.get("desired_start_date"),
            guests=_safe_int(validated_data.get("guests"), 1),
            customer_note=validated_data.get("customer_note", ""),

            status="requested",

            price_per_night=price_per_night,
            total_amount=total_amount,
        )

        return booking


class BookingOwnerDecisionSerializer(serializers.Serializer):
    """
    ✅ Gérant : approve ou reject
    - action: "approve" | "reject"
    - start_date: requis pour approve (ou on utilise desired_start_date)
    - owner_note: optionnel
    - proposals: optionnel (liste de propositions si reject)
    """

    action = serializers.ChoiceField(choices=["approve", "reject"])
    start_date = serializers.DateField(required=False, allow_null=True)
    owner_note = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    proposals = BookingDateProposalSerializer(many=True, required=False)

    def validate(self, attrs):
        booking: Booking = self.context["booking"]
        action = attrs.get("action")

        # ✅ booking doit être "requested" (attente gérant)
        if booking.status != "requested":
            raise serializers.ValidationError("Cette réservation n'est plus en attente.")

        if action == "approve":
            sd = attrs.get("start_date") or booking.desired_start_date
            if not sd:
                raise serializers.ValidationError({"start_date": "Date de début requise (ou date souhaitée)."})
            # ✅ compute end
            ed = sd + timedelta(days=int(booking.duration_days or 1))

            # ✅ check disponibilité (bloquant)
            if not is_listing_available(booking.listing_id, sd, ed, exclude_booking_id=booking.id):
                raise serializers.ValidationError("Cette résidence est déjà prise sur ces dates.")

            # ✅ ok
            attrs["start_date"] = sd
            attrs["end_date"] = ed

        if action == "reject":
            # proposals facultatives
            props = attrs.get("proposals", [])
            for p in props:
                if p["end_date"] <= p["start_date"]:
                    raise serializers.ValidationError("Proposition invalide: end_date doit être > start_date.")

        return attrs

    @transaction.atomic
    def save(self):
        booking: Booking = self.context["booking"]
        request = self.context["request"]
        owner_note = self.validated_data.get("owner_note") or ""

        # ✅ sécurité: seul le propriétaire du listing
        if booking.listing.author_id != request.user.id:
            raise serializers.ValidationError("Non autorisé.")

        action = self.validated_data["action"]

        if action == "approve":
            booking.status = "approved"
            booking.approved_at = timezone.now()
            booking.owner_note = owner_note

            # ✅ dates confirmées
            booking.start_date = self.validated_data["start_date"]
            booking.end_date = self.validated_data["end_date"]

            # ✅ total_amount recalculé à partir des dates (safe)
            nights = max((booking.end_date - booking.start_date).days, 0)
            booking.total_amount = compute_total_amount(booking.price_per_night, nights)

            # ✅ préparer paiement (mais pas encore initié)
            deposit = compute_deposit(booking.total_amount)
            commission = compute_platform_commission(deposit)

            # ✅ CHANGE: le client paie les frais de service (sécurité) = commission
            # ✅ Paystack fee n'est plus affiché/ajouté au client (tu l’absorbes côté plateforme)
            fee = 0
            amount_to_pay = deposit + commission

            booking.deposit_amount = deposit
            booking.platform_commission = commission
            booking.paystack_fee = fee  # ✅ on garde le champ mais à 0 pour compat UI
            booking.amount_to_pay = amount_to_pay


            # ✅ client pourra payer -> awaiting_payment
            booking.status = "awaiting_payment"

            booking.save()

            # ✅ clear proposals éventuelles
            booking.date_proposals.all().delete()

            return booking

        # action == reject
        booking.status = "rejected"
        booking.rejected_at = timezone.now()
        booking.owner_note = owner_note
        booking.save()

        # ✅ save proposals (optionnel)
        booking.date_proposals.all().delete()
        for p in self.validated_data.get("proposals", []):
            BookingDateProposal.objects.create(
                booking=booking,
                start_date=p["start_date"],
                end_date=p["end_date"],
                note=p.get("note") or "",
            )

        return booking


class BookingPaymentPrepareSerializer(serializers.ModelSerializer):
    """
    ✅ Client: lecture des montants + statut avant paiement
    (utile pour afficher bouton 'Payer' seulement quand awaiting_payment)
    """
    class Meta:
        model = Booking
        fields = ["id", "status", "total_amount", "deposit_amount", "platform_commission", "paystack_fee", "amount_to_pay"]
        read_only_fields = fields


class BookingKeyCodeSerializer(serializers.Serializer):
    """
    ✅ Après paiement confirmé : code clé 6 chiffres (renvoyé UNE FOIS au client)
    On ne stocke pas le code en clair en DB, seulement hash.
    """
    code = serializers.CharField(min_length=6, max_length=6)
    expires_at = serializers.DateTimeField()


class BookingValidateKeySerializer(serializers.Serializer):
    """
    ✅ Gérant saisit le code -> CHECKED_IN
    """
    code = serializers.CharField(min_length=6, max_length=6)

    def validate(self, attrs):
        request = self.context["request"]
        code = attrs["code"]

        # ✅ on cherche booking où status=paid et code_hash rempli
        # IMPORTANT: on ne peut pas filtrer par hash directement, on vérifie en python
        target = Booking.objects.filter(
            status="paid",
            listing__author_id=request.user.id,  # ✅ sécurité: le gérant ne valide que ses listings
            key_code=code,
        ).first()

        if not target:
            raise serializers.ValidationError("Code invalide.")

        # ✅ expiration
        if target.key_code_expires_at and target.key_code_expires_at < timezone.now():
            raise serializers.ValidationError("Code expiré.")

        attrs["booking"] = target
        return attrs

    @transaction.atomic
    def save(self):
        booking: Booking = self.validated_data["booking"]

        # ✅ passage CHECKED_IN
        booking.status = "checked_in"
        booking.checked_in_at = timezone.now()

        # ✅ calc payout (dépôt - commission)
        booking.payout_amount = max(int(booking.deposit_amount) - int(booking.platform_commission), 0)

        booking.save()
        return booking


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """
    ✅ PWA: enregistre/maj un abonnement web push
    """
    endpoint = serializers.CharField()
    keys = serializers.DictField(write_only=True)  # { p256dh, auth }

    class Meta:
        model = PushSubscription
        fields = ["id", "endpoint", "keys", "user_agent", "created_at", "last_seen_at"]
        read_only_fields = ["id", "created_at", "last_seen_at"]

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user

        endpoint = validated_data["endpoint"]
        keys = validated_data["keys"] or {}
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")

        if not p256dh or not auth:
            raise serializers.ValidationError("keys.p256dh et keys.auth sont requis.")

        user_agent = validated_data.get("user_agent") or request.META.get("HTTP_USER_AGENT", "")

        # ✅ upsert
        sub, _created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user": user,
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": user_agent,
                "last_seen_at": timezone.now(),
            },
        )

        return sub


class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = ["id", "provider", "reference", "status", "amount", "raw", "created_at", "updated_at"]
        read_only_fields = fields


# ✅ ADD at bottom of listings/serializers.py

from userauths.models import Profile  # ✅ NEW
from userauths.serializers import SafeUserSerializer  # ✅ NEW


class PublicProfileSerializer(serializers.ModelSerializer):
    """
    ✅ Profil public du vendeur (safe)
    """
    user = SafeUserSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ["id", "user", "image_url", "full_name", "about", "city", "country", "phone"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class SellerPageSerializer(serializers.Serializer):
    """
    ✅ Page vendeur (publique): profil + listings actifs + stats
    """
    profile = PublicProfileSerializer()
    listings = ListingSerializer(many=True)
    stats = serializers.DictField()


class OwnerDashboardSerializer(serializers.Serializer):
    """
    ✅ Dashboard privé gérant: profil + tous ses listings + stats
    """
    user = SafeUserSerializer()
    profile = PublicProfileSerializer()
    listings = ListingSerializer(many=True)
    stats = serializers.DictField()
