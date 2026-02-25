import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from datetime import timedelta
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


def default_expires_at():
    return timezone.now() + timedelta(hours=1)


# ======================================================
# 共通マネージャー
# ======================================================
class BaseAccountManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Emailアドレスは必須です。')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user 

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


# ======================================================
# 管理者専用マネージャー
# ======================================================
class AdminAccountManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Emailアドレスは必須です。')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


# ======================================================
# 利用者
# ======================================================
class User(AbstractBaseUser, PermissionsMixin):
    user_id = models.CharField(max_length=7, unique=True, primary_key=True)  # primary_key=True を追加

    email = models.EmailField(unique=True, db_column='e_mail')
    email_verified = models.BooleanField(default=False)  # メール認証フラグ
    date_joined = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    height = models.DecimalField(max_digits=4, decimal_places=1, db_column='height', default=0)
    weight = models.DecimalField(max_digits=4, decimal_places=1, db_column='weight', default=0)

    gender = models.CharField(
        max_length=6,
        choices=[('男性', '男性'), ('女性', '女性')],
        db_column='gender'
    )

    birthdate = models.DateField(db_column='date', verbose_name="生年月日", null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = BaseAccountManager()

    class Meta:
        db_table = "user"

    def save(self, *args, **kwargs):
        if not self.user_id:
            prefix = "NU"
            last_user = User.objects.filter(user_id__startswith=prefix).order_by('-user_id').first()
            next_num = int(last_user.user_id[2:]) + 1 if last_user and last_user.user_id[2:].isdigit() else 1
            self.user_id = f"{prefix}{next_num:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user_id} / {self.email}"



# ======================================================
# 管理者
# ======================================================
class AdminUser(AbstractBaseUser, PermissionsMixin):
    admin_id = models.CharField(max_length=7, unique=True, primary_key=True, db_column='admin_id')  # primary_key=True を追加

    email = models.EmailField(unique=True, null=False, db_column='a_email')
    email_verified = models.BooleanField(default=False)  # メール認証フラグ
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)
    is_superuser = models.BooleanField(default=False)

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='admin_groups',
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='admin_permissions_set',
        blank=True
    )

    objects = AdminAccountManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "admin"

    def save(self, *args, **kwargs):
        if not self.admin_id:
            prefix = "NA"
            last_admin = AdminUser.objects.filter(admin_id__startswith=prefix).order_by('-admin_id').first()
            next_num = int(last_admin.admin_id[2:]) + 1 if last_admin and last_admin.admin_id[2:].isdigit() else 1
            self.admin_id = f"{prefix}{next_num:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.admin_id} / {self.email}"



# ======================================================
# 認証トークン（共通）
# ======================================================
class VerificationToken(models.Model):
    TOKEN_TYPE_CHOICES = [
        ('REGISTRATION', '新規登録'),
        ('PASSWORD_RESET', 'パスワードリセット'),
        ('EMAIL_CHANGE', 'メール変更'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='user_tokens')
    admin = models.ForeignKey(AdminUser, on_delete=models.CASCADE, null=True, blank=True, related_name='admin_tokens')

    # ★仮登録と紐づける
    pre_registration = models.ForeignKey(
        'PreRegistration',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='verification_tokens'
    )

    token = models.UUIDField(default=uuid.uuid4, unique=True)
    token_type = models.CharField(max_length=20, choices=TOKEN_TYPE_CHOICES)
    expires_at = models.DateTimeField(default=default_expires_at)

    def is_expired(self):
        return timezone.now() > self.expires_at



# ======================================================
# メールアドレス変更（ユーザー/管理者共通）
# ======================================================
class PendingEmailChange(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=50)
    user = GenericForeignKey('content_type', 'object_id')

    new_email = models.EmailField(unique=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    is_verified = models.BooleanField(default=False)

    def is_expired(self):
        return (timezone.now() - self.created_at).days >= 1  # 1日有効


# ======================================================
# 仮登録
# ======================================================
class PreRegistration(models.Model):
    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=default_expires_at)

    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"PreRegistration({self.email}, used={self.is_used})"

class Device(models.Model):
    device_id = models.CharField(max_length=50, unique=True)
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='devices')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.device_id} ({self.user.email})"