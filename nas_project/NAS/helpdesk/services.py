# Nas/inquiry/services.py

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid

from .repository import InquiryRepository
from .data_models import Inquiry, InquiryThreadEntry

logger = logging.getLogger(__name__)


class InquiryService:

    @staticmethod
    def _generate_inquiry_id() -> str:
        all_data = InquiryRepository.get_all_inquiries_by_user()
        max_id = 0

        for user_entry in all_data:
            for inquiry in user_entry.inquiries:
                try:
                    num = int(inquiry.inquiryID.replace("I", ""))
                    max_id = max(max_id, num)
                except:
                    pass

        return f"I{max_id + 1:05d}"


    @staticmethod
    def get_inquiries(user_id: Optional[str] = None) -> List[Dict[str, str]]:
        all_user_entries = InquiryRepository.get_all_inquiries_by_user()
        flat_inquiries = []

        for user_entry in all_user_entries:
            if user_id and user_entry.userID != user_id:
                continue

            for inquiry in user_entry.inquiries:
                thread = inquiry.thread or []

                if len(thread) > 0:
                    last_entry = thread[-1]
                    latest_message = getattr(last_entry, "message", "(メッセージなし)")
                else:
                    latest_message = "(メッセージなし)"

                flat_inquiries.append({
                    "userID": user_entry.userID,
                    "inquiryID": inquiry.inquiryID,
                    "inquiryname": inquiry.inquiryname,
                    "status": inquiry.status,
                    "time": datetime.fromisoformat(inquiry.time).strftime("%Y-%m-%d %H:%M:%S"),
                    "latest_message": latest_message,
                })

        flat_inquiries.sort(
            key=lambda x: datetime.strptime(x["time"], "%Y-%m-%d %H:%M:%S"),
            reverse=True
        )
        return flat_inquiries


    @staticmethod
    def get_inquiry_detail(user_id: str, inquiry_id: str) -> Optional[Dict[str, Any]]:
        """
        🔧 修正: userID を user_id パラメータから取得
        """
        print(f"🔍 [SERVICE] get_inquiry_detail 呼び出し: user_id={user_id}, inquiry_id={inquiry_id}")
        
        inquiry = InquiryRepository.get_user_inquiry(user_id, inquiry_id)
        
        if not inquiry:
            logger.warning(f"問い合わせが見つかりません: user_id={user_id}, inquiry_id={inquiry_id}")
            print(f"❌ [SERVICE] 問い合わせが見つかりませんでした")
            return None
        
        print(f"✅ [SERVICE] 問い合わせ取得成功: {inquiry.inquiryID}")

        thread_history = []
        for entry in inquiry.thread:
            thread_history.append({
                "sender": entry.sender,
                "message": entry.message,
                "timestamp": entry.timestamp,
            })

        return {
            "userID": user_id,
            "inquiryID": inquiry.inquiryID,
            "inquiryname": inquiry.inquiryname,
            "status": inquiry.status,
            "time": datetime.fromisoformat(inquiry.time).strftime("%Y-%m-%d %H:%M:%S"),
            "thread_history": thread_history,
        }

    @staticmethod
    def register_new_inquiry(user_id: str, inquiry_name: str, initial_message: str) -> Inquiry:
        new_inquiry_id = InquiryService._generate_inquiry_id()
        current_time = datetime.now().isoformat(timespec='seconds')

        new_inquiry = Inquiry(
            inquiryID=new_inquiry_id,
            inquiryname=inquiry_name,
            time=current_time,
            status="未対応",
            thread=[
                InquiryThreadEntry(
                    sender="user",
                    message=initial_message,
                    timestamp=current_time
                )
            ]
        )

        InquiryRepository.save_inquiry(user_id, new_inquiry)
        return new_inquiry

    @staticmethod
    def add_response(user_id: str, inquiry_id: str, admin_response: str) -> Optional[Inquiry]:
        inquiry = InquiryRepository.get_user_inquiry(user_id, inquiry_id)
        if not inquiry:
            return None

        current_time = datetime.now().isoformat(timespec='seconds')

        # メッセージを追加
        inquiry.thread.append(
            InquiryThreadEntry(
                sender="admin",
                message=admin_response,
                timestamp=current_time
            )
        )

        # 🔥 解決済みでない場合のみステータスを変更
        if inquiry.status != "解決済み":
            inquiry.status = "対応中"
        
        inquiry.time = current_time

        InquiryRepository.save_inquiry(user_id, inquiry)
        return inquiry

    @staticmethod
    def add_user_message(user_id: str, inquiry_id: str, message: str) -> Optional[Inquiry]:
        inquiry = InquiryRepository.get_user_inquiry(user_id, inquiry_id)
        if not inquiry:
            return None

        current_time = datetime.now().isoformat(timespec='seconds')

        # メッセージを追加
        inquiry.thread.append(
            InquiryThreadEntry(
                sender="user",
                message=message,
                timestamp=current_time
            )
        )

        # 🔥 解決済みでない場合のみステータスを変更
        if inquiry.status != "解決済み":
            inquiry.status = "未対応"
        
        inquiry.time = current_time

        InquiryRepository.save_inquiry(user_id, inquiry)
        return inquiry

    @staticmethod
    def close_inquiry(user_id: str, inquiry_id: str) -> Optional[Inquiry]:
        inquiry = InquiryRepository.get_user_inquiry(user_id, inquiry_id)

        if not inquiry:
            logger.warning(f"解決済み更新失敗: ユーザーID {user_id} の問い合わせID {inquiry_id} が見つかりません。")
            return None

        current_time = datetime.now().isoformat(timespec='seconds')

        inquiry.status = '解決済み'
        inquiry.time = current_time

        InquiryRepository.save_inquiry(user_id, inquiry)
        logger.info(f"問い合わせID {inquiry_id} のステータスを解決済みに更新しました。")
        return inquiry