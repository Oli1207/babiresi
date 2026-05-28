from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.throttling import ScopedRateThrottle
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone

from .models import (
    Vlog, VlogSeries, VlogLike, VlogSave, VlogView, VlogComment,
    CreatorPoints, PointTransaction, PointWithdrawal,
    VlogChallenge, ChallengeEntry, POINT_AMOUNTS,
)
from .serializers import (
    VlogSerializer, VlogCreateSerializer, VlogSeriesSerializer,
    VlogCommentSerializer, CreatorPointsSerializer,
    PointTransactionSerializer, PointWithdrawalSerializer,
    PointWithdrawalCreateSerializer, VlogChallengeSerializer,
)
from userauths.views import notify


def award_points(user, point_type, source_vlog=None, note=""):
    amount = POINT_AMOUNTS.get(point_type, 0)
    if amount == 0:
        return
    with transaction.atomic():
        cp, _ = CreatorPoints.objects.get_or_create(user=user)
        cp.total_points += amount
        cp.available_points += amount
        cp.recalculate_level()
        cp.save()
        PointTransaction.objects.create(
            user=user, amount=amount, type=point_type,
            source_vlog=source_vlog, note=note
        )
    label = source_vlog.title if source_vlog else point_type
    notify(user, "points", f"+{amount} points", f"Tu as gagné {amount} pts — {label}", "/vlogs/creator")


class VlogListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Vlog.objects.filter(is_published=True).select_related("author", "destination")
        region = request.query_params.get("region")
        category = request.query_params.get("category")
        ambiance = request.query_params.get("ambiance")
        destination = request.query_params.get("destination")
        search = request.query_params.get("q")

        if region:
            qs = qs.filter(region=region)
        if category:
            qs = qs.filter(category=category)
        if ambiance:
            qs = qs.filter(ambiance=ambiance)
        if destination:
            qs = qs.filter(destination__slug=destination)
        if search:
            qs = qs.filter(title__icontains=search)

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = 24
        page = paginator.paginate_queryset(qs, request)
        serializer = VlogSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = VlogCreateSerializer(data=request.data)
        if serializer.is_valid():
            vlog = serializer.save(author=request.user)
            return Response(VlogSerializer(vlog, context={"request": request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VlogTrendingView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "vlog_view"

    def get(self, request):
        from django.db.models import F
        qs = Vlog.objects.filter(is_published=True).order_by(
            "-views_count", "-likes_count", "-created_at"
        )[:24]
        return Response(VlogSerializer(qs, many=True, context={"request": request}).data)


class VlogFeaturedView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Vlog.objects.filter(is_published=True, is_featured=True).order_by("-created_at")[:12]
        return Response(VlogSerializer(qs, many=True, context={"request": request}).data)


class VlogDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk, is_published=True)
        return Response(VlogSerializer(vlog, context={"request": request}).data)

    def put(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        if vlog.author != request.user and not request.user.is_staff:
            return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)
        serializer = VlogCreateSerializer(vlog, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(VlogSerializer(vlog, context={"request": request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        if vlog.author != request.user and not request.user.is_staff:
            return Response({"detail": "Interdit."}, status=status.HTTP_403_FORBIDDEN)
        vlog.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VlogViewRegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "vlog_view"

    def post(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        watch_pct = int(request.data.get("watch_percentage", 0))
        ip = request.META.get("REMOTE_ADDR")

        user = request.user if request.user.is_authenticated else None

        if user and user == vlog.author:
            return Response({"counted": False})

        already_viewed = VlogView.objects.filter(
            vlog=vlog,
            user=user if user else None,
            ip_address=ip if not user else None,
        ).exists()

        if not already_viewed and watch_pct >= 50:
            VlogView.objects.create(vlog=vlog, user=user, ip_address=ip, watch_percentage=watch_pct)
            Vlog.objects.filter(pk=pk).update(views_count=vlog.views_count + 1)
            award_points(vlog.author, "view", source_vlog=vlog)
            return Response({"counted": True})

        return Response({"counted": False})


class VlogLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        like, created = VlogLike.objects.get_or_create(user=request.user, vlog=vlog)
        if created:
            Vlog.objects.filter(pk=pk).update(likes_count=vlog.likes_count + 1)
            award_points(vlog.author, "like", source_vlog=vlog)
            return Response({"liked": True})
        else:
            like.delete()
            Vlog.objects.filter(pk=pk).update(likes_count=max(0, vlog.likes_count - 1))
            return Response({"liked": False})


class VlogSaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        save_obj, created = VlogSave.objects.get_or_create(user=request.user, vlog=vlog)
        if created:
            Vlog.objects.filter(pk=pk).update(saves_count=vlog.saves_count + 1)
            award_points(vlog.author, "save", source_vlog=vlog)
            return Response({"saved": True})
        else:
            save_obj.delete()
            Vlog.objects.filter(pk=pk).update(saves_count=max(0, vlog.saves_count - 1))
            return Response({"saved": False})


class VlogShareView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        Vlog.objects.filter(pk=pk).update(shares_count=vlog.shares_count + 1)
        award_points(vlog.author, "share", source_vlog=vlog)
        return Response({"shared": True})


class VlogCommentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        comments = vlog.comments.filter(parent=None).select_related("user")
        serializer = VlogCommentSerializer(comments, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, pk):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED)
        vlog = get_object_or_404(Vlog, pk=pk)
        message = request.data.get("message", "").strip()
        parent_id = request.data.get("parent")
        if not message:
            return Response({"detail": "Message requis."}, status=status.HTTP_400_BAD_REQUEST)
        parent = None
        if parent_id:
            parent = get_object_or_404(VlogComment, pk=parent_id, vlog=vlog)
        comment = VlogComment.objects.create(user=request.user, vlog=vlog, parent=parent, message=message)
        Vlog.objects.filter(pk=pk).update(comments_count=vlog.comments_count + 1)
        award_points(vlog.author, "comment", source_vlog=vlog)
        return Response(VlogCommentSerializer(comment, context={"request": request}).data, status=status.HTTP_201_CREATED)


# =========================================================
# Séries
# =========================================================

class VlogSeriesListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        author_id = request.query_params.get("author")
        qs = VlogSeries.objects.all()
        if author_id:
            qs = qs.filter(author_id=author_id)
        return Response(VlogSeriesSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = VlogSeriesSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================================
# Dashboard Créateur & Points
# =========================================================

class CreatorDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        cp, _ = CreatorPoints.objects.get_or_create(user=user)
        vlogs = Vlog.objects.filter(author=user)
        data = {
            "points": CreatorPointsSerializer(cp).data,
            "vlogs_count": vlogs.count(),
            "total_views": sum(v.views_count for v in vlogs),
            "total_likes": sum(v.likes_count for v in vlogs),
        }
        return Response(data)


class PointsHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        transactions = PointTransaction.objects.filter(user=request.user)[:50]
        return Response(PointTransactionSerializer(transactions, many=True).data)


class PointsWithdrawView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "points_withdraw"

    def get(self, request):
        withdrawals = PointWithdrawal.objects.filter(user=request.user)
        return Response(PointWithdrawalSerializer(withdrawals, many=True).data)

    def post(self, request):
        serializer = PointWithdrawalCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        cp, _ = CreatorPoints.objects.get_or_create(user=request.user)
        amount_pts = serializer.validated_data["amount_points"]

        if cp.available_points < amount_pts:
            return Response({"detail": "Points insuffisants."}, status=status.HTTP_400_BAD_REQUEST)

        amount_fcfa = int(amount_pts * cp.rate_per_point)

        with transaction.atomic():
            withdrawal = PointWithdrawal.objects.create(
                user=request.user,
                amount_points=amount_pts,
                amount_fcfa=amount_fcfa,
                method=serializer.validated_data["method"],
                phone_number=serializer.validated_data["phone_number"],
            )
            cp.available_points -= amount_pts
            cp.withdrawn_points += amount_pts
            cp.save()
            PointTransaction.objects.create(
                user=request.user, amount=-amount_pts, type="withdrawal",
                note=f"Retrait {amount_fcfa} FCFA via {withdrawal.method}"
            )

        return Response(PointWithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED)


# =========================================================
# Challenges
# =========================================================

class VlogChallengeListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.utils.timezone import now
        qs = VlogChallenge.objects.filter(is_active=True, end_date__gte=now().date())
        return Response(VlogChallengeSerializer(qs, many=True, context={"request": request}).data)


class VlogChallengeEnterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        challenge = get_object_or_404(VlogChallenge, pk=pk, is_active=True)
        vlog_id = request.data.get("vlog_id")
        if not vlog_id:
            return Response({"detail": "vlog_id requis."}, status=status.HTTP_400_BAD_REQUEST)
        vlog = get_object_or_404(Vlog, pk=vlog_id, author=request.user)
        entry, created = ChallengeEntry.objects.get_or_create(
            user=request.user, challenge=challenge, defaults={"vlog": vlog}
        )
        if not created:
            return Response({"detail": "Déjà inscrit à ce challenge."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Inscrit avec succès."}, status=status.HTTP_201_CREATED)


# =========================================================
# Admin Vlogs
# =========================================================

class AdminVlogModerationView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = Vlog.objects.all().order_by("-created_at")
        return Response(VlogSerializer(qs[:50], many=True, context={"request": request}).data)

    def patch(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        is_published = request.data.get("is_published")
        is_featured = request.data.get("is_featured")
        if is_published is not None:
            vlog.is_published = is_published
        if is_featured is not None:
            vlog.is_featured = is_featured
            if is_featured:
                award_points(vlog.author, "featured", source_vlog=vlog, note="Vlog featured par admin")
                notify(vlog.author, "vlog", "Vlog mis en avant ⭐", f"Ton vlog « {vlog.title} » a été sélectionné par l'équipe Babiresi !", f"/vlogs/{vlog.pk}")
        vlog.save()
        return Response(VlogSerializer(vlog, context={"request": request}).data)


class AdminWithdrawalView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = PointWithdrawal.objects.filter(status="pending").select_related("user")
        return Response(PointWithdrawalSerializer(qs, many=True).data)

    def patch(self, request, pk):
        withdrawal = get_object_or_404(PointWithdrawal, pk=pk)
        new_status = request.data.get("status")
        if new_status not in ("paid", "failed", "rejected"):
            return Response({"detail": "Statut invalide."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status in ("failed", "rejected") and withdrawal.status == "pending":
            with transaction.atomic():
                cp = CreatorPoints.objects.get(user=withdrawal.user)
                cp.available_points += withdrawal.amount_points
                cp.withdrawn_points -= withdrawal.amount_points
                cp.save()
                PointTransaction.objects.create(
                    user=withdrawal.user,
                    amount=withdrawal.amount_points,
                    type="withdrawal",
                    note=f"Retrait annulé ({new_status}) - remboursement points"
                )

        withdrawal.status = new_status
        if new_status == "paid":
            withdrawal.processed_at = timezone.now()
            notify(withdrawal.user, "points", "Retrait effectué ✅",
                   f"Ton retrait de {withdrawal.amount_fcfa} FCFA via {withdrawal.method} a été traité.", "/vlogs/creator")
        elif new_status in ("failed", "rejected"):
            notify(withdrawal.user, "points", "Retrait annulé",
                   f"Ton retrait de {withdrawal.amount_fcfa} FCFA a été {new_status}. Tes points ont été recrédités.", "/vlogs/creator")
        withdrawal.save()
        return Response(PointWithdrawalSerializer(withdrawal).data)
