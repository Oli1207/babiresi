from django.urls import path
from . import views

urlpatterns = [
    # Vlogs CRUD & actions
    path("", views.VlogListView.as_view(), name="vlog-list"),
    path("trending/", views.VlogTrendingView.as_view(), name="vlog-trending"),
    path("featured/", views.VlogFeaturedView.as_view(), name="vlog-featured"),
    path("<int:pk>/", views.VlogDetailView.as_view(), name="vlog-detail"),
    path("<int:pk>/view/", views.VlogViewRegisterView.as_view(), name="vlog-view"),
    path("<int:pk>/like/", views.VlogLikeView.as_view(), name="vlog-like"),
    path("<int:pk>/save/", views.VlogSaveView.as_view(), name="vlog-save"),
    path("<int:pk>/share/", views.VlogShareView.as_view(), name="vlog-share"),
    path("<int:pk>/comments/", views.VlogCommentsView.as_view(), name="vlog-comments"),

    # Séries
    path("series/", views.VlogSeriesListView.as_view(), name="vlog-series-list"),

    # Challenges
    path("challenges/", views.VlogChallengeListView.as_view(), name="vlog-challenges"),
    path("challenges/<int:pk>/enter/", views.VlogChallengeEnterView.as_view(), name="vlog-challenge-enter"),

    # Créateur
    path("creator/dashboard/", views.CreatorDashboardView.as_view(), name="creator-dashboard"),
    path("creator/points/history/", views.PointsHistoryView.as_view(), name="creator-points-history"),
    path("creator/points/withdraw/", views.PointsWithdrawView.as_view(), name="creator-points-withdraw"),

    # Admin modération
    path("admin/vlogs/", views.AdminVlogModerationView.as_view(), name="admin-vlogs"),
    path("admin/vlogs/<int:pk>/", views.AdminVlogModerationView.as_view(), name="admin-vlog-detail"),
    path("admin/withdrawals/", views.AdminWithdrawalView.as_view(), name="admin-withdrawals"),
    path("admin/withdrawals/<int:pk>/", views.AdminWithdrawalView.as_view(), name="admin-withdrawal-detail"),

    # Concours (Contest)
    path("contests/",            views.ContestListView.as_view(),            name="contest-list"),
    path("contests/<int:pk>/",   views.ContestDetailView.as_view(),          name="contest-detail"),

    # Admin concours
    path("admin/contests/",                          views.AdminContestListCreateView.as_view(), name="admin-contest-list"),
    path("admin/contests/<int:pk>/",                 views.AdminContestDetailView.as_view(),     name="admin-contest-detail"),
    path("admin/contests/<int:pk>/declare-winner/",  views.AdminDeclareWinnerView.as_view(),     name="admin-contest-winner"),
]
