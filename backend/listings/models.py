#listings/models.py
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator
# from django.contrib.gis.db.models import PointField
# from django.contrib.gis.geos import Point
from django.db.models import Q

User = settings.AUTH_USER_MODEL


LISTING_TYPES = (
    ("studio", "Studio"),
    ("appartement", "Appartement"),
    ("maison", "Maison"),
    ("villa", "Villa"),
    ("chambre", "Chambre"),
)

# ✅ NEW: statut complet (demande -> validation gérant -> paiement -> checkin -> release)
BOOKING_STATUS = (
    ("requested", "Demande envoyée (en attente gérant)"),
    ("rejected", "Refusée (déjà pris / indisponible)"),
    ("approved", "Acceptée (client peut payer)"),
    ("awaiting_payment", "En attente de paiement"),
    ("paid", "Acompte payé (escrow plateforme)"),
    ("checked_in", "Client arrivé (code validé)"),
    ("released", "Reversement effectué (admin)"),
    ("cancelled", "Annulée"),
    ("expired", "Expirée"),
)

PAYOUT_STATUS = (
    ("unpaid", "Non payé"),
    ("paid", "Payé"),
)

PAYMENT_STATUS = (
    ("initiated", "Initiée"),
    ("success", "Réussie"),
    ("failed", "Échouée"),
)

PAYMENT_PROVIDER = (
    ("paystack", "Paystack"),
)


class Listing(models.Model):
    author = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="listings")

    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)

    # Localisation (auto-remplie via reverse geocode mais editable)
    city = models.CharField(max_length=80, blank=True, null=True)
    area = models.CharField(max_length=50, blank=True, null=True)           # ✅ élargi (commune/zone)
    borough = models.CharField(max_length=80, blank=True, null=True)
    address_label = models.CharField(max_length=255, blank=True, null=True)

    # location = PointField(blank=True, null=True, srid=4326)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)

    listing_type = models.CharField(max_length=20, choices=LISTING_TYPES, default="appartement")
    price_per_night = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])  # CFA
    max_guests = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    # ✅ NEW: pièces (très demandés)
    bedrooms = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0)])      # nb chambres
    bathrooms = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0)])     # nb douches/sdb
    living_rooms = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0)])  # nb salons
    kitchens = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0)])      # nb cuisines

    # ✅ NEW: couchage (utile)
    beds = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0)])          # nb lits

    test = models.BooleanField(default=False)

    # Amenities
    has_wifi = models.BooleanField(default=False)
    has_ac = models.BooleanField(default=False)
    has_parking = models.BooleanField(default=False)
    has_tv = models.BooleanField(default=False)
    has_kitchen = models.BooleanField(default=False)
    has_hot_water = models.BooleanField(default=False)
    
    # ✅ NEW: extérieurs + énergie + sécurité (checkbox)
    has_garden = models.BooleanField(default=False)
    has_balcony = models.BooleanField(default=False)
    has_generator = models.BooleanField(default=False)  # groupe électrogène / onduleur
    has_security = models.BooleanField(default=False)   # gardien / résidence sécurisée
    has_pool = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    
    # ✅ NEW: règles simples (MVP)
    allows_smoking = models.BooleanField(default=False)
    allows_pets = models.BooleanField(default=False)


    date_posted = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_posted"]
        indexes = [
            models.Index(fields=["is_active", "city"]),
            models.Index(fields=["area", "borough"]),
            models.Index(fields=["price_per_night"]),
        ]

    def __str__(self):
        return self.title

    def set_location(self, longitude: float, latitude: float):
        self.location = Point(float(longitude), float(latitude), srid=4326)

    def ensure_defaults(self):
        """
        ✅ Force explicitement les defaults côté modèle
        (utile si serializer/front envoie is_active vide/None)
        """
        if self.is_active is None:
            self.is_active = True

    def save(self, *args, **kwargs):
        self.ensure_defaults()
        return super().save(*args, **kwargs)


# ✅ Images résidence (cover + galerie)
class ListingImage(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="listings/")
    is_cover = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["is_cover", "order", "id"]
        indexes = [
            models.Index(fields=["listing", "is_cover"]),
            models.Index(fields=["listing", "order"]),
        ]

    def __str__(self):
        return f"Image #{self.id} - {self.listing_id} (cover={self.is_cover})"


