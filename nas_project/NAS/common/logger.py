import json
from datetime import datetime
from pathlib import Path
from accounts.models import User, AdminUser  # ← 追加

# ログファイルのパス
LOG_FILE = Path(__file__).resolve().parent.parent / "static" / "data" / "access_logs.json"

def get_user_identifier(user):
    """User / AdminUser どちらでも使える汎用ID取得関数"""
    if user is None:
        return None
    if isinstance(user, AdminUser):
        return user.admin_id or str(user.pk)
    elif isinstance(user, User):
        return user.user_id or str(user.pk)
    else:
        return str(user)  # 文字列や数値の場合はそのまま返す

def log_action(user, user_email, action):
    """ユーザーの操作をJSONに記録"""
    log_entry = {
        "user_id": get_user_identifier(user),
        "user_email": user_email,
        "action": action,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    # ファイルが存在しなければ初期化
    if not LOG_FILE.exists():
        LOG_FILE.write_text("[]", encoding="utf-8")

    try:
        with open(LOG_FILE, "r+", encoding="utf-8") as f:
            content = f.read().strip()
            data = json.loads(content) if content else []
            data.append(log_entry)
            f.seek(0)
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.truncate()
    except json.JSONDecodeError:
        # 壊れている場合は再初期化
        LOG_FILE.write_text(json.dumps([log_entry], indent=2, ensure_ascii=False), encoding="utf-8")

def get_logs():
    """保存済みのログを取得"""
    if LOG_FILE.exists():
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    return []
