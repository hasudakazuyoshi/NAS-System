# common/utils.py

import datetime

def format_date_to_string(dt: datetime.date) -> str:
    """日付オブジェクトを'YYYY/MM/DD'形式の文字列に変換する"""
    if not dt:
        return ""
    return dt.strftime("%Y/%m/%d")

def is_valid_email(email: str) -> bool:
    """メールアドレスの簡易バリデーション (正規表現など)"""
    # ... 実装は省略 ...
    return True

# 他にも、パスワードのハッシュ化（servicesに移す場合も）、ログ記録処理などを定義します。