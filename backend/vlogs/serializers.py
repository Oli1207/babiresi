from rest_framework import serializers
from django.conf import settings
from .models import (
    Vlog, VlogSeries, VlogComment, VlogLike, VlogSave,
    CreatorPoints, PointTransaction, PointWithdrawal,
    VlogChallenge, ChallengeEntry,
)

User = settings.AUTH_USER_MODEL


class VlogSeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = VlogSeries
        fields = ["id", "title", "description", "cover_image", "created_at"]
        read_only_fields = ["author"]


class VlogSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_id = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    destination_slug = serializers.SerializerMethodField()

    class Meta:
        model = Vlog
        fields = [
            "id", "author_id", "author_name", "series", "series_order",
            "title", "description",
            "cloudinary_url", "cloudinary_public_id", "thumbnail_url", "duration_seconds",
            "destination", "destination_name", "destination_slug", "region", "city",
            "category", "ambiance", "tags",
            "views_count", "likes_count", "comments_count", "shares_count", "saves_count",
            "is_published", "is_featured",
            "is_liked", "is_saved",
            "created_at",
        ]
        read_only_fields = [
            "author_id", "author_name", "views_count", "likes_count",
            "comments_count", "shares_count", "saves_count", "is_featured",
        ]

    def get_author_name(self, obj):
        return obj.author.full_name or obj.author.email

    def get_author_id(self, obj):
        return obj.author_id

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.saves.filter(user=request.user).exists()
        return False

    def get_destination_name(self, obj):
        return obj.destination.name if obj.destination else None

    def get_destination_slug(self, obj):
        return obj.destination.slug if obj.destination else None


class VlogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vlog
        fields = [
            "title", "description",
            "cloudinary_url", "cloudinary_public_id", "thumbnail_url", "duration_seconds",
            "destination", "region", "city",
            "latitude", "longitude",
            "category", "ambiance", "tags",
            "series", "series_order",
            "is_published",
        ]


class VlogCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = VlogComment
        fields = ["id", "author_name", "vlog", "parent", "message", "replies", "created_at"]
        read_only_fields = ["author_name"]

    def get_author_name(self, obj):
        return obj.user.full_name or obj.user.email

    def get_replies(self, obj):
        if obj.parent is None:
            return VlogCommentSerializer(
                obj.replies.all().order_by("created_at"), many=True, context=self.context
            ).data
        return []


class CreatorPointsSerializer(serializers.ModelSerializer):
    rate_per_point = serializers.SerializerMethodField()
    next_level_threshold = serializers.SerializerMethodField()

    class Meta:
        model = CreatorPoints
        fields = [
            "total_points", "available_points", "withdrawn_points",
            "level", "rate_per_point", "next_level_threshold",
        ]

    def get_rate_per_point(self, obj):
        return obj.rate_per_point

    def get_next_level_threshold(self, obj):
        thresholds = {"bronze": 5000, "silver": 25000, "gold": 100000, "platinum": None}
        return thresholds.get(obj.level)


class PointTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointTransaction
        fields = ["id", "amount", "type", "source_vlog", "note", "created_at"]


class PointWithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointWithdrawal
        fields = [
            "id", "amount_points", "amount_fcfa", "method",
            "phone_number", "status", "reference", "created_at",
        ]
        read_only_fields = ["amount_fcfa", "status", "reference"]


class PointWithdrawalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointWithdrawal
        fields = ["amount_points", "method", "phone_number"]

    def validate_amount_points(self, value):
        if value < 6667:
            raise serializers.ValidationError("Minimum 6 667 points (≈ 2 000 FCFA au niveau Bronze).")
        return value


class VlogChallengeSerializer(serializers.ModelSerializer):
    entries_count = serializers.SerializerMethodField()
    is_entered = serializers.SerializerMethodField()

    class Meta:
        model = VlogChallenge
        fields = [
            "id", "title", "description", "theme", "prize_amount_fcfa",
            "cover_image", "start_date", "end_date", "is_active",
            "entries_count", "is_entered", "winner",
        ]

    def get_entries_count(self, obj):
        return obj.entries.count()

    def get_is_entered(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.entries.filter(user=request.user).exists()
        return False
