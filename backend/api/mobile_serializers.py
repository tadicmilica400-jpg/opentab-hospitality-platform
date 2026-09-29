# Autori: Ivana Mušikić ([student ID omitted], SSU1-5), Nina Kaljević ([student ID omitted], SSU6-10)
from rest_framework import serializers

from .models import Users


class MobileUserSerializer(serializers.ModelSerializer):
    fullName = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()
    isAnonymous = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = [
            "id",
            "first_name",
            "last_name",
            "fullName",
            "email",
            "phone",
            "username",
            "role",
            "status",
            "image",
            "avatarUrl",
            "isAnonymous",
        ]

    def get_fullName(self, user):
        return f"{user.first_name} {user.last_name}".strip()

    def get_avatarUrl(self, user):
        return user.image or ""

    def get_isAnonymous(self, user):
        meta = self.context.get("session_meta") or {}
        return bool(meta.get("anonymous"))
