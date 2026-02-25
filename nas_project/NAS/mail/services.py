# mail/services.py

from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives 
from django.template.loader import render_to_string
from typing import List, Dict, Any, Optional
import logging
from django.urls import reverse
from urllib.parse import urlparse, parse_qs
logger = logging.getLogger(__name__)

class MailService:

    # ==================== ✅ 汎用メール送信メソッド（追加） ====================
    @staticmethod
    def send_email(
        recipient_email: str,
        template_type: str,
        context: Dict[str, Any]
    ) -> bool:
        """
        汎用メール送信（テンプレートタイプで分岐）
        """
        
        templates = {
            'ACCOUNT_VERIFICATION': {
                'subject': '【NASシステム】利用者登録のご確認',
                'template_name': 'verification_email'
            },
            'EMAIL_CHANGE_VERIFICATION': {
                'subject': '【NASシステム】メールアドレス変更確認',
                'template_name': 'email_change_verification'
            },
            'PASSWORD_RESET': {
                'subject': '【NASシステム】パスワードリセットのご案内',
                'template_name': 'password_reset_email'
            }
        }
        
        if template_type not in templates:
            logger.error(f"Unknown template type: {template_type}")
            return False
        
        template_config = templates[template_type]
        
        return MailService.send_templated_email(
            recipient_list=[recipient_email],
            subject=template_config['subject'],
            template_name=template_config['template_name'],
            context=context,
            mail_type=template_type
        )

    # ==================== 既存のメソッド ====================
    
    @staticmethod
    def send_templated_email(
        recipient_list: List[str],
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        mail_type: Optional[str] = None,
    ) -> bool:
        
        try:
            text_body = render_to_string(f'mail/{template_name}.txt', context)
            html_body = render_to_string(f'mail/{template_name}.html', context)
        
        except Exception as e:
            logger.error(f"Mail Template Error for {template_name}: {e}")
            return False
        
        sender_email = settings.DEFAULT_FROM_EMAIL

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=sender_email,
                to=recipient_list,
            )
            
            if html_body:
                msg.attach_alternative(html_body, "text/html")

            msg.send()

            logger.info(f"Email sent successfully: {mail_type} to {recipient_list}")
            return True
        
        except Exception as e:
            logger.error(f"Email Sending Error for {template_name}: {e}", exc_info=True)
            return False

    # ==================== 1. アカウント確認メール ====================
    @staticmethod  
    def send_verification_email(
        email: str, 
        token: str, 
        request=None,
        web_url: str = None,
        app_url: str = None
    ) -> bool:
        """
        アカウント確認メール(Web/アプリ両対応)
        """
        # リダイレクトページ経由のURL
        base_url = getattr(settings, 'CLOUDFLARE_TUNNEL_URL', settings.BASE_URL)
        redirect_url = f"{base_url}/accounts/app-redirect/?token={token}&action=verify-email"
        
        context = {
            'verification_url': redirect_url,  # 1つのリンクに統合
            'web_url': redirect_url,  # 互換性のため
            'app_url': redirect_url,  # 互換性のため
        }
        
        return MailService.send_email(
            recipient_email=email,
            template_type='ACCOUNT_VERIFICATION',
            context=context
        )
    
    # ==================== 2. メールアドレス変更確認メール ====================
    @staticmethod
    def send_email_change_verification(
        recipient_email: str, 
        token: str,
        request=None,
        web_url: str = None,
        app_url: str = None
    ) -> bool:
        """
        メールアドレス変更確認メール（Web/アプリ両対応）
        """
        # リダイレクトページ経由のURL
        base_url = getattr(settings, 'CLOUDFLARE_TUNNEL_URL', settings.BASE_URL)
        redirect_url = f"{base_url}/accounts/app-redirect/?token={token}&action=email-change"
        
        context = {
            'verification_url': redirect_url,  # 1つのリンクに統合
            'web_url': redirect_url,  # 互換性のため
            'app_url': redirect_url,  # 互換性のため
            'verify_url': redirect_url,  # 既存テンプレートとの互換性
        }

        return MailService.send_email(
            recipient_email=recipient_email,
            template_type='EMAIL_CHANGE_VERIFICATION',
            context=context
        )

    # ==================== 3. パスワードリセットメール ====================
    @staticmethod
    def send_password_reset_email(
        user, 
        reset_url: str,
        request=None,
        web_url: str = None,
        app_url: str = None
    ) -> bool:
        """
        パスワードリセットメール（Web/アプリ両対応）
        
        reset_url は完全URL or 相対パス の両方に対応
        """
        logger.info(f"📥 パスワードリセットURL受信: {reset_url}")
        
        # ✅ URLからuid/tokenを抽出
        try:
            # URLを解析（完全URL or 相対パス両方に対応）
            parsed = urlparse(reset_url)
            
            # クエリパラメータがある場合（app-redirect形式）
            if parsed.query:
                query_params = parse_qs(parsed.query)
                uid = query_params.get('uid', [''])[0]
                token = query_params.get('token', [''])[0]
                logger.info(f"🔍 クエリパラメータから抽出: uid={uid[:10] if uid else '(empty)'}..., token={token[:20] if token else '(empty)'}...")
            
            # パス形式の場合（/accounts/reset/uid/token/）
            else:
                path_parts = parsed.path.rstrip('/').split('/')
                
                # パスの構造: ['', 'accounts', 'reset', 'uid', 'token']
                if len(path_parts) >= 5 and 'reset' in path_parts:
                    reset_index = path_parts.index('reset')
                    uid = path_parts[reset_index + 1] if len(path_parts) > reset_index + 1 else ''
                    token = path_parts[reset_index + 2] if len(path_parts) > reset_index + 2 else ''
                    logger.info(f"🔍 パスから抽出: uid={uid[:10] if uid else '(empty)'}..., token={token[:20] if token else '(empty)'}...")
                else:
                    logger.error(f"❌ パス形式が不正: {parsed.path}")
                    uid = ''
                    token = ''
            
            if not uid or not token:
                logger.error(f"❌ uid/token抽出失敗: uid={uid}, token={token}")
        
        except Exception as e:
            logger.error(f"❌ URL解析エラー: {e}", exc_info=True)
            uid = ''
            token = ''
        
        # ✅ リダイレクトページ経由のURL
        base_url = getattr(settings, 'CLOUDFLARE_TUNNEL_URL', settings.BASE_URL)
        redirect_url = f"{base_url}/accounts/app-redirect/?uid={uid}&token={token}&action=password-reset"
        
        # ✅ デバッグログ
        logger.info(f"📧 パスワードリセットメール送信")
        logger.info(f"👤 user: {user.email}")
        logger.info(f"📧 メール送信URL: {redirect_url}")
        
        context = {
            'user': user,
            'verification_url': redirect_url,
            'web_url': redirect_url,
            'app_url': redirect_url,
            'reset_url': redirect_url,
        }

        return MailService.send_email(
            recipient_email=user.email,
            template_type='PASSWORD_RESET',
            context=context
        )