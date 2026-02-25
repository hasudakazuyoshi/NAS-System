from dataclasses import dataclass
from typing import List, Optional

@dataclass
class AccessLogSession:
    """JSON内のネストされたセッション情報 (logs配列の要素)"""
    login: str
    logout: Optional[str] = None


@dataclass
class AccessLogUserEntry:
    """JSONの最上位の配列要素。利用者IDごとのログ履歴の集まり。"""
    ID: str
    login: List[AccessLogSession]