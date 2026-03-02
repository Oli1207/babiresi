#api/models.py
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
    # ✅ NEW: settings (update profile + change password)
    path("user/me/update/", userauths_views.MeUpdateView.as_view(), name="me-update"),
    path("user/me/change-password/", userauths_views.ChangePasswordView.as_view(), name="me-change-password"),
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
    path("bookings/request/", listings_views.BookingRequestCreateView.as_view(), name="booking-request"),
    path("bookings/my/", listings_views.MyBookingsView.as_view(), name="my-bookings"),
    path("bookings/owner-inbox/", listings_views.OwnerBookingsInboxView.as_view(), name="owner-bookings-inbox"),
    path("bookings/<int:booking_id>/decision/", listings_views.OwnerBookingDecisionView.as_view(), name="owner-booking-decision"),
    path("bookings/<int:booking_id>/payment-info/", listings_views.BookingPaymentInfoView.as_view(), name="booking-payment-info"),

    # =======================
    # Paystack
    # =======================
    path("bookings/<int:booking_id>/paystack/initialize/", listings_views.PaystackInitializeView.as_view(), name="paystack-init"),
    path("payments/paystack/verify/", listings_views.PaystackVerifyView.as_view(), name="paystack-verify"),
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
    # ✅ AJOUT
    path("push/vapid-public-key/", listings_views.PushVapidPublicKeyView.as_view(), name="push-vapid-public-key"),
    path("push/ping/", listings_views.PushPingView.as_view(), name="push-ping"),
    # =======================
    # Owners / Sellers
    # =======================
    path("owners/me/dashboard/", listings_views.OwnerDashboardMeView.as_view(), name="owner-dashboard-me"),
    path("sellers/<int:user_id>/", listings_views.SellerPublicPageView.as_view(), name="seller-public-page"),
    path("owners/me/listings/<int:listing_id>/", listings_views.OwnerListingDeleteView.as_view(), name="owner-listing-delete"),
    
     # =========================
    # ✅ ADMIN DASHBOARD
    # =========================
    path("admin/metrics/", listings_views.AdminMetricsView.as_view(), name="admin-metrics"),

    path("admin/bookings/", listings_views.AdminBookingListView.as_view(), name="admin-bookings"),
    path("admin/bookings/<int:booking_id>/", listings_views.AdminBookingDetailView.as_view(), name="admin-booking-detail"),
    path("admin/bookings/<int:booking_id>/override-status/", listings_views.AdminBookingOverrideStatusView.as_view(), name="admin-booking-override"),

    path("admin/payouts/", listings_views.AdminPayoutListView.as_view(), name="admin-payouts"),
    path("admin/payouts/<int:payout_id>/mark-paid/", listings_views.AdminPayoutMarkPaidView.as_view(), name="admin-payout-mark-paid"),

    path("admin/disputes/", listings_views.AdminDisputeListCreateView.as_view(), name="admin-disputes"),
    path("admin/disputes/<int:pk>/", listings_views.AdminDisputeDetailUpdateView.as_view(), name="admin-dispute-detail"),
    path("admin/disputes/<int:dispute_id>/messages/", listings_views.AdminDisputeAddMessageView.as_view(), name="admin-dispute-add-message"),

    path("admin/audit/", listings_views.AdminAuditLogListView.as_view(), name="admin-audit"),

    # =========================
    # ✅ ADMIN STATS
    # =========================
    path("admin/stats/owners/", listings_views.AdminStatsOwnerEarningsView.as_view(), name="admin-stats-owners"),
    path("admin/stats/top-listings/", listings_views.AdminStatsTopListingsView.as_view(), name="admin-stats-top-listings"),
    path("admin/stats/profit/", listings_views.AdminStatsPlatformProfitView.as_view(), name="admin-stats-profit"),

]
