# userauths/views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.conf import settings
from decimal import Decimal
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail

from .models import *
from .serializers import *

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny, )
    serializer_class = RegisterSerializer

# NEW: /auth/me/ -> renvoie l'utilisateur connecté (safe)
class MeView(generics.RetrieveAPIView):
    """✅ GET /user/me/ : renvoie l'utilisateur connecté (safe)."""
    permission_classes = [IsAuthenticated]
    serializer_class = SafeUserSerializer

    def get_object(self):
        return self.request.user


# ✅ NEW: /user/me/update/ -> update user + profile (inclut photo)
class MeUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)  # IMPORTANT: pour upload photo

    def put(self, request):
        serializer = MeUpdateSerializer(
            instance=request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        return self.put(request)


# ✅ NEW: /user/me/change-password/ -> changer mot de passe
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": "Ancien mot de passe incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save()

        # NOTE: si tu utilises SimpleJWT + rotation/blacklist, tu peux forcer logout côté front.
        return Response({"detail": "Mot de passe mis à jour ✅"}, status=status.HTTP_200_OK)

class ProfileView(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        user_id = self.kwargs['user_id']
        user = User.objects.get(id=user_id)
        profile = Profile.objects.get(user=user)
        return profile

from rest_framework_simplejwt.tokens import AccessToken
from django.utils import timezone
import random
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.core.mail import EmailMultiAlternatives

def generate_numeric_otp(length=7):
        # Generate a random 7-digit OTP
        otp = ''.join([str(random.randint(0, 9)) for _ in range(length)])
        return otp


# userauths/views.py
class PasswordResetEmailVerify(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")

        if not email:
            return Response(
                {"error": "Email requis"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"error": "Email introuvable"},
                status=status.HTTP_404_NOT_FOUND
            )

        # OTP
        user.otp = generate_numeric_otp()
        uidb64 = user.pk

        refresh = RefreshToken.for_user(user)
        reset_token = str(refresh.access_token)

        user.reset_token = reset_token
        user.reset_token_created_at = timezone.now()
        user.save()

        link = (
            f"https://decrouresi.com/create-new-password"
            f"?otp={user.otp}&uidb64={uidb64}&reset_token={reset_token}"
        )

        merge_data = {
            "link": link,
            "username": user.username,
        }

        subject = "Password Reset Request"
        text_body = render_to_string("email/password_reset.txt", merge_data)
        html_body = render_to_string("email/password_reset.html", merge_data)

        msg = EmailMultiAlternatives(
            subject=subject,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
            body=text_body,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()

        return Response(
            {"message": "Email de réinitialisation envoyé"},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmAPIView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        otp = request.data.get("otp")
        uidb64 = request.data.get("uidb64")
        reset_token = request.data.get("reset_token")
        new_password = request.data.get("new_password")

        try:
            user = User.objects.get(pk=uidb64, otp=otp, reset_token=reset_token)

            # Vérifie que le token est valide
            AccessToken(reset_token)

            if not user.reset_token_created_at or timezone.now() > user.reset_token_created_at + timedelta(minutes=2):
                return Response({"error": "Lien expiré. Veuillez refaire la demande."}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.otp = None
            user.reset_token = None
            user.save()

            return Response({"message": "Mot de passe mis à jour avec succès."}, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "Lien invalide ou expiré."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# Notifications
# ============================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as drf_status, permissions
from .models import Notification


def notify(user, type, title, message, link=""):
    """Helper pour créer une notification in-app."""
    Notification.objects.create(user=user, type=type, title=title, message=message, link=link)


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifs = Notification.objects.filter(user=request.user)[:50]
        data = [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ]
        unread = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"results": data, "unread_count": unread})


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notif_ids = request.data.get("ids", [])
        if notif_ids:
            Notification.objects.filter(user=request.user, id__in=notif_ids).update(is_read=True)
        else:
            Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"marked": True})

