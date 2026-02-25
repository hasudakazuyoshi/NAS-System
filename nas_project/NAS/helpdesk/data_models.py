from dataclasses import dataclass
from typing import List, Optional, Literal

# 問い合わせと応答のやり取りのデータモデル
from dataclasses import dataclass
from typing import List, Optional, Literal

@dataclass
class InquiryThreadEntry:
    """
    問い合わせのやり取り（利用者と管理者のメッセージ1件分）
    """
    sender: str           # 'user' または 'admin'
    message: str          # メッセージ本文
    timestamp: str        # ISO形式日時（例: "2025-11-06T10:00:00"）

@dataclass
class Inquiry:
    """
    単一のお問い合わせ（inquiryID単位）
    """
    inquiryID: str
    inquiryname: str
    time: str
    status: Literal["未対応", "対応中", "解決済み"]
    thread: List[InquiryThreadEntry]
    filepath: Optional[str] = None

@dataclass
class UserInquiriesEntry:
    """
    利用者ごとのお問い合わせ一覧
    """
    userID: str
    inquiries: List[Inquiry]
