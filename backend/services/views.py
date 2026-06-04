from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import (
    Guide, GuideAvailability, GuideBooking,
    Restaurant, RestaurantImage,
    Activity, ActivityBooking,
    Driver, Vehicle, DriverBooking,
    Artisan, Product, ProductImage, ProductOrder,
    ArtisanBoxSubscription, Review,
)
from .serializers import (
    GuideSerializer, GuideAvailabilitySerializer, GuideBookingSerializer,
    RestaurantSerializer, ActivitySerializer, ActivityBookingSerializer,
    DriverSerializer, VehicleSerializer, DriverBookingSerializer,
    ArtisanSerializer, ProductSerializer, ProductOrderSerializer,
    ProductOrderCreateSerializer, ReviewSerializer,
)
from userauths.views import notify


# =========================================================
# Guides
# =========================================================

class GuideListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Guide.objects.filter(is_verified=True)
        destination = request.query_params.get("destination")
        language = request.query_params.get("language")
        specialty = request.query_params.get("specialty")
        anglophone = request.query_params.get("anglophone")

        if destination:
            qs = qs.filter(destinations__slug=destination)
        if language:
            qs = qs.filter(languages__contains=[language])
        if specialty:
            qs = qs.filter(specialties__contains=[specialty])
        if anglophone:
            qs = qs.filter(is_anglophone_certified=True)

        return Response(GuideSerializer(qs, many=True, context={"request": request}).data)


class GuideDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        guide = get_object_or_404(Guide, pk=pk, is_verified=True)
        return Response(GuideSerializer(guide, context={"request": request}).data)


class GuideAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        guide = get_object_or_404(Guide, pk=pk)
        avails = GuideAvailability.objects.filter(guide=guide)
        return Response(GuideAvailabilitySerializer(avails, many=True).data)


class GuideBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        guide = get_object_or_404(Guide, pk=pk, is_verified=True)
        data = request.data.copy()
        data["guide"] = guide.pk

        booking_type = data.get("type", "full_day")
        nb_days = int(data.get("nb_days", 1))
        price_map = {
            "half_day": guide.half_day_price,
            "full_day": guide.full_day_price,
            "multi_day": guide.multi_day_price * nb_days,
        }
        total = price_map.get(booking_type, guide.full_day_price)

        booking = GuideBooking.objects.create(
            guide=guide,
            client=request.user,
            date=data.get("date"),
            type=booking_type,
            nb_days=nb_days,
            guests_count=int(data.get("guests_count", 1)),
            total_amount=total,
            client_note=data.get("client_note", ""),
            destination_id=data.get("destination"),
        )
        notify(guide.user, "booking", "Nouvelle réservation guide 🗺️",
               f"{request.user.get_full_name() or request.user.username} a réservé votre service pour le {data.get('date')}.", "/admin")
        return Response(GuideBookingSerializer(booking).data, status=status.HTTP_201_CREATED)


# =========================================================
# Restaurants
# =========================================================

class RestaurantListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Restaurant.objects.filter(is_active=True)
        destination = request.query_params.get("destination")
        category = request.query_params.get("category")
        price_range = request.query_params.get("price_range")

        if destination:
            qs = qs.filter(destination__slug=destination)
        if category:
            qs = qs.filter(category=category)
        if price_range:
            qs = qs.filter(price_range=price_range)

        return Response(RestaurantSerializer(qs, many=True, context={"request": request}).data)


class RestaurantDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        restaurant = get_object_or_404(Restaurant, pk=pk, is_active=True)
        data = RestaurantSerializer(restaurant, context={"request": request}).data
        data["reviews"] = ReviewSerializer(
            Review.objects.filter(object_type="restaurant", object_id=pk)[:10],
            many=True
        ).data
        return Response(data)


# =========================================================
# Activités
# =========================================================

class ActivityListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Activity.objects.filter(is_active=True)
        destination = request.query_params.get("destination")
        category = request.query_params.get("category")

        if destination:
            qs = qs.filter(destination__slug=destination)
        if category:
            qs = qs.filter(category=category)

        return Response(ActivitySerializer(qs, many=True, context={"request": request}).data)


class ActivityDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        activity = get_object_or_404(Activity, pk=pk, is_active=True)
        data = ActivitySerializer(activity, context={"request": request}).data
        data["reviews"] = ReviewSerializer(
            Review.objects.filter(object_type="activity", object_id=pk)[:10],
            many=True
        ).data
        return Response(data)


class ActivityBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        activity = get_object_or_404(Activity, pk=pk, is_active=True)
        nb_persons = int(request.data.get("nb_persons", 1))
        total = activity.price_per_person * nb_persons

        if nb_persons < activity.min_persons or nb_persons > activity.max_persons:
            return Response(
                {"detail": f"Nombre de personnes doit être entre {activity.min_persons} et {activity.max_persons}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = ActivityBooking.objects.create(
            activity=activity,
            client=request.user,
            date=request.data.get("date"),
            nb_persons=nb_persons,
            total_amount=total,
            client_note=request.data.get("client_note", ""),
        )
        if activity.organizer:
            notify(activity.organizer, "booking", "Nouvelle réservation activité 🎯",
                   f"Réservation pour « {activity.name} » — {nb_persons} personne(s) le {request.data.get('date')}.", "/admin")
        return Response(ActivityBookingSerializer(booking).data, status=status.HTTP_201_CREATED)


# =========================================================
# Chauffeurs & Véhicules
# =========================================================

class DriverListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Driver.objects.filter(is_verified=True, is_available=True)
        destination = request.query_params.get("destination")
        vehicle_type = request.query_params.get("vehicle_type")
        with_driver = request.query_params.get("with_driver")

        if destination:
            qs = qs.filter(destinations_covered__slug=destination)

        if vehicle_type:
            qs = qs.filter(vehicles__type=vehicle_type)

        return Response(DriverSerializer(qs.distinct(), many=True, context={"request": request}).data)


class DriverDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        driver = get_object_or_404(Driver, pk=pk, is_verified=True)
        return Response(DriverSerializer(driver, context={"request": request}).data)


class DriverBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, vehicle_pk):
        vehicle = get_object_or_404(Vehicle, pk=vehicle_pk, is_available=True)
        with_driver = request.data.get("with_driver", True)
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")

        from datetime import date
        start = date.fromisoformat(str(start_date))
        end = date.fromisoformat(str(end_date))
        total_days = max((end - start).days, 1)

        price_per_day = vehicle.price_per_day_with_driver if with_driver else vehicle.price_per_day_without_driver
        total = price_per_day * total_days

        booking = DriverBooking.objects.create(
            vehicle=vehicle,
            client=request.user,
            with_driver=with_driver,
            start_date=start,
            end_date=end,
            total_days=total_days,
            total_amount=total,
            pickup_location=request.data.get("pickup_location", ""),
            dropoff_location=request.data.get("dropoff_location", ""),
            client_note=request.data.get("client_note", ""),
        )
        notify(vehicle.driver.user, "booking", "Nouvelle réservation véhicule 🚗",
               f"Réservation du {start} au {end} — {total_days} jour(s).", "/admin")
        return Response(DriverBookingSerializer(booking).data, status=status.HTTP_201_CREATED)


# =========================================================
# Artisans & Marketplace
# =========================================================

class ArtisanListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Artisan.objects.filter(is_verified=True)
        destination = request.query_params.get("destination")
        craft_type = request.query_params.get("craft_type")
        made_in_ci = request.query_params.get("made_in_ci")

        if destination:
            qs = qs.filter(destination__slug=destination)
        if craft_type:
            qs = qs.filter(craft_type=craft_type)
        if made_in_ci:
            qs = qs.filter(made_in_ci_badge=True)

        return Response(ArtisanSerializer(qs, many=True, context={"request": request}).data)


class ArtisanDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        artisan = get_object_or_404(Artisan, pk=pk, is_verified=True)
        data = ArtisanSerializer(artisan, context={"request": request}).data
        data["reviews"] = ReviewSerializer(
            Review.objects.filter(object_type="artisan", object_id=pk)[:10],
            many=True
        ).data
        return Response(data)


class ProductListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Product.objects.filter(is_available=True).select_related("artisan")
        category = request.query_params.get("category")
        artisan_id = request.query_params.get("artisan")
        made_to_order = request.query_params.get("made_to_order")
        destination = request.query_params.get("destination")

        if category:
            qs = qs.filter(category=category)
        if artisan_id:
            qs = qs.filter(artisan_id=artisan_id)
        if made_to_order:
            qs = qs.filter(made_to_order=True)
        if destination:
            qs = qs.filter(artisan__destination__slug=destination)

        return Response(ProductSerializer(qs, many=True, context={"request": request}).data)


class ProductDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        product = get_object_or_404(Product, pk=pk, is_available=True)
        return Response(ProductSerializer(product, context={"request": request}).data)


class ProductOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = ProductOrder.objects.filter(buyer=request.user)
        return Response(ProductOrderSerializer(orders, many=True).data)

    def post(self, request):
        serializer = ProductOrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        product = serializer.validated_data["product"]
        quantity = serializer.validated_data["quantity"]
        total = product.price_fcfa * quantity

        with transaction.atomic():
            if not product.made_to_order and product.stock is not None:
                product.stock -= quantity
                product.save()

            order = ProductOrder.objects.create(
                product=product,
                buyer=request.user,
                quantity=quantity,
                delivery_type=serializer.validated_data["delivery_type"],
                delivery_address=serializer.validated_data["delivery_address"],
                total_fcfa=total,
            )

        notify(product.artisan.user, "booking", "Nouvelle commande artisan 🎁",
               f"Commande de {quantity}x « {product.name} » — {total} FCFA.", "/admin")
        return Response(ProductOrderSerializer(order).data, status=status.HTTP_201_CREATED)


# =========================================================
# Reviews
# =========================================================

class ReviewListCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        object_type = request.query_params.get("type")
        object_id = request.query_params.get("id")
        if not object_type or not object_id:
            return Response({"detail": "type et id sont requis."}, status=status.HTTP_400_BAD_REQUEST)
        reviews = Review.objects.filter(object_type=object_type, object_id=object_id)
        return Response(ReviewSerializer(reviews, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = ReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================================
# Profils prestataires — endpoints "me/" (créer/modifier son propre profil)
# =========================================================

GUIDE_EDITABLE = [
    "bio", "photo", "specialties", "languages",
    "half_day_price", "full_day_price", "multi_day_price",
    "is_available", "latitude", "longitude",
]
ARTISAN_EDITABLE = [
    "bio", "story", "craft_type", "location", "photo",
    "latitude", "longitude",
]
RESTAURANT_EDITABLE = [
    "name", "description", "address", "phone", "category",
    "price_range", "opening_hours", "signature_dishes", "instagram",
    "cover_image", "latitude", "longitude",
]
ACTIVITY_EDITABLE = [
    "title", "description", "category", "price_per_person",
    "duration_hours", "min_persons", "max_persons",
    "included_services", "meeting_point", "cover_image",
    "latitude", "longitude",
]


def _me_view(model, serializer_class, editable_fields, user_field="user"):
    """Factory: renvoie une APIView GET/PATCH pour le profil prestataire."""

    class MeView(APIView):
        permission_classes = [permissions.IsAuthenticated]

        def _get_or_create(self, request):
            return model.objects.get_or_create(**{user_field: request.user})

        def get(self, request):
            obj, _ = self._get_or_create(request)
            return Response(serializer_class(obj, context={"request": request}).data)

        def patch(self, request):
            obj, _ = self._get_or_create(request)
            data = {k: v for k, v in request.data.items() if k in editable_fields}
            serializer = serializer_class(obj, data=data, partial=True, context={"request": request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    return MeView


GuideMeView      = _me_view(Guide,      GuideSerializer,      GUIDE_EDITABLE,      "user")
ArtisanMeView    = _me_view(Artisan,    ArtisanSerializer,    ARTISAN_EDITABLE,    "user")
RestaurantMeView = _me_view(Restaurant, RestaurantSerializer, RESTAURANT_EDITABLE, "owner")
ActivityMeView   = _me_view(Activity,   ActivitySerializer,   ACTIVITY_EDITABLE,   "provider")
