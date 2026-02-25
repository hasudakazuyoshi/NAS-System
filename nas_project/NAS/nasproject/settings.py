from pathlib import Path
import os
from dotenv import load_dotenv
from datetime import timedelta

try:
    load_dotenv()
except Exception:
    pass

# ==========================================================
# 開発/本番共通設定
# ==========================================================
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-c5f9p%qt9o8igwfiy@vrg2+$tdc)c787y(l*&9%^3a0x-82c)+')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')

# ==========================================================
# アプリケーション定義
# ==========================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'accounts',
    'custom_admin',
    'system_log',
    'helpdesk',
    'health',
    'rest_framework',
    'rest_framework.authtoken',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # トークンブラックリスト機能追加
    'corsheaders',
]

# ==========================================================
# 認証モデル設定
# ==========================================================
AUTH_USER_MODEL = 'accounts.User'

AUTHENTICATION_BACKENDS = [
    'accounts.backends.UserOrAdminBackend',
]

# ==========================================================
# ミドルウェア
# ==========================================================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ==========================================================
# CORS設定 (React Native用)
# ==========================================================
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = [
        "https://yourdomain.com",
    ]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

ROOT_URLCONF = 'nasproject.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
        'DIRS': [BASE_DIR / 'templates'],
    },
]

WSGI_APPLICATION = 'nasproject.wsgi.application'

CSRF_TRUSTED_ORIGINS = [
    'https://*.trycloudflare.com',
    'https://lacrimal-valleylike-lilyana.ngrok-free.dev',
]

ALLOWED_HOSTS = ['*']

# ==========================================================
# データベース設定(MySQL)
# ==========================================================
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('MYSQL_DB'),
        'USER': os.getenv('MYSQL_USER'),
        'HOST': os.getenv('MYSQL_HOST'),
        'PASSWORD': os.getenv('MYSQL_PASSWORD'),
        'PORT': os.getenv('MYSQL_PORT', '3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
        }
    }
}

# ==========================================================
# パスワード検証
# ==========================================================
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# ==========================================================
# 国際化設定
# ==========================================================
LANGUAGE_CODE = 'ja'
TIME_ZONE = 'Asia/Tokyo'
USE_I18N = True
USE_TZ = True

# ==========================================================
# 静的ファイル設定
# ==========================================================
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_ROOT = os.path.join(BASE_DIR, 'mediafiles')
MEDIA_URL = '/media/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
BASE_URL = os.getenv('BASE_URL', 'http://127.0.0.1:8000')

# ==========================================================
# 認証・ログイン設定
# ==========================================================
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/accounts/home/'
LOGOUT_REDIRECT_URL = '/'

# ==========================================================
# REST Framework設定 (React Native用)
# ==========================================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# ==========================================================
# JWT設定 (React Native用) - 改善版
# ==========================================================
SIMPLE_JWT = {
    'USER_ID_FIELD': 'user_id',
    'USER_ID_CLAIM': 'user_id',
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),      # 60分
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),     # 30日に延長
    'ROTATE_REFRESH_TOKENS': True,                    # 使用時に新しいトークン発行
    'BLACKLIST_AFTER_ROTATION': True,                 # 古いトークンを無効化
    'UPDATE_LAST_LOGIN': True,                        # 最終ログイン時刻を更新
    
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    
    'JTI_CLAIM': 'jti',
    
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}

# ==========================================================
# フロントエンド/メール設定
# ==========================================================
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
CLOUDFLARE_TUNNEL_URL = os.getenv('CLOUDFLARE_TUNNEL_URL', BASE_URL)

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)

# ==========================================================
# ログ設定
# ==========================================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {asctime} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'custom_admin': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'system_log': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    }
}