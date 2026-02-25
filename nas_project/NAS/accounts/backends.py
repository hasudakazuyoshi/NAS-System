from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
from .models import User, AdminUser


class UserOrAdminBackend(BaseBackend):

    def authenticate(self, request, email=None, password=None, user_id=None, **kwargs):
        if not password:
            return None

        DjangoUser = get_user_model()

        # --------------------------------------
        # superuser は最優先で admin として扱う
        # --------------------------------------
        try:
            su = DjangoUser.objects.get(email=email)
            if su.is_superuser and su.check_password(password):
                su._user_type = "admin"
                return su
        except DjangoUser.DoesNotExist:
            pass

        # --------------------------------------
        # AdminUser 認証
        # --------------------------------------
        try:
            admin = AdminUser.objects.get(email=email.strip().lower())
            if admin.check_password(password) and admin.is_active:
                admin._user_type = "admin"
                return admin
        except AdminUser.DoesNotExist:
            pass

        # --------------------------------------
        # User 認証
        # --------------------------------------
        try:
            user = User.objects.get(email=email.strip().lower())
            if user.check_password(password) and user.is_active:
                user._user_type = "user"
                return user
        except User.DoesNotExist:
            pass

        return None

    # --------------------------------------
    # セッション復元は pk （標準id）だけでOK
    # --------------------------------------
    def get_user(self, pk):
        DjangoUser = get_user_model()

        for model in [AdminUser, User, DjangoUser]:
            try:
                return model.objects.get(pk=pk)
            except model.DoesNotExist:
                continue
        return None
