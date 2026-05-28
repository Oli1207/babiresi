from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

User = settings.AUTH_USER_MODEL

AGENCY_SPECIALTY = (
    ("luxury", "Voyages de luxe"),
    ("family", "Familles"),
    ("honeymoon", "Lune de miel"),
    ("adventure", "Aventure & Nature"),
    ("budget", "Budget"),
    ("corporate", "Corporate"),
    ("cultural", "Culturel & Patrimoine"),
)

TRAVEL_REQUEST_STATUS = (
    ("new", "Nouvelle demande"),
    ("assigned", "Assignée à un conseiller"),
    ("quoted", "Devis envoyé"),
    ("negotiating", "En négociation"),
    ("confirmed", "Confirmée"),
    ("paid_deposit", "Acompte payé"),
    ("paid_full", "Totalement payé"),
    ("in_progress", "Séjour en cours"),
    ("completed", "Séjour terminé"),
    ("cancelled", "Annulée"),
)

GROUP_TYPE = (
    ("solo", "Solo"),
    ("couple", "Couple"),
    ("famille", "Famille"),
    ("amis", "Groupe d'amis"),
    ("lune_de_miel", "Lune de miel"),
    ("corporate", "Voyage d'affaires"),
)

COMFORT_LEVEL = (
    ("essentiel", "Essentiel"),
    ("confort", "Confort"),
    ("premium", "Premium"),
    ("luxe", "Luxe"),
)

TRANSPORT_TYPE = (
    ("with_driver", "Voiture avec chauffeur"),
    ("without_driver", "Location sans chauffeur"),
    ("driver_on_demand", "Chauffeur ponctuel"),
    ("advisor_choice", "Recommandation conseiller"),
)

QUOTE_STATUS = (
    ("draft", "Brouillon"),
    ("sent", "Envoyé au client"),
    ("accepted", "Accepté"),
    ("rejected", "Refusé"),
    ("superseded", "Remplacé par nouvelle version"),
)

LINE_CATEGORY = (
    ("accommodation", "Hébergement"),
    ("transport", "Transport"),
    ("guide", "Guide"),
    ("activity", "Activité"),
    ("restaurant", "Restaurant"),
    ("insurance", "Assurance"),
    ("other", "Autre"),
)

CONTACT_METHOD = (
    ("whatsapp", "WhatsApp"),
    ("email", "Email"),
    ("call", "Appel téléphonique"),
    ("video", "Visio (Zoom / Meet)"),
)

BUDGET_RANGE = (
    ("less_500", "Moins de 500€"),
    ("500_1000", "500€ – 1 000€"),
    ("1000_2500", "1 000€ – 2 500€"),
    ("2500_5000", "2 500€ – 5 000€"),
    ("more_5000", "Plus de 5 000€"),
    ("not_specified", "Non précisé"),
)

PAYMENT_SCHEDULE_STATUS = (
    ("pending", "En attente"),
    ("deposit_paid", "Acompte payé"),
    ("balance_due", "Solde à payer"),
    ("fully_paid", "Entièrement payé"),
)


# =========================================================
# Agences & Conseillers
# =========================================================

class TravelAgency(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_agencies")
    name = models.CharField(max_length=200)
    logo = models.ImageField(upload_to="travel/agencies/", null=True, blank=True)
    description = models.TextField(blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    specialties = models.JSONField(default=list)
    languages = models.JSONField(default=list)
    phone = models.CharField(max_length=30, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)

    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_platform_agency = models.BooleanField(default=False)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    total_trips_organized = models.PositiveIntegerField(default=0)
    sla_violations = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-rating_avg", "-total_trips_organized"]
        indexes = [models.Index(fields=["is_verified", "is_active"])]

    def __str__(self):
        return self.name


class TravelConsultant(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="consultant_profile")
    agency = models.ForeignKey(
        TravelAgency, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="consultants"
    )
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to="travel/consultants/", null=True, blank=True)
    languages = models.JSONField(default=list)
    specialties = models.JSONField(default=list)
    is_available = models.BooleanField(default=True)
    max_active_leads = models.PositiveIntegerField(default=5)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    total_trips = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["is_available"])]

    def __str__(self):
        return f"Consultant: {self.user}"


# =========================================================
# Demande de voyage (formulaire de qualification)
# =========================================================

