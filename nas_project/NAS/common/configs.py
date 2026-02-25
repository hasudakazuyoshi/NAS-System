# common/configs.py

# 利用者種別の定義
class UserType:
    ADMIN = 1  # 管理者
    GENERAL = 2  # 一般利用者

# 仮設定（本番ではsettings.pyなどと連携する場合もあります）
SYSTEM_NAME = "NASシステム"
MAIL_SENDER_ADDRESS = "no-reply@nas-system.com"

# 例外メッセージ定数（多言語対応や管理のためにここに置く場合もあります）
ERROR_MESSAGE_AUTH_FAILED = "IDもしくはパスワードが間違っています。"
