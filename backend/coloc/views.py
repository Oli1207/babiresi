from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone

from .models import (
    ColocProfile, ColocPhoto, ColocSwipe, ColocMatch, ColocMessage,
    FREE_SWIPES_PER_DAY,
)
from .serializers import (
    ColocProfileSerializer, ColocPhotoSerializer,
    ColocMatchSerializer, ColocMessageSerializer,
)


# ─────────────────────────────────────────────────────────────
# Mon profil coloc
# ─────────────────────────────────────────────────────────────

class MyColocProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = ColocProfile.objects.get_or_create(user=request.user)
        return Response(ColocProfileSerializer(profile, context={'request': request}).data)

    def patch(self, request):
        profile, _ = ColocProfile.objects.get_or_create(user=request.user)
        EDITABLE = [
            'profile_type', 'bio', 'age', 'occupation', 'gender',
            'budget_min', 'budget_max',
            'place_zone', 'place_description', 'place_rent_total', 'place_rent_share',
            'preferred_zones', 'move_in_date', 'gender_pref',
            'lifestyle', 'interests', 'is_active',
        ]
        for field in EDITABLE:
            if field in request.data:
                setattr(profile, field, request.data[field])
        profile.save()
        return Response(ColocProfileSerializer(profile, context={'request': request}).data)


# ─────────────────────────────────────────────────────────────
# Photos profil coloc (Cloudinary direct upload côté frontend)
# ─────────────────────────────────────────────────────────────

class ColocPhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Ajouter une photo (URL Cloudinary déjà uploadée côté frontend)."""
        profile, _ = ColocProfile.objects.get_or_create(user=request.user)
        url    = request.data.get('cloudinary_url', '')
        pub_id = request.data.get('cloudinary_public_id', '')
        is_cover = request.data.get('is_cover', False)

        if not url:
            return Response({'detail': 'cloudinary_url requis.'}, status=400)

        if is_cover:
            profile.photos.update(is_cover=False)

        order = profile.photos.count()
        photo = ColocPhoto.objects.create(
            profile=profile,
            cloudinary_url=url,
            cloudinary_public_id=pub_id,
            is_cover=bool(is_cover) or order == 0,
            order=order,
        )
        return Response(ColocPhotoSerializer(photo).data, status=201)

    def delete(self, request, photo_id):
        profile = get_object_or_404(ColocProfile, user=request.user)
        photo   = get_object_or_404(ColocPhoto, id=photo_id, profile=profile)
        was_cover = photo.is_cover
        photo.delete()
        if was_cover:
            first = profile.photos.first()
            if first:
                first.is_cover = True
                first.save(update_fields=['is_cover'])
        return Response(status=204)


# ─────────────────────────────────────────────────────────────
# Feed — profils à swiper
# ─────────────────────────────────────────────────────────────

class ColocFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = ColocProfile.objects.get_or_create(user=request.user)

        # IDs déjà swipés
        already_swiped = ColocSwipe.objects.filter(
            swiper=request.user
        ).values_list('target_id', flat=True)

        # Profils actifs, pas le sien, pas encore swipés
        qs = ColocProfile.objects.filter(
            is_active=True
        ).exclude(
            id__in=already_swiped
        ).exclude(
            user=request.user
        ).prefetch_related('photos').select_related('user', 'user__profile')

        # Filtre budget si défini
        if profile.budget_max > 0:
            qs = qs.filter(budget_max__gte=profile.budget_min)

        # Filtre préférence de genre
        if profile.gender_pref != 'any':
            qs = qs.filter(gender=profile.gender_pref)

        # Limite à 20 profils, tri par date (les plus récents d'abord)
        profiles = qs.order_by('-created_at')[:20]

        data = ColocProfileSerializer(
            profiles, many=True, context={'request': request}
        ).data

        # Trier par score de compatibilité décroissant
        data = sorted(data, key=lambda x: x.get('compatibility') or 0, reverse=True)

        return Response({
            'profiles': data,
            'swipes_left': profile.swipes_left,
            'is_premium': profile.is_premium,
            'free_limit': FREE_SWIPES_PER_DAY,
        })


# ─────────────────────────────────────────────────────────────
# Swipe
# ─────────────────────────────────────────────────────────────

class ColocSwipeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, profile_id):
        my_profile, _ = ColocProfile.objects.get_or_create(user=request.user)
        target = get_object_or_404(ColocProfile, id=profile_id)

        if target.user == request.user:
            return Response({'detail': 'Impossible de se swiper soi-même.'}, status=400)

        # Vérifier quota
        if not my_profile.can_swipe():
            return Response({
                'detail': f'Limite de {FREE_SWIPES_PER_DAY} swipes/jour atteinte. Passe en premium pour illimité.',
                'quota_exceeded': True,
            }, status=429)

        liked = bool(request.data.get('liked', True))

        swipe, created = ColocSwipe.objects.get_or_create(
            swiper=request.user,
            target=target,
            defaults={'liked': liked},
        )
        if not created:
            return Response({'detail': 'Déjà swipé.'}, status=400)

        my_profile.consume_swipe()

        matched = False
        match_id = None

        if liked:
            # Vérifier si l'autre a déjà liké
            reverse = ColocSwipe.objects.filter(
                swiper=target.user,
                target=my_profile,
                liked=True,
            ).exists()

            if reverse:
                # Créer le match (ordre canonique user1.id < user2.id)
                u1, u2 = sorted([request.user, target.user], key=lambda u: u.id)
                match, _ = ColocMatch.objects.get_or_create(user1=u1, user2=u2)
                matched   = True
                match_id  = match.id

        return Response({
            'liked':      liked,
            'matched':    matched,
            'match_id':   match_id,
            'swipes_left': my_profile.swipes_left,
        })


# ─────────────────────────────────────────────────────────────
# Matchs
# ─────────────────────────────────────────────────────────────

class ColocMatchListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        matches = ColocMatch.objects.filter(
            Q(user1=request.user) | Q(user2=request.user),
            is_active=True,
        ).select_related('user1', 'user2', 'user1__profile', 'user2__profile')

        return Response(ColocMatchSerializer(
            matches, many=True, context={'request': request}
        ).data)


# ─────────────────────────────────────────────────────────────
# Messages (polling)
# ─────────────────────────────────────────────────────────────

class ColocChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_match(self, request, match_id):
        return get_object_or_404(
            ColocMatch,
            Q(user1=request.user) | Q(user2=request.user),
            id=match_id, is_active=True,
        )

    def get(self, request, match_id):
        """Récupérer les messages. Marque les messages reçus comme lus."""
        match = self._get_match(request, match_id)
        since = request.query_params.get('since')  # ISO timestamp pour polling

        qs = match.messages.all()
        if since:
            qs = qs.filter(created_at__gt=since)

        # Marquer comme lus
        match.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        return Response(ColocMessageSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request, match_id):
        """Envoyer un message."""
        match   = self._get_match(request, match_id)
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': 'Message vide.'}, status=400)

        msg = ColocMessage.objects.create(match=match, sender=request.user, content=content)
        return Response(ColocMessageSerializer(msg, context={'request': request}).data, status=201)


# ─────────────────────────────────────────────────────────────
# Profil public (vu par les autres)
# ─────────────────────────────────────────────────────────────

class ColocPublicProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, profile_id):
        profile = get_object_or_404(ColocProfile, id=profile_id, is_active=True)
        return Response(ColocProfileSerializer(profile, context={'request': request}).data)