class TravelRequest(models.Model):
    # Voyageur
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    whatsapp = models.CharField(max_length=30)
    preferred_contact_time = models.CharField(max_length=100, blank=True)
    timezone = models.CharField(max_length=50, blank=True, default="UTC")
    preferred_contact_method = models.CharField(max_length=15, choices=CONTACT_METHOD, default="whatsapp")
    how_heard = models.CharField(max_length=100, blank=True)

    # Groupe
    nationality = models.CharField(max_length=100, blank=True)
    residence_country = models.CharField(max_length=100, blank=True)
    passport_validity = models.DateField(null=True, blank=True)
    adults_count = models.PositiveIntegerField(default=1)
    children_count = models.PositiveIntegerField(default=0)
    children_ages = models.JSONField(default=list, blank=True)
    group_type = models.CharField(max_length=20, choices=GROUP_TYPE, default="solo")
    special_occasion = models.CharField(max_length=150, blank=True)
    languages_spoken = models.JSONField(default=list, blank=True)

    # Le voyage
    desired_start_date = models.DateField(null=True, blank=True)
    desired_end_date = models.DateField(null=True, blank=True)
    is_dates_flexible = models.BooleanField(default=True)
    flexibility_days = models.PositiveIntegerField(default=3)
    duration_days = models.PositiveIntegerField(null=True, blank=True)
    previously_visited_ci = models.BooleanField(default=False)

    destinations = models.ManyToManyField(
        "destinations.Destination", blank=True, related_name="travel_requests"
    )
    custom_destination = models.CharField(max_length=200, blank=True)

    # Intérêts
    interests = models.JSONField(default=list, blank=True)

    # Hébergement
    accommodation_style = models.CharField(
        max_length=30,
        choices=(
            ("private_residence", "Résidence privée"),
            ("hotel", "Hôtel"),
            ("local_host", "Chez l'habitant"),
            ("any", "Peu importe"),
        ),
        default="any"
    )
    comfort_level = models.CharField(max_length=15, choices=COMFORT_LEVEL, default="confort")
    accommodation_features = models.JSONField(default=list, blank=True)
    rooms_needed = models.PositiveIntegerField(default=1)

    # Transport
    needs_airport_transfer = models.BooleanField(default=True)
    transport_type = models.CharField(max_length=20, choices=TRANSPORT_TYPE, default="with_driver")
    vehicle_type = models.CharField(
        max_length=15,
        choices=(("citadine", "Citadine"), ("berline", "Berline"), ("suv", "SUV"), ("minibus", "Minibus")),
        blank=True
    )
    has_international_license = models.BooleanField(default=False)

    # Services
    wants_guide = models.BooleanField(default=False)
    wants_cooking_class = models.BooleanField(default=False)
    wants_excursions = models.BooleanField(default=False)
    wants_artisan_visits = models.BooleanField(default=False)
    custom_requests = models.TextField(blank=True)

    # Budget
    budget_range = models.CharField(max_length=20, choices=BUDGET_RANGE, default="not_specified")
    currency_preference = models.CharField(max_length=5, default="EUR")

    # Contraintes
    dietary_restrictions = models.CharField(max_length=255, blank=True)
    health_constraints = models.CharField(max_length=255, blank=True)

    # Statut & assignation
    status = models.CharField(max_length=20, choices=TRAVEL_REQUEST_STATUS, default="new")
    assigned_consultant = models.ForeignKey(
        TravelConsultant, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_requests"
    )
    assigned_agency = models.ForeignKey(
        TravelAgency, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="requests"
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    first_contact_deadline = models.DateTimeField(null=True, blank=True)
    sla_breached = models.BooleanField(default=False)

    # Requester (si connecté)
    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="travel_requests"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["assigned_consultant"]),
            models.Index(fields=["assigned_agency"]),
        ]

    def __str__(self):
        return f"TravelRequest #{self.id} - {self.full_name} ({self.status})"


# =========================================================
# Devis (avec versioning)
# =========================================================

