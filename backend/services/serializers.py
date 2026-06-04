from rest_framework import serializers
from core.utils import hybrid_image_url
from .models import (
    Guide, GuideAvailability, GuideBooking,
    Restaurant, RestaurantImage,
    Activity, ActivityBooking,
    Driver, Vehicle, DriverBooking,
    Artisan, Product, ProductImage, ProductOrder,
    ArtisanBoxSubscription, Review,
)


class GuideSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_photo = serializers.SerializerMethodField()
    destinations_list = serializers.SerializerMethodField()

    class Meta:
        model = Guide
        fields = [
            "id", "user_name", "user_photo", "bio", "photo", "video_intro_url",
            "specialties", "languages", "destinations_list",
            "half_day_price", "full_day_price", "multi_day_price",
            "is_anglophone_certified", "is_verified", "is_available",
            "rating_avg", "total_reviews", "total_bookings",
            "latitude", "longitude",
        ]

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email

    def get_user_photo(self, obj):
        try:
            request = self.context.get("request")
            return hybrid_image_url(obj.user.profile.image, request)
        except Exception:
            return None

    def get_destinations_list(self, obj):
        return [{"id": d.id, "name": d.name, "slug": d.slug} for d in obj.destinations.all()]


class GuideAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = GuideAvailability
        fields = ["date", "is_available"]


class GuideBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuideBooking
        fields = [
            "id", "guide", "date", "type", "nb_days", "guests_count",
            "total_amount", "status", "client_note", "created_at",
        ]
        read_only_fields = ["total_amount", "status"]


class RestaurantImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantImage
        fields = ["id", "image", "caption", "order"]


class RestaurantSerializer(serializers.ModelSerializer):
    images = RestaurantImageSerializer(many=True, read_only=True)
    destination_name = serializers.SerializerMethodField()
    vlog_count = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "description", "address", "destination", "destination_name",
            "latitude", "longitude", "category", "price_range",
            "opening_hours", "signature_dishes", "phone", "instagram",
            "cover_image", "is_verified", "rating_avg", "total_reviews",
            "images", "vlog_count",
        ]

    def get_destination_name(self, obj):
        return obj.destination.name if obj.destination else None

    def get_vlog_count(self, obj):
        return 0


class ActivitySerializer(serializers.ModelSerializer):
    destination_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            "id", "title", "description", "destination", "destination_name",
            "category", "duration_hours", "price_per_person",
            "min_persons", "max_persons", "included_services", "meeting_point",
            "cover_image", "is_verified", "rating_avg", "total_reviews",
            "latitude", "longitude",
        ]

    def get_destination_name(self, obj):
        return obj.destination.name if obj.destination else None


class ActivityBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityBooking
        fields = ["id", "activity", "date", "nb_persons", "total_amount", "status", "client_note", "created_at"]
        read_only_fields = ["total_amount", "status"]


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            "id", "type", "brand", "model", "year", "capacity", "photo",
            "price_per_day_with_driver", "price_per_day_without_driver",
            "has_ac", "is_available",
        ]


class DriverSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    vehicles = VehicleSerializer(many=True, read_only=True)
    destinations_covered_list = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            "id", "user_name", "bio", "photo",
            "languages", "experience_years", "destinations_covered_list",
            "is_verified", "is_available", "rating_avg", "total_reviews",
            "vehicles",
        ]

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email

    def get_destinations_covered_list(self, obj):
        return [{"id": d.id, "name": d.name} for d in obj.destinations_covered.all()]


class DriverBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverBooking
        fields = [
            "id", "vehicle", "with_driver", "start_date", "end_date",
            "pickup_location", "dropoff_location",
            "total_days", "total_amount", "status", "client_note", "created_at",
        ]
        read_only_fields = ["total_days", "total_amount", "status"]

    def validate(self, data):
        if data.get("end_date") and data.get("start_date"):
            if data["end_date"] <= data["start_date"]:
                raise serializers.ValidationError("La date de fin doit être après la date de début.")
        return data


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "is_cover", "order"]


class ProductSerializer(serializers.ModelSerializer):
    artisan_name = serializers.SerializerMethodField()
    artisan_id = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "artisan_id", "artisan_name", "name", "description", "story",
            "price_fcfa", "stock", "made_to_order", "production_time_days",
            "category", "weight_kg", "is_available", "images", "created_at",
        ]

    def get_artisan_name(self, obj):
        return obj.artisan.user.full_name or obj.artisan.user.email

    def get_artisan_id(self, obj):
        return obj.artisan_id


class ArtisanSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    destination_name = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    products = ProductSerializer(many=True, read_only=True)

    class Meta:
        model = Artisan
        fields = [
            "id", "user_name", "bio", "story", "craft_type",
            "location", "destination", "destination_name",
            "photo", "video_intro_url",
            "is_verified", "made_in_ci_badge",
            "rating_avg", "total_reviews", "products_count", "products",
            "latitude", "longitude",
        ]

    def get_user_name(self, obj):
        return obj.user.full_name or obj.user.email

    def get_destination_name(self, obj):
        return obj.destination.name if obj.destination else None

    def get_products_count(self, obj):
        return obj.products.filter(is_available=True).count()


class ProductOrderSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductOrder
        fields = [
            "id", "product", "product_name", "quantity",
            "delivery_type", "delivery_address", "total_fcfa",
            "status", "tracking_number", "created_at",
        ]
        read_only_fields = ["total_fcfa", "status", "tracking_number"]

    def get_product_name(self, obj):
        return obj.product.name


class ProductOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductOrder
        fields = ["product", "quantity", "delivery_type", "delivery_address"]

    def validate(self, data):
        product = data["product"]
        quantity = data.get("quantity", 1)
        if not product.made_to_order and product.stock is not None:
            if product.stock < quantity:
                raise serializers.ValidationError(f"Stock insuffisant. Disponible: {product.stock}")
        return data


class ReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id", "author_name", "rating", "comment",
            "object_type", "object_id", "is_verified_purchase", "created_at",
        ]
        read_only_fields = ["author_name", "is_verified_purchase"]

    def get_author_name(self, obj):
        return obj.author.full_name or obj.author.email
