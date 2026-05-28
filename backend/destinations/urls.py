from django.urls import path
from . import views

urlpatterns = [
    path("", views.DestinationListView.as_view(), name="destination-list"),
    path("<slug:slug>/", views.DestinationDetailView.as_view(), name="destination-detail"),
    path("admin/", views.AdminDestinationView.as_view(), name="admin-destination-list"),
    path("admin/<int:pk>/", views.AdminDestinationDetailView.as_view(), name="admin-destination-detail"),
]
