from django.contrib.auth import get_user_model
from .repositories import AdminRepository  # 💡 AdminProfileRepository から AdminRepository に変更
from typing import TypedDict, List
from accounts.models import AdminUser

# テンプレートに渡すデータ型の定義
class AdminInfo(TypedDict):
    admin_id: str
    admin_email: str

class UserData(TypedDict):
    id: str  # ✅ 修正: int から str に変更 (user_id は文字列)
    user_id: str
    email: str
    is_active: bool

class AdminService:
    """
    管理者関連のビジネスロジックを実装するサービス層
    """
    
    # ----------------------------------------------------
    # 管理者情報関連 (dispS108)
    # ----------------------------------------------------

    @staticmethod
    def get_admin_info(admin_user: AdminUser) -> AdminInfo | None:
        """
        ログイン中の管理者から管理者情報を取得し、表示用の辞書として返す
        """
        # AdminAccessMixin (View層) によって AdminUser であることが保証されている前提
        if admin_user.is_authenticated:
            return AdminInfo(
                # AdminUser モデルの属性を直接使用
                admin_id=admin_user.admin_id, 
                admin_email=admin_user.email,
            )
        return None
    
    # ----------------------------------------------------
    # 利用者一覧関連 (dispS104)
    # ----------------------------------------------------

    @staticmethod
    def get_user_list() -> List[UserData]:
        """
        利用者一覧を取得し、画面表示用に加工して返す
        """
        # 💡 修正: AdminRepository を使用し、構文エラーを修正
        users_queryset = AdminRepository.get_all_users()

        user_list: List[UserData] = []
        for user in users_queryset:
            # ✅ 修正: user.id → user.pk (または user.user_id)
            user_list.append({
                'id': user.pk,  # ✅ user.pk を使用 (どのモデルでも動作)
                'user_id': user.user_id,  # ✅ 直接 user_id を使用
                'email': user.email,
                'is_active': user.is_active,
            })

        return user_list
    
    # 💡 delete_user_by_id は複数削除メソッドと重複するため削除します
    
    # ----------------------------------------------------
    # 利用者削除関連 (複数削除/無効化)
    # ----------------------------------------------------

    @staticmethod
    def delete_users_by_ids(user_ids: List[str]) -> int:
        """
        user_idリストを指定して利用者を物理削除する。
        """
        if not user_ids:
            return 0

        try:
            deleted_count = AdminRepository.delete_users_by_user_ids(user_ids)  # メソッド名変更
            return deleted_count
        except Exception:
            return 0