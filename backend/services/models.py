from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

User = settings.AUTH_USER_MODEL

GUIDE_SPECIALTY = (
    ("histoire", "Histoire & Patrimoine"),
    ("gastronomie", "Gastronomie"),
    ("nature", "Nature & Randonnée"),
    ("artisanat", "Artisanat & Culture"),
    ("photo", "Photographie"),
    ("nocturne", "Vie nocturne"),
    ("famille", "Famille & Enfants"),
    ("aventure", "Aventure"),
)

LANGUAGE_CHOICES = (
    ("fr", "Français"),
    ("en", "English"),
    ("dioula", "Dioula"),
    ("bete", "Bété"),
    ("baoule", "Baoulé"),
    ("senoufo", "Sénoufó"),
    ("autre", "Autre"),
)

BOOKING_STATUS = (
    ("pending", "En attente"),
    ("confirmed", "Confirmé"),
    ("cancelled", "Annulé"),
    ("completed", "Terminé"),
)

VEHICLE_TYPE = (
    ("citadine", "Citadine"),
    ("berline", "Berline"),
    ("suv", "SUV"),
    ("minibus", "Minibus (6+ pers.)"),
    ("4x4", "4x4"),
)

RESTAURANT_CATEGORY = (
    ("maquis", "Maquis"),
    ("restaurant", "Restaurant"),
    ("street_food", "Street Food"),
    ("gastronomique", "Gastronomique"),
    ("cafe", "Café / Snack"),
)

ACTIVITY_CATEGORY = (
    ("excursion", "Excursion"),
    ("cours_cuisine", "Cours de cuisine"),
    ("culturel", "Visite culturelle"),
    ("nature", "Nature & Randonnée"),
    ("plage", "Plage & Eau"),
    ("nocturne", "Vie nocturne"),
    ("artisanat", "Atelier artisanat"),
    ("sport", "Sport & Aventure"),
)

CRAFT_TYPE = (
    ("pagne", "Pagne & Tissu"),
    ("sculpture", "Sculpture"),
    ("bijou", "Bijouterie"),
    ("poterie", "Poterie"),
    ("vannerie", "Vannerie"),
    ("peinture", "Peinture"),
    ("autre", "Autre"),
)


# =========================================================
# Guides certifiés
# =========================================================

class Guide(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="guide_profile")
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to="services/guides/", null=True, blank=True)
    video_intro_url = models.URLField(blank=True)

    specialties = models.JSONField(default=list)
    languages = models.JSONField(default=list)
    destinations = models.ManyToManyField("destinations.Destination", blank=True, related_name="guides")

    half_day_price = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    full_day_price = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    multi_day_price = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])

    # Base location (principal zone d'opération)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)

    is_anglophone_certified = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)

    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    total_bookings = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_verified", "is_available"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self):
        return f"Guide: {self.user}"


class GuideAvailability(models.Model):
    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="availabilities")
    date = models.DateField()
    is_available = models.BooleanField(default=True)

    class Meta:
        unique_together = ("guide", "date")
        indexes = [models.Index(fields=["guide", "date"])]


class GuideBooking(models.Model):
    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="bookings")
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="guide_bookings")
    destination = models.ForeignKey(
        "destinations.Destination", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="guide_bookings"
    )
    date = models.DateField()
    type = models.CharField(
        max_length=15,
        choices=(("half_day", "Demi-journée"), ("full_day", "Journée"), ("multi_day", "Multi-jours")),
        default="full_day"
    )
    nb_days = models.PositiveIntegerField(default=1)
    guests_count = models.PositiveIntegerField(default=1)
    total_amount = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=15, choices=BOOKING_STATUS, default="pending")
    client_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["guide", "date"]),
            models.Index(fields=["client", "status"]),
        ]


# =========================================================
# Restaurants & Maquis
# =========================================================

