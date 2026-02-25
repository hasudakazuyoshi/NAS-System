# common/dtos.py

from typing import Optional

# ユーザー情報の一部を表現するDTO (既存)
class UserInfoDto:
    def __init__(self, user_id: str, email: str, is_admin: bool):
        self.user_id = user_id
        self.email = email
        self.is_admin = is_admin

# ヘッダー情報など、共通して使うDTOを定義します。(既存)
class HeaderInfoDto:
    def __init__(self, login_user_email: str, current_screen_id: str):
        self.login_user_email = login_user_email
        self.current_screen_id = current_screen_id

# --- 💡 ここから追加 ---

# 🔥 修正：仮登録用DTO（メールアドレスのみ）
class PreRegistrationDto:
    def __init__(self, email: str):
        self.email = email

# 新規利用者登録および本登録時に利用するDTO
# dispS101 (新規利用者登録) + dispS102 (本登録) の全項目を格納
class UserRegistrationDto:
    def __init__(
        self,
        email: str,
        password: str,
        name: str,
        sex: int,
        birthday: str,
        height: Optional[float] = None,
        weight: Optional[float] = None,
        device_id: Optional[str] = None,
    ):
        self.email = email
        self.password = password
        self.name = name
        self.sex = sex
        self.birthday = birthday
        self.height = height
        self.weight = weight
        self.device_id = device_id


# 利用者情報（dispS113）表示・更新に利用するDTO
class UserProfileDto:
    def __init__(
        self,
        sex: int,
        birthday: str,
        password: Optional[str] = None,
        email: Optional[str] = None,
        device_id: Optional[str] = None,
        height: Optional[float] = None,
        weight: Optional[float] = None,
        
    ):
        self.password = password
        self.email = email
        self.sex = sex
        self.birthday = birthday
        self.height = height
        self.weight = weight
        self.device_id = device_id

# --- 💡 ここまで追加 ---