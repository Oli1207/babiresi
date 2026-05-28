from rest_framework import serializers
from .models import Destination


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = [
            "id", "name", "slug", "region", "description", "description_en",
            "cover_image", "latitude", "longitude", "practical_info",
            "is_published", "is_featured", "order",
        ]
        read_only_fields = ["slug"]


class DestinationListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = ["id", "name", "slug", "region", "cover_image", "is_featured"]
