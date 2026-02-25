import os
import json
import logging
from typing import Literal, Tuple, Optional, List

logger = logging.getLogger(__name__)

# チェック対象のJSONファイルパスを定義
# (ここでは、プロジェクトルートからの相対パスとして仮定します)
INQUIRY_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'inquiry', 'data', 'inquiry.json')
GRAPH_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'graph', 'data', 'graph.json')
LOG_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'system_log', 'data', 'access_log.json')

class HealthDataRepository:
    """
    ヘルスチェックで必要な外部リソース（JSONファイルなど）の
    アクセス可能性を確認するロジックを担う。（旧 HealthRepository）
    """

    @staticmethod
    def _check_file_access(filepath: str, component_name: str) -> Tuple[Literal['OK', 'FAIL'], Optional[str]]:
        """
        指定されたファイルパスへのアクセス（読み込み・書き込み）をチェックする。
        """
        status: Literal['OK', 'FAIL'] = 'OK'
        details: Optional[str] = None
        
        # 1. ファイルの存在チェック
        if not os.path.exists(filepath):
            status = 'FAIL'
            details = f"ファイルが存在しません: {filepath}"
            logger.warning(f"{component_name} - {details}")
            return status, details
        
        # 2. 読み込み権限チェック
        if not os.access(filepath, os.R_OK):
            status = 'FAIL'
            details = f"読み込み権限がありません: {filepath}"
            logger.warning(f"{component_name} - {details}")
            return status, details

        # 3. 書き込み権限チェック (必要に応じて)
        # 書き込み権限がない場合、データの更新ができないため、これもFAILと見なします。
        if not os.access(filepath, os.W_OK):
            status = 'FAIL'
            details = f"書き込み権限がありません: {filepath}"
            logger.warning(f"{component_name} - {details}")
            return status, details
            
        # 4. JSON形式の基本チェック（読み込み可能か）
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                json.load(f)
        except json.JSONDecodeError:
            status = 'FAIL'
            details = f"ファイルの内容が不正なJSON形式です: {filepath}"
            logger.error(f"{component_name} - {details}")
            return status, details
        except Exception as e:
            status = 'FAIL'
            details = f"ファイルの読み込み中に予期せぬエラーが発生しました: {e}"
            logger.error(f"{component_name} - {details}")
            return status, details

        return status, "アクセスとJSON形式の確認に成功しました。"

    @staticmethod
    def check_all_file_health() -> List[Tuple[str, Literal['OK', 'FAIL'], Optional[str]]]:
        """
        全てのJSONファイルに対するヘルスチェックを実行する。
        """
        results = []
        
        # 問い合わせ (Inquiry) JSON
        status, details = HealthDataRepository._check_file_access(INQUIRY_FILE_PATH, "Inquiry JSON File")
        results.append(("Inquiry JSON File", status, details))
        
        # グラフ (Graph) JSON
        status, details = HealthDataRepository._check_file_access(GRAPH_FILE_PATH, "Graph JSON File")
        results.append(("Graph JSON File", status, details))
        
        # アクセスログ (Log) JSON
        status, details = HealthDataRepository._check_file_access(LOG_FILE_PATH, "Access Log JSON File")
        results.append(("Access Log JSON File", status, details))
        
        return results
