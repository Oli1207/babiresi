from django.contrib import admin
from .models import (
    Guide, GuideAvailability, GuideBooking,
    Restaurant, RestaurantImage,
    Activity, ActivityBooking,
    Driver, Vehicle, DriverBooking,
    Artisan, Product, ProductImage, ProductOrder,
    ArtisanBoxSubscription, Review,
)

@admin.register(Guide)
class GuideAdmin(admin.ModelAdmin):
    list_display = ["user", "is_verified", "is_anglophone_certified", "is_available", "rating_avg", "total_bookings"]
    list_editable = ["is_verified", "is_anglophone_certified", "is_available"]
    search_fields = ["user__email", "user__full_name"]

@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "destination", "is_verified", "rating_avg"]
    list_editable = ["is_verified"]
    list_filter = ["category", "is_verified"]
    search_fields = ["name"]

@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "destination", "price_per_person", "is_verified"]
    list_editable = ["is_verified"]
    list_filter = ["category", "is_verified"]

@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ["user", "is_verified", "is_available", "rating_avg"]
    list_editable = ["is_verified", "is_available"]

@admin.register(Artisan)
class ArtisanAdmin(admin.ModelAdmin):
    list_display = ["user", "craft_type", "is_verified", "made_in_ci_badge", "destination"]
    list_editable = ["is_verified", "made_in_ci_badge"]
    list_filter = ["craft_type", "is_verified", "made_in_ci_badge"]

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ["name", "artisan", "price_fcfa", "made_to_order", "is_available", "category"]
    list_editable = ["is_available"]
    list_filter = ["category", "made_to_order", "is_available"]

@admin.register(ProductOrder)
class ProductOrderAdmin(admin.ModelAdmin):
    list_display = ["id", "product", "buyer", "quantity", "total_fcfa", "status", "delivery_type", "created_at"]
    list_editable = ["status"]
    list_filter = ["status", "delivery_type"]

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["author", "rating", "object_type", "object_id", "is_verified_purchase", "created_at"]
    list_filter = ["object_type", "rating"]

admin.site.register(GuideAvailability)
admin.site.register(GuideBooking)
admin.site.register(RestaurantImage)
admin.site.register(ActivityBooking)
admin.site.register(Vehicle)
admin.site.register(DriverBooking)
admin.site.register(ProductImage)
admin.site.register(ArtisanBoxSubscription)