class TravelQuote(models.Model):
    request = models.ForeignKey(TravelRequest, on_delete=models.CASCADE, related_name="quotes")
    consultant = models.ForeignKey(
        TravelConsultant, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="quotes"
    )
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=15, choices=QUOTE_STATUS, default="draft")
    notes = models.TextField(blank=True)
    validity_until = models.DateField(null=True, blank=True)

    subtotal_fcfa = models.PositiveIntegerField(default=0)
    service_fee_fcfa = models.PositiveIntegerField(default=0)
    total_fcfa = models.PositiveIntegerField(default=0)

    client_comment = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-version"]
        indexes = [
            models.Index(fields=["request", "version"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Quote V{self.version} - Request #{self.request_id} [{self.status}]"

    def calculate_totals(self):
        subtotal = sum(line.total_fcfa for line in self.line_items.all())
        service_fee = int(subtotal * 0.10)
        self.subtotal_fcfa = subtotal
        self.service_fee_fcfa = service_fee
        self.total_fcfa = subtotal + service_fee


class QuoteLineItem(models.Model):
    quote = models.ForeignKey(TravelQuote, on_delete=models.CASCADE, related_name="line_items")
    category = models.CharField(max_length=20, choices=LINE_CATEGORY, default="other")
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    consultant_note = models.CharField(max_length=500, blank=True)

    unit_price_fcfa = models.PositiveIntegerField(default=0)
    quantity = models.PositiveIntegerField(default=1)
    total_fcfa = models.PositiveIntegerField(default=0)

    # Liens optionnels vers les objets réels
    linked_listing_id = models.PositiveIntegerField(null=True, blank=True)
    linked_guide_id = models.PositiveIntegerField(null=True, blank=True)
    linked_vehicle_id = models.PositiveIntegerField(null=True, blank=True)
    linked_activity_id = models.PositiveIntegerField(null=True, blank=True)

    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def save(self, *args, **kwargs):
        self.total_fcfa = self.unit_price_fcfa * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.label} ({self.total_fcfa} FCFA)"


# =========================================================
# Trip Room
# =========================================================

class TripRoom(models.Model):
    request = models.OneToOneField(TravelRequest, on_delete=models.CASCADE, related_name="trip_room")
    itinerary = models.JSONField(default=list, blank=True)
    checklist = models.JSONField(default=list, blank=True)
    emergency_contacts = models.JSONField(default=list, blank=True)
    map_points = models.JSONField(default=list, blank=True)
    kit_voyage = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"TripRoom - Request #{self.request_id}"


class TripRoomMessage(models.Model):
    trip_room = models.ForeignKey(TripRoom, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trip_messages")
    message = models.TextField()
    attachment_url = models.URLField(blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["trip_room", "created_at"])]

    def __str__(self):
        return f"TripMsg({self.trip_room_id}) by {self.author_id}"


# =========================================================
# Paiement progressif
# =========================================================

class PaymentSchedule(models.Model):
    request = models.OneToOneField(TravelRequest, on_delete=models.CASCADE, related_name="payment_schedule")
    deposit_amount = models.PositiveIntegerField(default=0)
    deposit_due_date = models.DateField(null=True, blank=True)
    deposit_paid_at = models.DateTimeField(null=True, blank=True)
    deposit_reference = models.CharField(max_length=120, blank=True)

    balance_amount = models.PositiveIntegerField(default=0)
    balance_due_date = models.DateField(null=True, blank=True)
    balance_paid_at = models.DateTimeField(null=True, blank=True)
    balance_reference = models.CharField(max_length=120, blank=True)

    status = models.CharField(max_length=20, choices=PAYMENT_SCHEDULE_STATUS, default="pending")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PaymentSchedule - Request #{self.request_id} [{self.status}]"


# =========================================================
# Assurance voyage (add-on)
# =========================================================

class TripInsurance(models.Model):
    request = models.OneToOneField(TravelRequest, on_delete=models.CASCADE, related_name="insurance")
    provider = models.CharField(max_length=100, blank=True)
    coverage_type = models.JSONField(default=list)
    price_per_person = models.PositiveIntegerField(default=0)
    total_price = models.PositiveIntegerField(default=0)
    is_subscribed = models.BooleanField(default=False)
    reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Insurance - Request #{self.request_id}"


# =========================================================
# Attribution des leads (log)
# =========================================================

class LeadAssignment(models.Model):
    request = models.ForeignKey(TravelRequest, on_delete=models.CASCADE, related_name="lead_assignments")
    agency = models.ForeignKey(TravelAgency, null=True, blank=True, on_delete=models.SET_NULL)
    consultant = models.ForeignKey(TravelConsultant, null=True, blank=True, on_delete=models.SET_NULL)
    notified_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    declined_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["request", "notified_at"])]
