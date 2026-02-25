# Nas/inquiry/InquiryRepository.py (修正版 - デバッグ強化)

import json
import os
from typing import List, Dict, Any, Optional
import logging
from django.conf import settings
from .data_models import UserInquiriesEntry, Inquiry, InquiryThreadEntry

logger = logging.getLogger(__name__)

INQUIRY_LOG_FILE_PATH = os.path.join(
    settings.BASE_DIR, "static", "data", "inquiry_log.json"
)


class InquiryRepository:

    @staticmethod
    def _load_all_data():
        print(f"📁 読み込み先パス: {INQUIRY_LOG_FILE_PATH}")

        try:
            if not os.path.exists(INQUIRY_LOG_FILE_PATH):
                logger.warning(f"問い合わせJSONが存在しません: {INQUIRY_LOG_FILE_PATH}")
                return []

            with open(INQUIRY_LOG_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)

            if not isinstance(data, list):
                logger.warning(f"問い合わせJSONの形式が不正: {INQUIRY_LOG_FILE_PATH}")
                return []

            print(f"✅ JSONファイル読み込み成功: {len(data)} ユーザー")
            return data

        except json.JSONDecodeError as e:
            logger.error(f"問い合わせJSONの読み込みエラー (JSON形式不正): {INQUIRY_LOG_FILE_PATH}, Error: {e}")
            return []
        except Exception as e:
            logger.error(f"問い合わせJSONの読み込みエラー: {INQUIRY_LOG_FILE_PATH}, Error: {e}")
            return []

    @staticmethod
    def _save_all_data(data: List[Dict[str, Any]]):
        os.makedirs(os.path.dirname(INQUIRY_LOG_FILE_PATH), exist_ok=True)
        try:
            with open(INQUIRY_LOG_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"問い合わせログの書き込み中にエラー: {e}")

    @staticmethod
    def get_all_inquiries_by_user() -> List[UserInquiriesEntry]:
        raw_data = InquiryRepository._load_all_data()

        print("📄 読み込んだJSON内容:", raw_data)
        entries = []
        for user_data in raw_data:
            user_id = user_data.get("userID")
            raw_inquiries = user_data.get("inquiries", [])

            inquiries = []
            for inquiry_data in raw_inquiries:
                raw_thread = inquiry_data.get("thread", [])
                thread_entries = [InquiryThreadEntry(**thread_data) for thread_data in raw_thread]

                inquiry_fields = {
                    "inquiryID": inquiry_data.get("inquiryID"),
                    "inquiryname": inquiry_data.get("inquiryname"),
                    "time": inquiry_data.get("time"),
                    "status": inquiry_data.get("status"),
                    "filepath": inquiry_data.get("filepath"),
                }

                try:
                    inquiry = Inquiry(
                        thread=thread_entries,
                        **inquiry_fields
                    )
                    inquiries.append(inquiry)
                except TypeError as e:
                    logger.warning(f"問い合わせデータ変換エラー: {inquiry_data}, Error: {e}")

            if user_id:
                entries.append(UserInquiriesEntry(userID=user_id, inquiries=inquiries))

        return entries

    @staticmethod
    def save_inquiry(user_id: str, inquiry: Inquiry):
        all_data = InquiryRepository._load_all_data()
        formatted_user_id = InquiryRepository._format_user_id(user_id)

        user_entry = next((item for item in all_data if item.get("userID") == formatted_user_id), None)

        if not inquiry.inquiryID or not inquiry.inquiryID.startswith("I"):
            all_inquiries = []
            for entry in all_data:
                all_inquiries.extend(entry.get("inquiries", []))

            existing_ids = [
                int(item["inquiryID"].replace("I", ""))
                for item in all_inquiries
                if item["inquiryID"].startswith("I")
            ]
            next_id = max(existing_ids, default=0) + 1
            inquiry.inquiryID = f"I{next_id:05d}"

        if not user_entry:
            user_entry = {"userID": formatted_user_id, "inquiries": []}
            all_data.append(user_entry)

        inquiry_dict = {
            "inquiryID": inquiry.inquiryID,
            "inquiryname": inquiry.inquiryname,
            "time": inquiry.time,
            "status": inquiry.status,
            "filepath": inquiry.filepath,
            "thread": [t.__dict__ for t in inquiry.thread],
        }

        inquiries_list = user_entry["inquiries"]
        index = next((i for i, item in enumerate(inquiries_list) if item.get("inquiryID") == inquiry.inquiryID), -1)

        if index != -1:
            inquiries_list[index] = inquiry_dict
        else:
            inquiries_list.append(inquiry_dict)

        InquiryRepository._save_all_data(all_data)
        print(f"✅ 保存完了: {formatted_user_id} / {inquiry.inquiryID}")

    @staticmethod
    def _format_user_id(user_id: str) -> str:
        if user_id is None:
            return "NU00000"
        
        clean_user_id = str(user_id).strip().upper()

        if clean_user_id.startswith("NU"):
            return clean_user_id
        try:
            return f"NU{int(clean_user_id):05d}"
        except ValueError:
            return str(user_id)

    @staticmethod
    def get_user_inquiry(user_id: str, inquiry_id: str) -> Optional[Inquiry]:
        """
        🔧 修正版: より詳細なデバッグログ付き
        """
        print(f"\n{'='*60}")
        print(f"🔍 [REPO] get_user_inquiry 開始")
        print(f"   入力 user_id: '{user_id}' (type: {type(user_id).__name__})")
        print(f"   入力 inquiry_id: '{inquiry_id}' (type: {type(inquiry_id).__name__})")
        
        raw_data = InquiryRepository._load_all_data()
        
        formatted_user_id = InquiryRepository._format_user_id(user_id)
        clean_inquiry_id = inquiry_id.strip()
        
        print(f"   整形後 user_id: '{formatted_user_id}'")
        print(f"   整形後 inquiry_id: '{clean_inquiry_id}'")
        print(f"\n📋 JSONデータ内のユーザー一覧:")
        
        for idx, item in enumerate(raw_data):
            json_user_id = item.get("userID", "")
            json_user_id_normalized = str(json_user_id).strip().upper()
            match_status = "✅ 一致" if json_user_id_normalized == formatted_user_id else "❌ 不一致"
            print(f"   [{idx}] userID: '{json_user_id}' (正規化: '{json_user_id_normalized}') {match_status}")
            
            # 問い合わせIDも表示
            inquiries = item.get("inquiries", [])
            if inquiries:
                print(f"       └─ 問い合わせ数: {len(inquiries)}")
                for inq in inquiries[:3]:  # 最初の3つだけ表示
                    print(f"          ├─ ID: '{inq.get('inquiryID')}'")
        
        # ユーザーを検索
        user_entry = next(
            (item for item in raw_data 
             if item.get("userID") and str(item["userID"]).strip().upper() == formatted_user_id),
            None
        )
        
        if not user_entry:
            print(f"\n❌ [REPO] ユーザーエントリーが見つかりません: {formatted_user_id}")
            print(f"{'='*60}\n")
            return None
        
        print(f"\n✅ [REPO] ユーザーエントリー発見: {user_entry.get('userID')}")
        print(f"   問い合わせ数: {len(user_entry.get('inquiries', []))}")
        
        # 問い合わせを検索
        for inquiry_data in user_entry.get("inquiries", []):
            current_inquiry_id = inquiry_data.get("inquiryID")
            current_inquiry_id_clean = str(current_inquiry_id).strip() if current_inquiry_id else ""
            
            print(f"\n   🔎 チェック中: '{current_inquiry_id}' (正規化: '{current_inquiry_id_clean}')")
            print(f"      比較対象: '{clean_inquiry_id}'")
            print(f"      一致? {current_inquiry_id_clean == clean_inquiry_id}")
            
            if current_inquiry_id_clean == clean_inquiry_id:
                print(f"\n✅ [REPO] 問い合わせID {clean_inquiry_id} が見つかりました！")
                
                raw_thread = inquiry_data.get("thread", [])
                thread_entries = [
                    InquiryThreadEntry(**t) for t in raw_thread
                ]
                
                result = Inquiry(
                    inquiryID=inquiry_data.get("inquiryID"),
                    inquiryname=inquiry_data.get("inquiryname"),
                    time=inquiry_data.get("time"),
                    status=inquiry_data.get("status"),
                    filepath=inquiry_data.get("filepath"),
                    thread=thread_entries,
                )
                print(f"{'='*60}\n")
                return result
        
        print(f"\n❌ [REPO] 問い合わせID {clean_inquiry_id} はユーザー {formatted_user_id} の下で見つかりませんでした。")
        print(f"{'='*60}\n")
        return None