class Restaurant(models.Model):
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="restaurants")
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    destination = models.ForeignKey(
        "destinations.Destination", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="restaurants"
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    category = models.CharField(max_length=20, choices=RESTAURANT_CATEGORY, default="maquis")
    price_range = models.CharField(
        max_length=5,
        choices=(("€", "Économique"), ("€€", "Moyen"), ("€€€", "Gastronomique")),
        default="€"
    )
    opening_hours = models.CharField(max_length=200, blank=True)
    signature_dishes = models.JSONField(default=list, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    instagram = models.CharField(max_length=100, blank=True)
    cover_image = models.ImageField(upload_to="services/restaurants/", null=True, blank=True)

    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-rating_avg"]
        indexes = [
            models.Index(fields=["destination", "category"]),
            models.Index(fields=["is_verified", "is_active"]),
        ]

    def __str__(self):
        return self.name


class RestaurantImage(models.Model):
    restaurant = models.ForeignKey(Restaurant, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="services/restaurants/gallery/")
    caption = models.CharField(max_length=150, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]


# =========================================================
# Activités & Expériences
# =========================================================

class Activity(models.Model):
    provider = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="activities")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    destination = models.ForeignKey(
        "destinations.Destination", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="activities"
    )
    category = models.CharField(max_length=20, choices=ACTIVITY_CATEGORY, default="excursion")
    duration_hours = models.DecimalField(max_digits=4, decimal_places=1, default=1)
    price_per_person = models.PositiveIntegerField(default=0)
    min_persons = models.PositiveIntegerField(default=1)
    max_persons = models.PositiveIntegerField(default=20)
    included_services = models.JSONField(default=list, blank=True)
    meeting_point = models.CharField(max_length=255, blank=True)
    cover_image = models.ImageField(upload_to="services/activities/", null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["destination", "category"]),
            models.Index(fields=["is_verified", "is_active"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if (self.latitude is None or self.longitude is None) and self.destination_id:
            try:
                dest = self.destination
                if dest and dest.latitude and dest.longitude:
                    self.latitude = dest.latitude
                    self.longitude = dest.longitude
            except Exception:
                pass
        super().save(*args, **kwargs)


class ActivityBooking(models.Model):
    activity = models.ForeignKey(Activity, on_delete=models.CASCADE, related_name="bookings")
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activity_bookings")
    date = models.DateField()
    nb_persons = models.PositiveIntegerField(default=1)
    total_amount = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=15, choices=BOOKING_STATUS, default="pending")
    client_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["activity", "date"]), models.Index(fields=["client", "status"])]


# =========================================================
# Chauffeurs & Location de voiture
# =========================================================

class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=50, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    languages = models.JSONField(default=list)
    destinations_covered = models.ManyToManyField(
        "destinations.Destination", blank=True, related_name="drivers"
    )
    bio = models.TextField(blank=True)
    photo = models.ImageField(upload_to="services/drivers/", null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["is_verified", "is_available"])]

    def __str__(self):
        return f"Driver: {self.user}"


class Vehicle(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="vehicles")
    type = models.CharField(max_length=15, choices=VEHICLE_TYPE, default="berline")
    brand = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.PositiveIntegerField(null=True, blank=True)
    capacity = models.PositiveIntegerField(default=4)
    photo = models.ImageField(upload_to="services/vehicles/", null=True, blank=True)
    price_per_day_with_driver = models.PositiveIntegerField(default=0)
    price_per_day_without_driver = models.PositiveIntegerField(default=0)
    has_ac = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["driver", "is_available"])]

    def __str__(self):
        return f"{self.brand} {self.model} ({self.driver})"


class DriverBooking(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="bookings")
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="driver_bookings")
    with_driver = models.BooleanField(default=True)
    start_date = models.DateField()
    end_date = models.DateField()
    pickup_location = models.CharField(max_length=255, blank=True)
    dropoff_location = models.CharField(max_length=255, blank=True)
    total_days = models.PositiveIntegerField(default=1)
    total_amount = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=15, choices=BOOKING_STATUS, default="pending")
    client_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["vehicle", "start_date"]),
            models.Index(fields=["client", "status"]),
        ]


# =========================================================
# Artisans & Marketplace
# =========================================================

