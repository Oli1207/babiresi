from django.db import models
from django.conf import settings
from django.utils import timezone

User = settings.AUTH_USER_MODEL

PROFILE_TYPE = [
    ('looking',   'Je cherche une coloc'),
    ('has_place', "J'ai une place"),
]

GENDER_PREF = [
    ('any',    'Peu importe'),
    ('male',   'Homme'),
    ('female', 'Femme'),
]

ZONES_ABIDJAN = [
    ('cocody',       'Cocody'),
    ('yopougon',     'Yopougon'),
    ('plateau',      'Plateau'),
    ('marcory',      'Marcory'),
    ('treichville',  'Treichville'),
    ('adjame',       'Adjamé'),
    ('koumassi',     'Koumassi'),
    ('port_bouet',   'Port-Bouët'),
    ('abobo',        'Abobo'),
    ('attiecoube',   'Attécoubé'),
    ('bingerville',  'Bingerville'),
    ('riviera',      'Riviera'),
    ('angre',        'Angré'),
    ('2plateaux',    '2 Plateaux'),
]

FREE_SWIPES_PER_DAY = 15


class ColocProfile(models.Model):
    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='coloc_profile')
    profile_type = models.CharField(max_length=10, choices=PROFILE_TYPE, default='looking')

    # Infos perso
    bio        = models.TextField(blank=True)
    age        = models.PositiveSmallIntegerField(null=True, blank=True)
    occupation = models.CharField(max_length=80, blank=True, help_text='Étudiant, Pro, Freelance…')
    gender     = models.CharField(max_length=10, blank=True)  # male / female / other

    # Budget
    budget_min = models.PositiveIntegerField(default=0,   help_text='FCFA/mois minimum')
    budget_max = models.PositiveIntegerField(default=0,   help_text='FCFA/mois maximum')

    # Pour has_place : infos logement
    place_zone        = models.CharField(max_length=20, blank=True, choices=ZONES_ABIDJAN)
    place_description = models.TextField(blank=True)
    place_rent_total  = models.PositiveIntegerField(default=0)
    place_rent_share  = models.PositiveIntegerField(default=0, help_text='Part demandée au futur coloc')

    # Préférences de localisation (chercheur)
    preferred_zones = models.JSONField(default=list, blank=True)
    move_in_date    = models.DateField(null=True, blank=True)
    gender_pref     = models.CharField(max_length=10, choices=GENDER_PREF, default='any')

    # Style de vie (JSON)
    # { smoking, pets, wake_time, sleep_time, cleanliness, noise, visitors }
    lifestyle = models.JSONField(default=dict, blank=True)

    # Centres d'intérêt
    interests = models.JSONField(default=list, blank=True)

    # Premium + statut
    is_premium = models.BooleanField(default=False)
    is_active  = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)

    # Quota swipes journalier
    swipes_today = models.PositiveIntegerField(default=0)
    swipe_date   = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=['is_active', 'profile_type'])]

    def __str__(self):
        return f"{self.user} — {self.get_profile_type_display()}"

    def can_swipe(self):
        today = timezone.now().date()
        if self.swipe_date != today:
            self.swipes_today = 0
            self.swipe_date   = today
            self.save(update_fields=['swipes_today', 'swipe_date'])
        if self.is_premium:
            return True
        return self.swipes_today < FREE_SWIPES_PER_DAY

    def consume_swipe(self):
        today = timezone.now().date()
        if self.swipe_date != today:
            self.swipes_today = 0
            self.swipe_date   = today
        self.swipes_today += 1
        self.save(update_fields=['swipes_today', 'swipe_date'])

    @property
    def swipes_left(self):
        today = timezone.now().date()
        if self.swipe_date != today:
            return FREE_SWIPES_PER_DAY if not self.is_premium else None
        if self.is_premium:
            return None  # illimité
        return max(0, FREE_SWIPES_PER_DAY - self.swipes_today)


class ColocPhoto(models.Model):
    profile              = models.ForeignKey(ColocProfile, on_delete=models.CASCADE, related_name='photos')
    cloudinary_url       = models.URLField()
    cloudinary_public_id = models.CharField(max_length=255)
    is_cover             = models.BooleanField(default=False)
    order                = models.PositiveSmallIntegerField(default=0)
    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_cover', 'order']


class ColocSwipe(models.Model):
    swiper     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coloc_swipes_made')
    target     = models.ForeignKey(ColocProfile, on_delete=models.CASCADE, related_name='swipes_received')
    liked      = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('swiper', 'target')
        indexes = [models.Index(fields=['swiper', 'liked', 'created_at'])]


class ColocMatch(models.Model):
    user1      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coloc_matches_1')
    user2      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coloc_matches_2')
    matched_at = models.DateTimeField(auto_now_add=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user1', 'user2')
        ordering = ['-matched_at']

    def other_user(self, me):
        return self.user2 if self.user1_id == me.id else self.user1

    def unread_for(self, user):
        return self.messages.filter(is_read=False).exclude(sender=user).count()


class ColocMessage(models.Model):
    match      = models.ForeignKey(ColocMatch, on_delete=models.CASCADE, related_name='messages')
    sender     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coloc_messages_sent')
    content    = models.TextField()
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes  = [models.Index(fields=['match', 'created_at'])]
