# userauths/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.tokens import Token
from userauths.models import *
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.utils.functional import cached_property
from backend.settings import SIMPLE_JWT
from typing import TYPE_CHECKING, Any, List, Optional, Union

# NEW: sérialiseur "safe" pour ne pas renvoyer d'infos sensibles
class SafeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "full_name", "username", "phone")

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['full_name'] = user.full_name
        token['email'] = user.email
        token['username'] = user.username
        try:
            token['vendor_id'] = user.vendor.id
        except:
            token['vendor_id'] = 0
        return token

    # NEW: ajouter l'objet user dans la réponse du login
    def validate(self, attrs):
        data = super().validate(attrs)  # -> {access, refresh}
        data["user"] = SafeUserSerializer(self.user).data
        return data

    def __str__(self) -> str:
        return f"TokenUser {self.id}"

    @cached_property
    def id(self) -> Union[int, str]:
        return self.token[SIMPLE_JWT.USER_ID_CLAIM]

    @cached_property
    def pk(self) -> Union[int, str]:
        return self.id

    @cached_property
    def username(self) -> str:
        return self.token.get("username", "")

    @property
    def is_anonymous(self) -> bool:
        return False

    @property
    def is_authenticated(self) -> bool:
        return True

    def get_username(self) -> str:
        return self.username


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['full_name', 'email', 'phone', 'password', 'password2']

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'mot de passe': "Mot de passe différent"})
        return attrs

    def create(self, validated_data):
        user = User.objects.create(
            full_name = validated_data['full_name'],
            email = validated_data['email'],
            phone = validated_data['phone'],
        )
        email_user, mobile = user.email.split("@")
        user.username = email_user
        user.set_password(validated_data['password'])
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class ProfileSerializer(serializers.ModelSerializer):
    # ✅ NEW: URL absolue de l'image (pour le frontend)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = '__all__'

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def to_representation(self, instance):
        response = super().to_representation(instance)
        response['user'] = SafeUserSerializer(instance.user).data  # CHANGE: safe user au lieu de tout
        return response


# =========================================================
# ✅ NEW: update profil + changement mot de passe
# =========================================================

class MeUpdateSerializer(serializers.Serializer):
    # User
    full_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # Profile
    image = serializers.FileField(required=False, allow_null=True)
    about = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    country = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    state = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def update(self, instance, validated_data):
        """
        instance = request.user
        -> on met à jour User + Profile.
        """
        user = instance
        profile, _ = Profile.objects.get_or_create(user=user)

        # ✅ CHANGE: champs User
        if "full_name" in validated_data:
            user.full_name = validated_data.get("full_name")
        if "phone" in validated_data:
            user.phone = validated_data.get("phone")
        user.save()

        # ✅ CHANGE: champs Profile
        for f in ["about", "gender", "country", "state", "city", "address"]:
            if f in validated_data:
                setattr(profile, f, validated_data.get(f))

        # ✅ CHANGE: upload image
        if "image" in validated_data:
            profile.image = validated_data.get("image")

        profile.full_name = profile.full_name or user.full_name
        profile.phone = profile.phone or user.phone
        profile.save()

        return user

    def to_representation(self, instance):
        """On renvoie user + profile (comme ton OwnerDashboard le fait déjà)."""
        user = instance
        profile = getattr(user, "profile", None)
        if not profile:
            profile = Profile.objects.filter(user=user).first()

        # IMPORTANT: passer request au ProfileSerializer pour image_url absolue
        request = self.context.get("request")
        p_data = ProfileSerializer(profile, context={"request": request}).data if profile else None

        return {
            "user": SafeUserSerializer(user).data,
            "profile": p_data,
        }


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs.get("new_password") != attrs.get("new_password2"):
            raise serializers.ValidationError({"new_password2": "Les mots de passe ne correspondent pas."})
        return attrs