class Artisan(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="artisan_profile")
    bio = models.TextField(blank=True)
    story = models.TextField(blank=True)
    craft_type = models.CharField(max_length=20, choices=CRAFT_TYPE, default="autre")
    location = models.CharField(max_length=200, blank=True)
    destination = models.ForeignKey(
        "destinations.Destination", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="artisans"
    )
    photo = models.ImageField(upload_to="services/artisans/", null=True, blank=True)
    video_intro_url = models.URLField(blank=True)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    made_in_ci_badge = models.BooleanField(default=False)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_verified", "craft_type"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self):
        return f"Artisan: {self.user}"

    def save(self, *args, **kwargs):
        if (self.latitude is None or self.longitude is None) and self.destination_id:
            try:
                dest = self.destination
                if dest and dest.latitude and dest.longitude:
                    self.latitude = dest.latitude
                    self.longitude = dest.longitude
            except Exception:
                pass
        super().save(*args, **kwargs)


class Product(models.Model):
    artisan = models.ForeignKey(Artisan, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    story = models.TextField(blank=True)

    price_fcfa = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    stock = models.PositiveIntegerField(null=True, blank=True)
    made_to_order = models.BooleanField(default=False)
    production_time_days = models.PositiveIntegerField(default=7)

    category = models.CharField(max_length=20, choices=CRAFT_TYPE, default="autre")
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["artisan", "is_available"]),
            models.Index(fields=["category"]),
        ]

    def __str__(self):
        return f"{self.name} by {self.artisan}"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="services/products/")
    is_cover = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-is_cover", "order"]


DELIVERY_TYPE = (
    ("local_abidjan", "Local Abidjan"),
    ("national", "National CI"),
    ("international", "International"),
)

ORDER_STATUS = (
    ("pending", "En attente"),
    ("confirmed", "Confirmé"),
    ("in_production", "En production"),
    ("shipped", "Expédié"),
    ("delivered", "Livré"),
    ("cancelled", "Annulé"),
)


class ProductOrder(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="orders")
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="product_orders")
    quantity = models.PositiveIntegerField(default=1)
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE, default="local_abidjan")
    delivery_address = models.JSONField(default=dict)
    total_fcfa = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=ORDER_STATUS, default="pending")
    tracking_number = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["buyer", "status"]),
            models.Index(fields=["product", "status"]),
        ]

    def __str__(self):
        return f"Order #{self.id} - {self.product.name} ({self.status})"


# =========================================================
# CI Artisan Box (abonnement)
# =========================================================

ARTISAN_BOX_STATUS = (
    ("active", "Actif"),
    ("paused", "En pause"),
    ("cancelled", "Annulé"),
)


class ArtisanBoxSubscription(models.Model):
    subscriber = models.ForeignKey(User, on_delete=models.CASCADE, related_name="artisan_box_subscriptions")
    delivery_address = models.JSONField(default=dict)
    delivery_country = models.CharField(max_length=100)
    status = models.CharField(max_length=15, choices=ARTISAN_BOX_STATUS, default="active")
    price_monthly_eur = models.PositiveIntegerField(default=35)
    next_shipment_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["status", "next_shipment_date"])]


# =========================================================
# Système de reviews universel
# =========================================================

REVIEW_OBJECT_TYPE = (
    ("listing", "Logement"),
    ("guide", "Guide"),
    ("activity", "Activité"),
    ("driver", "Chauffeur"),
    ("restaurant", "Restaurant"),
    ("artisan", "Artisan"),
    ("consultant", "Conseiller voyage"),
    ("agency", "Agence voyage"),
)


class Review(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(default=5)
    comment = models.TextField(blank=True)
    object_type = models.CharField(max_length=20, choices=REVIEW_OBJECT_TYPE)
    object_id = models.PositiveIntegerField()
    is_verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["object_type", "object_id"]),
            models.Index(fields=["author", "object_type"]),
        ]

    def __str__(self):
        return f"Review({self.rating}★) {self.object_type}:{self.object_id}"
