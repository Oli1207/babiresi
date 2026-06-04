from django.urls import path
from . import views

urlpatterns = [
    # Guides
    path("guides/", views.GuideListView.as_view(), name="guide-list"),
    path("guides/<int:pk>/", views.GuideDetailView.as_view(), name="guide-detail"),
    path("guides/<int:pk>/availability/", views.GuideAvailabilityView.as_view(), name="guide-availability"),
    path("guides/<int:pk>/book/", views.GuideBookingView.as_view(), name="guide-book"),

    # Restaurants
    path("restaurants/", views.RestaurantListView.as_view(), name="restaurant-list"),
    path("restaurants/<int:pk>/", views.RestaurantDetailView.as_view(), name="restaurant-detail"),

    # Activités
    path("activities/", views.ActivityListView.as_view(), name="activity-list"),
    path("activities/<int:pk>/", views.ActivityDetailView.as_view(), name="activity-detail"),
    path("activities/<int:pk>/book/", views.ActivityBookingView.as_view(), name="activity-book"),

    # Chauffeurs & Véhicules
    path("drivers/", views.DriverListView.as_view(), name="driver-list"),
    path("drivers/<int:pk>/", views.DriverDetailView.as_view(), name="driver-detail"),
    path("vehicles/<int:vehicle_pk>/book/", views.DriverBookingView.as_view(), name="vehicle-book"),

    # Artisans
    path("artisans/", views.ArtisanListView.as_view(), name="artisan-list"),
    path("artisans/<int:pk>/", views.ArtisanDetailView.as_view(), name="artisan-detail"),

    # Produits
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<int:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("orders/", views.ProductOrderView.as_view(), name="product-orders"),

    # Reviews
    path("reviews/", views.ReviewListCreateView.as_view(), name="review-list"),

    # Profils prestataires (créer / modifier son propre profil)
    path("guides/me/",      views.GuideMeView.as_view(),      name="guide-me"),
    path("artisans/me/",    views.ArtisanMeView.as_view(),    name="artisan-me"),
    path("restaurants/me/", views.RestaurantMeView.as_view(), name="restaurant-me"),
    path("activities/me/",  views.ActivityMeView.as_view(),   name="activity-me"),
]
