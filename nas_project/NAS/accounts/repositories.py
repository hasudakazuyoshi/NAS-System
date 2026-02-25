from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import Model
from accounts.models import User, AdminUser
from accounts.models import VerificationToken


class UserRepository:
    """
    User / AdminUser を共通で扱うリポジトリ
    """

    # ----------------------------
    # 取得
    # ----------------------------
    def get_user_by_email(self, email: str) -> Model | None:
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            try:
                return AdminUser.objects.get(email=email)
            except AdminUser.DoesNotExist:
                return None

    def get_user_by_id(self, user_id: str) -> Model | None:
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            try:
                return AdminUser.objects.get(pk=user_id)
            except AdminUser.DoesNotExist:
                return None

    # ----------------------------
    # 作成
    # ----------------------------
    def create_user(self, email: str, password: str, **fields):
        """
        利用者作成（User）
        User モデルは height, weight, gender, birthdate が必須のため
        fields を必須とする
        """
        with transaction.atomic():
            return User.objects.create_user(email=email, password=password, **fields)

    def create_admin(self, email: str, password: str):
        """管理者作成（AdminUser）"""
        with transaction.atomic():
            return AdminUser.objects.create_user(email=email, password=password)

    # ----------------------------
    # 更新
    # ----------------------------
    def update_user_profile(self, user: Model, profile_data: dict):
        ALLOWED_FIELDS = ["height", "weight", "gender", "birthdate"]

        with transaction.atomic():
            for key, value in profile_data.items():
                if key in ALLOWED_FIELDS:
                    setattr(user, key, value)
            user.save()
            return user

    def activate_user(self, user: Model):
        with transaction.atomic():
            user.is_active = True
            user.save(update_fields=["is_active"])
            return user

    def set_user_password(self, user: Model, new_password: str):
        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=["password"])
            return user

    # ----------------------------
    # email変更（直接変更禁止）
    # ----------------------------
    def change_user_email(self, user: Model, new_email: str):
        """
        ※ PendingEmailChange を使用するため基本使わない
        """
        with transaction.atomic():
            user.email = new_email
            user.save(update_fields=["email"])
            return user

    # ----------------------------
    # 存在確認
    # ----------------------------
    def exists_by_email(self, email: str) -> bool:
        return (
            User.objects.filter(email=email).exists() or
            AdminUser.objects.filter(email=email).exists()
        )

    # ----------------------------
    # 保存・削除
    # ----------------------------
    def save(self, instance: Model) -> Model:
        instance.save()
        return instance

    def delete(self, user: Model):
        with transaction.atomic():
            user.delete()



class VerificationTokenRepository:

    def save(self, token: VerificationToken) -> VerificationToken:
        with transaction.atomic():
            token.save()
        return token

    def create_verification_token(self, user_or_admin: Model, token_type: str) -> VerificationToken:
        with transaction.atomic():

            if isinstance(user_or_admin, User):
                VerificationToken.objects.filter(user=user_or_admin, token_type=token_type).delete()
                return VerificationToken.objects.create(user=user_or_admin, token_type=token_type)

            elif isinstance(user_or_admin, AdminUser):
                VerificationToken.objects.filter(admin=user_or_admin, token_type=token_type).delete()
                return VerificationToken.objects.create(admin=user_or_admin, token_type=token_type)

            else:
                raise ValueError("Invalid user type")

    def get_token_by_uuid(self, token_uuid: str, token_type: str):
        try:
            return VerificationToken.objects.get(token=token_uuid, token_type=token_type)
        except VerificationToken.DoesNotExist:
            return None

    def delete_token(self, token: VerificationToken):
        with transaction.atomic():
            token.delete()

    def delete_by_user(self, user_or_admin: Model):
        with transaction.atomic():
            if isinstance(user_or_admin, User):
                VerificationToken.objects.filter(user=user_or_admin).delete()
            elif isinstance(user_or_admin, AdminUser):
                VerificationToken.objects.filter(admin=user_or_admin).delete()

    def delete_by_user_and_type(self, user_or_admin: Model, token_type: str):
        with transaction.atomic():
            if isinstance(user_or_admin, User):
                VerificationToken.objects.filter(user=user_or_admin, token_type=token_type).delete()
            elif isinstance(user_or_admin, AdminUser):
                VerificationToken.objects.filter(admin=user_or_admin, token_type=token_type).delete()

class DeviceRepository:

    @staticmethod
    def get_user_devices(user_id: str):
        from accounts.models import Device
        return list(Device.objects.filter(user_id=user_id).values_list("device_id", flat=True))
