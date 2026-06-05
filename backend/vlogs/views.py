from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.throttling import ScopedRateThrottle
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import (
    Vlog, VlogSeries, VlogLike, VlogSave, VlogView, VlogComment,
    CreatorPoints, PointTransaction, PointWithdrawal,
    VlogChallenge, ChallengeEntry, POINT_AMOUNTS,
    Contest, ContestWinner,
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
            with transaction.atomic():
                VlogView.objects.create(vlog=vlog, user=user, ip_address=ip, watch_percentage=watch_pct)
                Vlog.objects.filter(pk=pk).update(views_count=F('views_count') + 1)
            award_points(vlog.author, "view", source_vlog=vlog)
            return Response({"counted": True})

        return Response({"counted": False})


def _check_contest_threshold(vlog):
    """
    Appelé après chaque like. Vérifie si ce vlog franchit le seuil
    d'un concours actif de type threshold/vlog_likes.
    Crée/met à jour ContestWinner si conditions remplies.
    Doit être appelé DANS une transaction atomique.
    """
    now = timezone.now()
    active_contests = Contest.objects.filter(
        status__in=("active", "extended"),
        contest_type="threshold",
        metric_type="vlog_likes",
        start_date__lte=now,
    ).filter(
        models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
    )

    for contest in active_contests:
        if contest.is_full:
            continue
        if vlog.likes_count < (contest.threshold or 1000):
            continue
        # Vlog posté pendant la période du concours ?
        if vlog.created_at < contest.start_date:
            continue

        # Auteur a assez de vlogs pendant la période ?
        if contest.min_vlogs_required > 0:
            vlog_count = Vlog.objects.filter(
                author=vlog.author,
                is_published=True,
                created_at__gte=contest.start_date,
            ).count()
            if vlog_count < contest.min_vlogs_required:
                continue

        # Créer ou retrouver le winner (SELECT FOR UPDATE pour atomicité)
        winner, created = ContestWinner.objects.select_for_update().get_or_create(
            contest=contest,
            user=vlog.author,
            defaults={
                "best_vlog": vlog,
                "threshold_reached_at": now,
                "won_at": now,
                "rank": contest.winners_count + 1,
                "score": vlog.likes_count,
                "payout_amount": contest.prize_amount,
            }
        )
        if not created and winner.won_at is None:
            winner.threshold_reached_at = now
            winner.won_at = now
            winner.best_vlog = vlog
            winner.rank = contest.winners_count
            winner.score = vlog.likes_count
            winner.save(update_fields=["threshold_reached_at", "won_at", "best_vlog", "rank", "score"])


class VlogLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        vlog = get_object_or_404(Vlog, pk=pk)
        like, created = VlogLike.objects.get_or_create(user=request.user, vlog=vlog)
        if created:
            with transaction.atomic():
                Vlog.objects.filter(pk=pk).update(likes_count=F('likes_count') + 1)
                vlog.refresh_from_db(fields=["likes_count"])
                _check_contest_threshold(vlog)
            award_points(vlog.author, "like", source_vlog=vlog)
            return Response({"liked": True})
        else:
            like.delete()
            Vlog.objects.filter(pk=pk).update(likes_count=F('likes_count') - 1)
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
        # Top-level récents d'abord, avec réponses imbriquées (via serializer).
        comments = vlog.comments.filter(parent=None).select_related("user").order_by("-created_at")
        # Self-heal : recale comments_count sur le total réel (parents + réponses)
        real_count = vlog.comments.count()
        if vlog.comments_count != real_count:
            Vlog.objects.filter(pk=pk).update(comments_count=real_count)
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


# ─────────────────────────────────────────────────────────────
# CONCOURS (Contest)
# ─────────────────────────────────────────────────────────────

from django.db.models import Max, Count, Sum, OuterRef, Subquery


def _build_leaderboard(contest):
    """Retourne le classement temps réel pour un concours."""
    now = timezone.now()
    start = contest.start_date
    end   = contest.end_date or now

    if contest.metric_type == "vlog_likes":
        # Meilleur vlog par utilisateur pendant la période
        eligible = (
            Vlog.objects.filter(is_published=True, created_at__range=(start, end))
            .values("author")
            .annotate(vlog_count=Count("id"))
        )
        if contest.min_vlogs_required > 0:
            eligible = eligible.filter(vlog_count__gte=contest.min_vlogs_required)
        eligible_ids = eligible.values_list("author", flat=True)

        rows = (
            Vlog.objects.filter(author__in=eligible_ids, is_published=True, created_at__range=(start, end))
            .values("author", "author__full_name", "author__email")
            .annotate(best_likes=Max("likes_count"), vlog_count=Count("id"))
            .order_by("-best_likes")[:50]
        )
        return [
            {
                "user_id":    r["author"],
                "name":       r["author__full_name"] or r["author__email"],
                "score":      r["best_likes"],
                "vlog_count": r["vlog_count"],
                "metric":     "likes",
                "is_winner":  ContestWinner.objects.filter(contest=contest, user_id=r["author"]).exists(),
            }
            for r in rows
        ]

    elif contest.metric_type == "total_points":
        rows = (
            PointTransaction.objects.filter(created_at__range=(start, end), amount__gt=0)
            .values("user", "user__full_name", "user__email")
            .annotate(total=Sum("amount"))
            .order_by("-total")[:50]
        )
        return [
            {
                "user_id":  r["user"],
                "name":     r["user__full_name"] or r["user__email"],
                "score":    r["total"],
                "metric":   "points",
                "is_winner": ContestWinner.objects.filter(contest=contest, user_id=r["user"]).exists(),
            }
            for r in rows
        ]

    elif contest.metric_type in ("vlog_comments", "vlog_views"):
        field = "comments_count" if contest.metric_type == "vlog_comments" else "views_count"
        rows = (
            Vlog.objects.filter(is_published=True, created_at__range=(start, end))
            .values("author", "author__full_name", "author__email")
            .annotate(best=Max(field), vlog_count=Count("id"))
            .order_by("-best")[:50]
        )
        return [
            {
                "user_id":    r["author"],
                "name":       r["author__full_name"] or r["author__email"],
                "score":      r["best"],
                "vlog_count": r["vlog_count"],
                "metric":     contest.metric_type,
                "is_winner":  ContestWinner.objects.filter(contest=contest, user_id=r["author"]).exists(),
            }
            for r in rows
        ]

    return []


class ContestListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        contests = Contest.objects.filter(status__in=("active", "extended", "ended")).order_by("-start_date")
        data = []
        for c in contests:
            winners = c.winners.select_related("user", "best_vlog").order_by("rank")
            data.append({
                "id":                c.id,
                "title":             c.title,
                "description":       c.description,
                "rules":             c.rules,
                "cover_image":       request.build_absolute_uri(c.cover_image.url) if c.cover_image else None,
                "metric_type":       c.metric_type,
                "contest_type":      c.contest_type,
                "threshold":         c.threshold,
                "min_vlogs_required":c.min_vlogs_required,
                "max_winners":       c.max_winners,
                "prize_amount":      c.prize_amount,
                "start_date":        c.start_date,
                "end_date":          c.end_date,
                "status":            c.status,
                "winners_count":     c.winners_count,
                "is_open":           c.is_open,
                "winners": [
                    {
                        "rank":          w.rank,
                        "user_id":       w.user_id,
                        "name":          w.user.full_name or w.user.email,
                        "won_at":        w.won_at,
                        "score":         w.score,
                        "payout_status": w.payout_status,
                        "vlog_id":       w.best_vlog_id,
                        "vlog_title":    w.best_vlog.title if w.best_vlog else None,
                    }
                    for w in winners
                ],
                "leaderboard": _build_leaderboard(c)[:10],  # top 10 preview
            })
        return Response(data)


class ContestDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, pk=pk)
        winners = contest.winners.select_related("user", "best_vlog").order_by("rank")
        leaderboard = _build_leaderboard(contest)

        # Position de l'utilisateur connecté
        my_position = None
        if request.user.is_authenticated:
            for i, row in enumerate(leaderboard):
                if row["user_id"] == request.user.id:
                    my_position = {"rank": i + 1, **row}
                    break

        return Response({
            "id":                contest.id,
            "title":             contest.title,
            "description":       contest.description,
            "rules":             contest.rules,
            "cover_image":       request.build_absolute_uri(contest.cover_image.url) if contest.cover_image else None,
            "metric_type":       contest.metric_type,
            "contest_type":      contest.contest_type,
            "threshold":         contest.threshold,
            "min_vlogs_required":contest.min_vlogs_required,
            "max_winners":       contest.max_winners,
            "prize_amount":      contest.prize_amount,
            "start_date":        contest.start_date,
            "end_date":          contest.end_date,
            "status":            contest.status,
            "is_open":           contest.is_open,
            "winners": [
                {
                    "rank":          w.rank,
                    "user_id":       w.user_id,
                    "name":          w.user.full_name or w.user.email,
                    "won_at":        w.won_at,
                    "score":         w.score,
                    "payout_status": w.payout_status,
                }
                for w in winners
            ],
            "leaderboard":  leaderboard,
            "my_position":  my_position,
        })


