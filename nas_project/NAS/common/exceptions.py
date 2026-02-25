# common/exceptions.py

class NASException(Exception):
    """
    NASシステム全体で発生する業務例外の基底クラス。
    認証失敗、データ不備など、ユーザーへのメッセージ表示が必要なエラーに利用します。
    """
    def __init__(self, message, *args, **kwargs):
        self.message = message
        super().__init__(message, *args, **kwargs)

class AuthenticationException(NASException):
    """認証エラー（dispS100のログイン失敗など）"""
    pass

class DataNotFoundException(NASException):
    """データが見つからなかった場合のエラー"""
    pass

# 必要に応じて他の業務例外クラスを定義します。