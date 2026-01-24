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
    class Meta:
        model = Profile
        fields = '__all__'

    def to_representation(self, instance):
        response = super().to_representation(instance)
        response['user'] = SafeUserSerializer(instance.user).data  # CHANGE: safe user au lieu de tout
        return response