# ─── Admin contest views ──────────────────────────────────────

class AdminContestListCreateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        contests = Contest.objects.all()
        data = []
        for c in contests:
            data.append({
                "id": c.id, "title": c.title, "status": c.status,
                "metric_type": c.metric_type, "contest_type": c.contest_type,
                "prize_amount": c.prize_amount, "max_winners": c.max_winners,
                "winners_count": c.winners_count, "start_date": c.start_date,
                "end_date": c.end_date, "threshold": c.threshold,
                "min_vlogs_required": c.min_vlogs_required,
            })
        return Response(data)

    def post(self, request):
        d = request.data
        contest = Contest.objects.create(
            title=d.get("title", ""),
            description=d.get("description", ""),
            rules=d.get("rules", ""),
            metric_type=d.get("metric_type", "vlog_likes"),
            contest_type=d.get("contest_type", "threshold"),
            threshold=d.get("threshold"),
            min_vlogs_required=int(d.get("min_vlogs_required", 0)),
            max_winners=int(d.get("max_winners", 1)),
            prize_amount=int(d.get("prize_amount", 0)),
            start_date=d.get("start_date"),
            end_date=d.get("end_date") or None,
            status=d.get("status", "draft"),
            scoring_weights=d.get("scoring_weights", {}),
        )
        return Response({"id": contest.id, "title": contest.title}, status=status.HTTP_201_CREATED)


class AdminContestDetailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        contest = get_object_or_404(Contest, pk=pk)
        leaderboard = _build_leaderboard(contest)
        winners = list(contest.winners.select_related("user", "best_vlog").order_by("rank").values(
            "id", "rank", "user__full_name", "user__email", "user_id",
            "score", "won_at", "payout_status", "payout_wave_ref",
            "payout_amount", "paid_at", "best_vlog__title",
        ))
        # Ajoute les handles RS de chaque gagnant
        from userauths.models import Profile
        for w in winners:
            try:
                p = Profile.objects.get(user_id=w["user_id"])
                w["tiktok"]    = p.tiktok_handle
                w["instagram"] = p.instagram_handle
                w["facebook"]  = p.facebook_handle
                w["twitter"]   = p.twitter_handle
                w["wave"]      = p.wave_number
            except Profile.DoesNotExist:
                pass
        return Response({
            "id": contest.id, "title": contest.title, "status": contest.status,
            "leaderboard": leaderboard, "winners": winners,
            "metric_type": contest.metric_type, "contest_type": contest.contest_type,
            "threshold": contest.threshold, "prize_amount": contest.prize_amount,
            "start_date": contest.start_date, "end_date": contest.end_date,
            "min_vlogs_required": contest.min_vlogs_required,
        })

    def patch(self, request, pk):
        contest = get_object_or_404(Contest, pk=pk)
        allowed = ["title", "description", "rules", "status", "end_date",
                   "prize_amount", "max_winners", "threshold", "min_vlogs_required"]
        for field in allowed:
            if field in request.data:
                setattr(contest, field, request.data[field] or None if field == "end_date" else request.data[field])
        contest.save()
        return Response({"status": contest.status})


class AdminDeclareWinnerView(APIView):
    """Admin déclare manuellement un gagnant + enregistre la référence Wave."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        contest = get_object_or_404(Contest, pk=pk)
        user_id    = request.data.get("user_id")
        wave_ref   = request.data.get("wave_ref", "")
        payout_amt = int(request.data.get("payout_amount", contest.prize_amount))

        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = get_object_or_404(User, pk=user_id)

        winner, _ = ContestWinner.objects.get_or_create(
            contest=contest, user=user,
            defaults={
                "won_at": timezone.now(),
                "rank": contest.winners_count + 1,
                "payout_amount": payout_amt,
            }
        )
        if wave_ref:
            winner.payout_wave_ref = wave_ref
            winner.payout_status   = "paid"
            winner.paid_at         = timezone.now()
            winner.paid_by         = request.user
            winner.save(update_fields=["payout_wave_ref", "payout_status", "paid_at", "paid_by"])

        # Notifier le gagnant
        notify(user, "points",
               f"Félicitations ! Tu as gagné {payout_amt:,} FCFA 🎉",
               f"Tu remportes le concours « {contest.title} ». Le paiement Wave est en cours.",
               "/vlogs/challenges")

        return Response({"declared": True, "rank": winner.rank})