class Booking(models.Model):
    """
    ✅ NEW FLOW:
    1) Client crée une DEMANDE: duration_days (+ éventuellement desired_start_date)
    2) Gérant APPROUVE ou REJECT (peut proposer des dates)
    3) Si APPROUVE -> client peut payer acompte Paystack
    4) Après paiement -> code clé généré
    5) Gérant valide code -> CHECKED_IN
    6) Admin reversement manuel -> RELEASED
    """

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bookings")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")

    # ✅ Client saisit le nombre de jours (obligatoire)
    duration_days = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    # ✅ Optionnel: client peut proposer une date souhaitée (sinon le gérant peut proposer)
    desired_start_date = models.DateField(null=True, blank=True)

    # ✅ Dates confirmées (peuvent rester null tant que le gérant n'a pas proposé/validé)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    guests = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    status = models.CharField(max_length=20, choices=BOOKING_STATUS, default="requested")

    # ✅ Message du client (optionnel)
    customer_note = models.TextField(null=True, blank=True)

    # ✅ Décision du gérant
    owner_note = models.TextField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    # ✅ Snapshot prix (fige le prix au moment de la demande)
    price_per_night = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    total_amount = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])

    # ✅ Acompte / commission / escrow (calculés au moment où on prépare le paiement)
    deposit_amount = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])            # 50% total
    platform_commission = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])      # 5%/10% du dépôt
    paystack_fee = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])             # estimation
    amount_to_pay = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])            # deposit + fee
    escrow_amount = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])            # montant reçu (dépôt)

    # ✅ Code remise clé (idéalement on stockera hash côté serializer/view, mais on prépare le champ)
    key_code_hash = models.CharField(max_length=255, null=True, blank=True)
    key_code_expires_at = models.DateTimeField(null=True, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)

    key_code = models.CharField(max_length=6, null=True, blank=True)  # ✅ CHANGE
    # key_code_expires_at = models.DateTimeField(null=True, blank=True)
    # ✅ Reversement gérant (calcul + admin)
    payout_amount = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])            # deposit - commission
    payout_status = models.CharField(max_length=10, choices=PAYOUT_STATUS, default="unpaid")
    payout_reference = models.CharField(max_length=120, null=True, blank=True)                           # ref transfert admin
    released_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["listing", "status"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            # ✅ NEW: on impose end_date > start_date seulement si les 2 existent
                models.CheckConstraint(
            check=(
                Q(start_date__isnull=True) |
                Q(end_date__isnull=True) |
                Q(end_date__gt=models.F("start_date"))
            ),
            name="booking_valid_range_if_dates_set"
        ),
        ]

    def __str__(self):
        return f"{self.user} -> {self.listing.title} ({self.status})"

    @property
    def nights(self) -> int:
        """
        ✅ Si dates confirmées, on calcule diff.
        ✅ Sinon on retourne duration_days.
        """
        if self.start_date and self.end_date:
            return max((self.end_date - self.start_date).days, 0)
        return int(self.duration_days or 0)


class BookingDateProposal(models.Model):
    """
    ✅ NEW: proposition de dates par le gérant si indisponible.
    - Facultatif
    - Plusieurs propositions possibles
    """
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="date_proposals")
    start_date = models.DateField()
    end_date = models.DateField()
    note = models.CharField(max_length=180, null=True, blank=True)  # ex: "dispo après 18h"
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["booking", "start_date", "end_date"])]

    def __str__(self):
        return f"Proposal {self.booking_id}: {self.start_date} -> {self.end_date}"


class PaymentTransaction(models.Model):
    """
    ✅ NEW: historique des tentatives Paystack (propre et auditable)
    """
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=20, choices=PAYMENT_PROVIDER, default="paystack")

    reference = models.CharField(max_length=120, unique=True)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default="initiated")

    # ✅ on stocke en "FCFA" ici (et on convertira en kobo côté Paystack si nécessaire)
    amount = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])

    # ✅ réponse brute Paystack (verify/webhook)
    raw = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["provider", "reference"]),
            models.Index(fields=["booking", "status"]),
        ]

    def __str__(self):
        return f"{self.provider}:{self.reference} ({self.status})"


class PushSubscription(models.Model):
    """
    ✅ NEW: stocke les abonnements Web Push (PWA)
    - Un user peut avoir plusieurs devices/navigateurs
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_subscriptions")

    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)

    user_agent = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"PushSub({self.user_id})"
