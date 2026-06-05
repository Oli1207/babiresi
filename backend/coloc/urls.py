from django.urls import path
from . import views

urlpatterns = [
    # Mon profil
    path('me/',                     views.MyColocProfileView.as_view(),   name='coloc-me'),
    path('me/photos/',              views.ColocPhotoView.as_view(),       name='coloc-photos'),
    path('me/photos/<int:photo_id>/', views.ColocPhotoView.as_view(),     name='coloc-photo-delete'),

    # Feed + swipe
    path('feed/',                           views.ColocFeedView.as_view(),  name='coloc-feed'),
    path('swipe/<int:profile_id>/',         views.ColocSwipeView.as_view(), name='coloc-swipe'),

    # Matchs
    path('matches/',                        views.ColocMatchListView.as_view(), name='coloc-matches'),
    path('matches/<int:match_id>/messages/', views.ColocChatView.as_view(),     name='coloc-chat'),

    # Profil public
    path('profiles/<int:profile_id>/',      views.ColocPublicProfileView.as_view(), name='coloc-profile'),
]
