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
    permission_classes = [IsAuthenticated]
    serializer_class = SafeUserSerializer

    def get_object(self):
        return self.request.user

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


class PasswordResetEmailVerify(generics.RetrieveAPIView):
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer
    
    def get_object(self):
        email = self.kwargs['email']
        user = User.objects.get(email=email)
        
        if user:
            user.otp = generate_numeric_otp()
            uidb64 = user.pk
            
             # Generate a token and include it in the reset link sent via email
            refresh = RefreshToken.for_user(user)
            reset_token = str(refresh.access_token)

            # Store the reset_token in the user model for later verification
            user.reset_token = reset_token
            user.reset_token_created_at = timezone.now()
            user.save()

            link = f"http://192.168.1.13:8000/create-new-password?otp={user.otp}&uidb64={uidb64}&reset_token={reset_token}"
            
            merge_data = {
                'link': link, 
                'username': user.username, 
            }
            subject = f"Password Reset Request"
            text_body = render_to_string("email/password_reset.txt", merge_data)
            html_body = render_to_string("email/password_reset.html", merge_data)
            
            msg = EmailMultiAlternatives(
                subject=subject, from_email=settings.FROM_EMAIL,
                to=[user.email], body=text_body
            )
            msg.attach_alternative(html_body, "text/html")
            msg.send()
        return user
    

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
