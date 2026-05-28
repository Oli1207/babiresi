from django.db import models
from django.conf import settings
from django.utils import timezone

User = settings.AUTH_USER_MODEL

VLOG_CATEGORIES = (
    ("gastronomie", "Gastronomie"),
    ("culture", "Culture & Traditions"),
    ("nature", "Nature & Paysages"),
    ("artisanat", "Artisanat"),
    ("fetes", "Fêtes & Événements"),
    ("vie_locale", "Vie quotidienne"),
    ("plages", "Plages"),
    ("architecture", "Architecture & Histoire"),
    ("aventure", "Aventure"),
)

VLOG_AMBIANCE = (
    ("aventure", "Aventure"),
    ("detente", "Détente"),
    ("culturel", "Découverte culturelle"),
    ("famille", "Family-friendly"),
    ("romantique", "Romantique"),
    ("nocturne", "Vie nocturne"),
)

CREATOR_LEVEL = (
    ("bronze", "Bronze"),
    ("silver", "Silver"),
    ("gold", "Gold"),
    ("platinum", "Platinum"),
)

POINT_TYPE = (
    ("view", "Vue"),
    ("like", "Like reçu"),
    ("comment", "Commentaire reçu"),
    ("share", "Partage"),
    ("save", "Sauvegarde"),
    ("booking_generated", "Réservation générée"),
    ("artisan_order", "Commande artisan générée"),
    ("featured", "Vlog mis en avant"),
    ("challenge_win", "Victoire challenge"),
    ("withdrawal", "Retrait"),
)

WITHDRAWAL_METHOD = (
    ("wave", "Wave"),
    ("orange_money", "Orange Money"),
    ("paystack", "Paystack"),
)

WITHDRAWAL_STATUS = (
    ("pending", "En attente"),
    ("paid", "Payé"),
    ("failed", "Échoué"),
    ("rejected", "Rejeté"),
)


class VlogSeries(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vlog_series")
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="vlogs/series_covers/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Vlog(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vlogs")
    series = models.ForeignKey(VlogSeries, null=True, blank=True, on_delete=models.SET_NULL, related_name="episodes")
    series_order = models.PositiveIntegerField(default=1)

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Cloudinary
    cloudinary_url = models.URLField(max_length=500, blank=True)
    cloudinary_public_id = models.CharField(max_length=255, blank=True)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    # Localisation
    destination = models.ForeignKey(
        "destinations.Destination", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="vlogs"
    )
    region = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True, db_index=True)
    longitude = models.FloatField(null=True, blank=True, db_index=True)

    category = models.CharField(max_length=30, choices=VLOG_CATEGORIES, default="vie_locale")
    ambiance = models.CharField(max_length=20, choices=VLOG_AMBIANCE, blank=True)
    tags = models.JSONField(default=list, blank=True)

    # Compteurs (mis à jour via signals/tasks)
    views_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    saves_count = models.PositiveIntegerField(default=0)

    is_published = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_published", "is_featured"]),
            models.Index(fields=["author", "created_at"]),
            models.Index(fields=["region", "category"]),
            models.Index(fields=["destination"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Auto-fill coords from destination if not explicitly set
        if (self.latitude is None or self.longitude is None) and self.destination_id:
            try:
                dest = self.destination
                if dest and dest.latitude and dest.longitude:
                    self.latitude = dest.latitude
                    self.longitude = dest.longitude
            except Exception:
                pass
        super().save(*args, **kwargs)


class VlogLike(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vlog_likes")
    vlog = models.ForeignKey(Vlog, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "vlog")
        indexes = [models.Index(fields=["vlog", "created_at"])]


class VlogSave(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vlog_saves")
    vlog = models.ForeignKey(Vlog, on_delete=models.CASCADE, related_name="saves")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "vlog")


class VlogView(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="vlog_views")
    vlog = models.ForeignKey(Vlog, on_delete=models.CASCADE, related_name="views")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    watch_percentage = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["vlog", "created_at"]),
            models.Index(fields=["user", "vlog"]),
        ]


class VlogComment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vlog_comments")
    vlog = models.ForeignKey(Vlog, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["vlog", "created_at"])]

    def __str__(self):
        return f"Comment by {self.user_id} on {self.vlog_id}"


# =========================================================
# Système de récompenses créateurs
# =========================================================

class CreatorPoints(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="creator_points")
    total_points = models.PositiveBigIntegerField(default=0)
    available_points = models.PositiveBigIntegerField(default=0)
    withdrawn_points = models.PositiveBigIntegerField(default=0)
    level = models.CharField(max_length=10, choices=CREATOR_LEVEL, default="bronze")

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Points({self.user_id}) {self.available_points}pts [{self.level}]"

    def recalculate_level(self):
        if self.total_points >= 100000:
            self.level = "platinum"
        elif self.total_points >= 25000:
            self.level = "gold"
        elif self.total_points >= 5000:
            self.level = "silver"
        else:
            self.level = "bronze"

    @property
    def rate_per_point(self):
        rates = {"bronze": 0.3, "silver": 0.5, "gold": 0.8, "platinum": 1.2}
        return rates.get(self.level, 0.3)


POINT_AMOUNTS = {
    "view": 1,
    "like": 5,
    "comment": 10,
    "share": 15,
    "save": 8,
    "booking_generated": 500,
    "artisan_order": 200,
    "featured": 300,
    "challenge_win": 1000,
}


class PointTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="point_transactions")
    amount = models.IntegerField()
    type = models.CharField(max_length=30, choices=POINT_TYPE)
    source_vlog = models.ForeignKey(Vlog, null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["type", "created_at"]),
        ]


class PointWithdrawal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="point_withdrawals")
    amount_points = models.PositiveIntegerField()
    amount_fcfa = models.PositiveIntegerField()
    method = models.CharField(max_length=20, choices=WITHDRAWAL_METHOD)
    phone_number = models.CharField(max_length=30)
    status = models.CharField(max_length=10, choices=WITHDRAWAL_STATUS, default="pending")
    reference = models.CharField(max_length=120, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status"])]

    def __str__(self):
        return f"Withdrawal({self.user_id}) {self.amount_fcfa}FCFA [{self.status}]"


# =========================================================
# Challenges mensuels
# =========================================================

class VlogChallenge(models.Model):
    title = models.CharField(max_length=150)
    description = models.TextField()
    theme = models.CharField(max_length=100)
    prize_amount_fcfa = models.PositiveIntegerField(default=0)
    cover_image = models.ImageField(upload_to="vlogs/challenges/", null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    winner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="won_challenges")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return self.title


class ChallengeEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="challenge_entries")
    challenge = models.ForeignKey(VlogChallenge, on_delete=models.CASCADE, related_name="entries")
    vlog = models.ForeignKey(Vlog, on_delete=models.CASCADE, related_name="challenge_entries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "challenge")
        indexes = [models.Index(fields=["challenge", "created_at"])]
