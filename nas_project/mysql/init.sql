-- DB作成
CREATE DATABASE IF NOT EXISTS nas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- アプリ用ユーザー作成
CREATE USER IF NOT EXISTS 'django'@'%' IDENTIFIED BY 'django_password';

-- 権限付与（nas DB 内で必要最小限）
GRANT ALL PRIVILEGES ON nas.* TO 'django'@'%';

FLUSH PRIVILEGES;
