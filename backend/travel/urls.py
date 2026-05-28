from django.urls import path
from . import views

urlpatterns = [
    # Agences
    path("agencies/", views.TravelAgencyListView.as_view(), name="travel-agency-list"),
    path("agencies/<int:pk>/", views.TravelAgencyDetailView.as_view(), name="travel-agency-detail"),

    # Demandes de voyage
    path("request/", views.TravelRequestCreateView.as_view(), name="travel-request-create"),
    path("my-requests/", views.MyTravelRequestsView.as_view(), name="my-travel-requests"),
    path("request/<int:pk>/", views.TravelRequestDetailView.as_view(), name="travel-request-detail"),

    # Espace conseiller
    path("consultant/dashboard/", views.ConsultantDashboardView.as_view(), name="consultant-dashboard"),
    path("consultant/leads/", views.ConsultantLeadsView.as_view(), name="consultant-leads"),
    path("consultant/leads/<int:pk>/accept/", views.ConsultantAcceptLeadView.as_view(), name="consultant-accept-lead"),

    # Devis
    path("request/<int:request_pk>/quote/", views.QuoteCreateView.as_view(), name="quote-create"),
    path("request/<int:request_pk>/quotes/", views.QuoteVersionsView.as_view(), name="quote-versions"),
    path("quote/<int:pk>/", views.QuoteDetailView.as_view(), name="quote-detail"),
    path("quote/<int:pk>/send/", views.QuoteSendView.as_view(), name="quote-send"),
    path("quote/<int:pk>/accept/", views.QuoteAcceptView.as_view(), name="quote-accept"),
    path("quote/<int:pk>/reject/", views.QuoteRejectView.as_view(), name="quote-reject"),

    # Trip Room
    path("request/<int:request_pk>/trip-room/", views.TripRoomView.as_view(), name="trip-room"),
    path("request/<int:request_pk>/trip-room/messages/", views.TripRoomMessagesView.as_view(), name="trip-room-messages"),

    # Paiement progressif
    path("request/<int:request_pk>/payment-schedule/", views.PaymentScheduleView.as_view(), name="payment-schedule"),
    path("request/<int:request_pk>/pay-deposit/", views.PayDepositView.as_view(), name="pay-deposit"),
    path("request/<int:request_pk>/pay-balance/", views.PayBalanceView.as_view(), name="pay-balance"),

    # Assurance
    path("request/<int:request_pk>/insurance/", views.TripInsuranceView.as_view(), name="trip-insurance"),

    # Admin
    path("admin/requests/", views.AdminTravelRequestListView.as_view(), name="admin-travel-requests"),
    path("admin/agencies/", views.AdminAgencyManageView.as_view(), name="admin-agencies"),
]
