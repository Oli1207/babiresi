from django.urls import path
from userauths import views as userauths_views
from rest_framework_simplejwt.views import TokenRefreshView
from listings import views as listings_views

urlpatterns = [
    # =======================
    # Auth
    # =======================
    path("user/token/", userauths_views.MyTokenObtainPairView.as_view()),
    path("user/token/refresh/", TokenRefreshView.as_view()),
    path("user/register/", userauths_views.RegisterView.as_view()),
    path("user/profile/<int:user_id>/", userauths_views.ProfileView.as_view()),
    path("user/me/", userauths_views.MeView.as_view(), name="me"),
    path(
        "user/password-reset/",
        userauths_views.PasswordResetEmailVerify.as_view(),
        name="password-reset",
    ),
   path(
        "user/password-reset-confirm/",
        userauths_views.PasswordResetConfirmAPIView.as_view(),
        name="password-reset-confirm",
    ),

    # =======================
    # Listings
    # =======================
    path("listings/", listings_views.ListingListCreateView.as_view(), name="listing-list-create"),
    path("listings/<int:pk>/", listings_views.ListingRetrieveUpdateDestroyView.as_view(), name="listing-detail"),

    # =======================
    # Utils (Geo)
    # =======================
    path("utils/reverse-geocode/", listings_views.ReverseGeocodeView.as_view(), name="reverse-geocode"),
    path("utils/search-places/", listings_views.PlaceSearchView.as_view(), name="search-places"),

    # =======================
    # Bookings — NEW FLOW
    # =======================
    # ✅ Client crée une demande
    path("bookings/request/", listings_views.BookingRequestCreateView.as_view(), name="booking-request"),

    # ✅ Client voit ses réservations
    path("bookings/my/", listings_views.MyBookingsView.as_view(), name="my-bookings"),

    # ✅ Inbox gérant (demandes)
    path("bookings/owner-inbox/", listings_views.OwnerBookingsInboxView.as_view(), name="owner-bookings-inbox"),

    # ✅ Gérant approve/reject une demande
    path("bookings/<int:booking_id>/decision/", listings_views.OwnerBookingDecisionView.as_view(), name="owner-booking-decision"),

    # ✅ Client: infos paiement (afficher bouton payer)
    path("bookings/<int:booking_id>/payment-info/", listings_views.BookingPaymentInfoView.as_view(), name="booking-payment-info"),

    # =======================
    # Paystack
    # =======================
    # ✅ init paiement pour booking
    path("bookings/<int:booking_id>/paystack/initialize/", listings_views.PaystackInitializeView.as_view(), name="paystack-init"),

    # ✅ verify (frontend callback)
    path("payments/paystack/verify/", listings_views.PaystackVerifyView.as_view(), name="paystack-verify"),

    # ✅ webhook paystack
    path("payments/paystack/webhook/", listings_views.PaystackWebhookView.as_view(), name="paystack-webhook"),

    # =======================
    # Check-in (code clé)
    # =======================
    path("bookings/validate-key/", listings_views.OwnerValidateKeyView.as_view(), name="owner-validate-key"),
    path("bookings/<int:booking_id>/", listings_views.BookingDetailView.as_view()),
    path("bookings/<int:booking_id>/my-key-code/", listings_views.MyKeyCodeView.as_view()),

    # =======================
    # Admin release
    # =======================
    path("bookings/<int:booking_id>/release/", listings_views.AdminReleaseBookingView.as_view(), name="admin-release-booking"),

    # =======================
    # PWA Push
    # =======================
    path("push/subscribe/", listings_views.PushSubscribeView.as_view(), name="push-subscribe"),
    
    # =======================
# Owners / Sellers
# =======================
# ✅ Dashboard privé du gérant (ses résidences + stats)
path("owners/me/dashboard/", listings_views.OwnerDashboardMeView.as_view(), name="owner-dashboard-me"),

# ✅ Page vendeur publique (clients)
path("sellers/<int:user_id>/", listings_views.SellerPublicPageView.as_view(), name="seller-public-page"),

# ✅ Suppression d’une résidence par son owner (optionnel)
path("owners/me/listings/<int:listing_id>/", listings_views.OwnerListingDeleteView.as_view(), name="owner-listing-delete"),

]
