from rest_framework import serializers
from .models import ColocProfile, ColocPhoto, ColocSwipe, ColocMatch, ColocMessage, FREE_SWIPES_PER_DAY
from core.utils import hybrid_image_url


class ColocPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ColocPhoto
        fields = ['id', 'cloudinary_url', 'cloudinary_public_id', 'is_cover', 'order']


class ColocProfileSerializer(serializers.ModelSerializer):
    photos     = ColocPhotoSerializer(many=True, read_only=True)
    user_name  = serializers.SerializerMethodField()
    user_photo = serializers.SerializerMethodField()
    swipes_left = serializers.SerializerMethodField()
    compatibility = serializers.SerializerMethodField()

    class Meta:
        model  = ColocProfile
        fields = [
            'id', 'user', 'user_name', 'user_photo',
            'profile_type', 'bio', 'age', 'occupation', 'gender',
            'budget_min', 'budget_max',
            'place_zone', 'place_description', 'place_rent_total', 'place_rent_share',
            'preferred_zones', 'move_in_date', 'gender_pref',
            'lifestyle', 'interests',
            'is_premium', 'is_active', 'is_verified',
            'swipes_left', 'photos', 'compatibility',
            'created_at',
        ]
        read_only_fields = ['user', 'is_premium', 'is_verified']

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email.split('@')[0]

    def get_user_photo(self, obj):
        request = self.context.get('request')
        try:
            return hybrid_image_url(obj.user.profile.image, request)
        except Exception:
            return None

    def get_swipes_left(self, obj):
        # Only show for own profile
        request = self.context.get('request')
        if request and request.user == obj.user:
            return obj.swipes_left
        return None

    def get_compatibility(self, obj):
        """Score de compatibilité avec l'utilisateur connecté (0-100)."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        try:
            me = request.user.coloc_profile
        except Exception:
            return None
        if me.id == obj.id:
            return None
        return _compute_compatibility(me, obj)


def _compute_compatibility(me, other):
    score = 0
    total = 0

    # Intérêts communs (40 pts)
    my_i = set(me.interests or [])
    their_i = set(other.interests or [])
    if my_i or their_i:
        overlap = len(my_i & their_i) / max(len(my_i | their_i), 1)
        score += int(overlap * 40)
    total += 40

    # Lifestyle (40 pts)
    lifestyle_keys = ['smoking', 'pets', 'wake_time', 'sleep_time', 'cleanliness', 'noise', 'visitors']
    my_l    = me.lifestyle or {}
    their_l = other.lifestyle or {}
    matches = sum(1 for k in lifestyle_keys if my_l.get(k) and my_l.get(k) == their_l.get(k))
    if lifestyle_keys:
        score += int((matches / len(lifestyle_keys)) * 40)
    total += 40

    # Budget (20 pts)
    if me.budget_max > 0 and other.budget_max > 0:
        overlap = (min(me.budget_max, other.budget_max) - max(me.budget_min, other.budget_min))
        if overlap > 0:
            score += 20
    total += 20

    return int((score / total) * 100) if total > 0 else 0


class ColocMatchSerializer(serializers.ModelSerializer):
    other_profile  = serializers.SerializerMethodField()
    last_message   = serializers.SerializerMethodField()
    unread_count   = serializers.SerializerMethodField()

    class Meta:
        model  = ColocMatch
        fields = ['id', 'matched_at', 'is_active', 'other_profile', 'last_message', 'unread_count']

    def get_other_profile(self, obj):
        request = self.context.get('request')
        other = obj.other_user(request.user)
        try:
            p = other.coloc_profile
            return {
                'user_id':   other.id,
                'name':      other.full_name or other.email.split('@')[0],
                'photo':     hybrid_image_url(other.profile.image, request),
                'profile_id': p.id,
                'cover_photo': p.photos.filter(is_cover=True).values_list('cloudinary_url', flat=True).first()
                                or p.photos.values_list('cloudinary_url', flat=True).first(),
            }
        except Exception:
            return {'user_id': other.id, 'name': other.email.split('@')[0]}

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if not msg:
            return None
        return {'content': msg.content[:60], 'created_at': msg.created_at, 'sender_id': msg.sender_id}

    def get_unread_count(self, obj):
        request = self.context.get('request')
        return obj.unread_for(request.user)


class ColocMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model  = ColocMessage
        fields = ['id', 'match', 'sender', 'sender_name', 'content', 'is_read', 'created_at']
        read_only_fields = ['sender', 'match', 'is_read']

    def get_sender_name(self, obj):
        return obj.sender.full_name or obj.sender.email.split('@')[0]
