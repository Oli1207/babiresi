from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from .models import Destination
from .serializers import DestinationSerializer, DestinationListSerializer
from vlogs.models import Vlog
from vlogs.serializers import VlogSerializer
from services.serializers import GuideSerializer, RestaurantSerializer, ActivitySerializer, ArtisanSerializer
from services.models import Guide, Restaurant, Activity, Artisan


class DestinationListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Destination.objects.filter(is_published=True)
        region = request.query_params.get("region")
        featured = request.query_params.get("featured")
        if region:
            qs = qs.filter(region=region)
        if featured:
            qs = qs.filter(is_featured=True)
        serializer = DestinationListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)


class DestinationDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        destination = get_object_or_404(Destination, slug=slug, is_published=True)
        data = DestinationSerializer(destination, context={"request": request}).data

        data["vlogs"] = VlogSerializer(
            Vlog.objects.filter(destination=destination, is_published=True)[:12],
            many=True, context={"request": request}
        ).data
        data["guides"] = GuideSerializer(
            Guide.objects.filter(destinations=destination, is_verified=True)[:6],
            many=True, context={"request": request}
        ).data
        data["restaurants"] = RestaurantSerializer(
            Restaurant.objects.filter(destination=destination, is_active=True)[:8],
            many=True, context={"request": request}
        ).data
        data["activities"] = ActivitySerializer(
            Activity.objects.filter(destination=destination, is_active=True)[:8],
            many=True, context={"request": request}
        ).data
        data["artisans"] = ArtisanSerializer(
            Artisan.objects.filter(destination=destination, is_verified=True)[:6],
            many=True, context={"request": request}
        ).data

        return Response(data)


class AdminDestinationView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs = Destination.objects.all()
        return Response(DestinationSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = DestinationSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminDestinationDetailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        d = get_object_or_404(Destination, pk=pk)
        return Response(DestinationSerializer(d, context={"request": request}).data)

    def put(self, request, pk):
        d = get_object_or_404(Destination, pk=pk)
        serializer = DestinationSerializer(d, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        d = get_object_or_404(Destination, pk=pk)
        d.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
