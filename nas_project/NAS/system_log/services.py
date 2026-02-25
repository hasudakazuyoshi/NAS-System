# system_log/services.py
from typing import List, Dict, Any, Optional
from django.contrib.auth.models import AbstractBaseUser
from dateutil import parser
import logging

from .repository import LogRepository

logger = logging.getLogger(__name__)


class LogService:
    """
    ログ記録と取得のビジネスロジックを担うサービス層
    """
    
    @staticmethod
    def get_loggable_id(user: AbstractBaseUser) -> Optional[str]:
        """
        ユーザーオブジェクトからログに記録すべきカスタムID文字列を取得する。
        """
        # 1. 匿名ユーザーの場合
        if not user.is_authenticated:
            return 'NA00000' 
        
        # 2. 認証済みユーザーの場合
        # AdminUser かどうかをチェック
        if hasattr(user, 'admin_id') and user.admin_id:
            return user.admin_id  # NA0000X を返す
        
        # User (利用者) かどうかをチェック
        elif hasattr(user, 'user_id') and user.user_id:
            return user.user_id  # NU0000X を返す
        
        # 3. どちらでもなかったり、IDが設定されていない場合
        return None
    
    @staticmethod
    def log_session_start(user: AbstractBaseUser):
        """
        ログインイベントを記録
        """
        user_id = LogService.get_loggable_id(user)
        
        if user_id is None:
            pk_info = user.pk if hasattr(user, 'pk') else 'N/A'
            logger.error(
                f"ログ記録失敗: ユーザーのカスタムIDの取得に失敗しました。"
                f"ユーザー種別: {type(user).__name__}, PK: {pk_info}"
            )
            return
        
        try:
            LogRepository.log_session_start(user_id)
        except Exception as e:
            logger.error(f"ログイン記録エラー: {e}")
    
    @staticmethod
    def log_session_end(user: AbstractBaseUser):
        """
        ログアウトイベントを記録
        """
        user_id = LogService.get_loggable_id(user)
        
        if user_id is None:
            pk_info = user.pk if hasattr(user, 'pk') else 'N/A'
            logger.error(
                f"ログ記録失敗: ユーザーのカスタムIDの取得に失敗しました。"
                f"ユーザー種別: {type(user).__name__}, PK: {pk_info}"
            )
            return
        
        try:
            LogRepository.log_session_end(user_id)
        except Exception as e:
            logger.error(f"ログアウト記録エラー: {e}")
    
    @staticmethod
    def get_access_logs(
        user_id: Optional[str] = None,
        start_time_str: Optional[str] = None,
        end_time_str: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        アクセスログを取得してフロントエンド用に整形
        """
        # 日時文字列をdatetimeに変換
        start_time = None
        end_time = None
        
        if start_time_str:
            try:
                start_time = parser.parse(start_time_str)
            except Exception as e:
                logger.warning(f"開始日時のパース失敗: {start_time_str} - {e}")
        
        if end_time_str:
            try:
                end_time = parser.parse(end_time_str)
            except Exception as e:
                logger.warning(f"終了日時のパース失敗: {end_time_str} - {e}")
        
        # Repositoryからログ取得
        try:
            logs = LogRepository.get_logs(
                user_id=user_id,
                start_time=start_time,
                end_time=end_time
            )
            
            # フロントエンド用に整形
            return [
                {
                    'user_id': log.user_id,
                    'timestamp': log.timestamp.isoformat(),
                    'action': log.action,
                }
                for log in logs
            ]
        
        except Exception as e:
            logger.error(f"ログ取得エラー: {e}")
            return []