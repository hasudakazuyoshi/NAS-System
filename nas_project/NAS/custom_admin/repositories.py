# custom_admin/repositories.py (物理削除対応版)

from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from typing import List
from accounts.models import AdminUser, PendingEmailChange

# DjangoのUserモデルを取得（accounts.Userのはず）
User = get_user_model() 

class AdminRepository:
    """
    管理者アプリに必要なデータベース操作を抽象化するリポジトリ層
    （AdminUserとUserモデルの両方を扱う）
    """
    
    # ----------------------------------------------------
    # AdminUser関連 (管理者自身の情報)
    # ----------------------------------------------------

    @staticmethod
    def get_admin_user_by_pk(pk: int) -> AdminUser | None:
        """
        プライマリキーでAdminUserを取得する
        (AdminProfileRepository.get_profile_by_user の代替)
        """
        try:
            return AdminUser.objects.get(pk=pk)
        except AdminUser.DoesNotExist:
            return None
    
    # ----------------------------------------------------
    # 利用者 (User) 関連
    # ----------------------------------------------------

    @staticmethod
    def get_all_users() -> QuerySet[User]:
        """
        管理者ではない有効な利用者一覧を取得する
        """
        return User.objects.filter(is_staff=False, is_active=True).order_by('email')
    
    # ----------------------------------------------------
    # 利用者削除関連 (物理削除)
    # ----------------------------------------------------

    @staticmethod
    @transaction.atomic
    def delete_users_by_user_ids(user_ids: List[str]) -> int:
        """
        user_id（例: 'NU00001'）のリストを指定して、複数の利用者を物理削除する。
        
        削除される関連データ（CASCADE設定済み）:
        - HealthData (健康データ)
        - SleepData (睡眠データ)
        - Device (デバイス)
        - VerificationToken (認証トークン)
        
        削除されないデータ:
        - AccessLog (ログは履歴として保持)
        """
        if not user_ids:
            return 0

        # 💡 削除前に PendingEmailChange をクリーンアップ
        # GenericForeignKey は CASCADE が自動で動作しないため手動削除
        user_content_type = ContentType.objects.get_for_model(User)
        PendingEmailChange.objects.filter(
            content_type=user_content_type,
            object_id__in=user_ids
        ).delete()

        # 💡 物理削除実行
        deleted_count, _ = User.objects.filter(
            user_id__in=user_ids,
            is_staff=False  # 管理者は削除しない
        ).delete()

        return deleted_count