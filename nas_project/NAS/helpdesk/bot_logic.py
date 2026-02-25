# chatbot_app/bot_logic.py

import os
from google import genai
from .utils import load_help_data
import re

MODEL_NAME = 'models/gemini-flash-latest'

# --- セッションごとの会話履歴を保持 ---
conversation_history = {}
# ⭐ DB導入時に必要: from .models import SystemScreen 

# 🌟 1. クライアントの初期化とグローバルな設定 (新SDK対応)
try:
    # APIキーが環境変数に設定されていない場合、ここでエラーになる
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment variables.")

    # 🔥 新SDK: Client() を使用
    GEMINI_CLIENT = genai.Client(api_key=api_key)
    IS_CONFIGURED = True
    print("Gemini API初期化成功 (bot_logic.py)")

except Exception as e:
    print(f"Gemini初期化エラー: {e}")
    GEMINI_CLIENT = None
    IS_CONFIGURED = False


# 🌟 2. LLMを利用した応答関数 (RAG実装)
def get_bot_response(user_id: str, text: str):
    """
    ユーザーのテキスト入力を受け取り、ヘルプ記事を検索して
    Geminiモデルから応答を返す (RAG)
    """
    if not IS_CONFIGURED:
        return "🤖 ボット: Geminiサービスに接続できません。環境変数(GEMINI_API_KEY)を確認してください。"

    # --- 履歴初期化 ---
    if user_id not in conversation_history:
        conversation_history[user_id] = []

    # --- 履歴に今回の発話を追加 ---
    conversation_history[user_id].append({"role": "user", "content": text})

    # --- DB内のヘルプ記事検索 ---
    all_articles = load_help_data()
    print(f"[DEBUG] 記事数: {len(all_articles)}")
    print(f"[DEBUG] 記事一覧: {all_articles}")
    
    search_keywords = text.lower().split()
    print(f"[DEBUG] 検索キーワード: {search_keywords}")
    
    search_results = []

    for article in all_articles:
        score = 0
        article_text = (article.get("title", "") + " " + article.get("content", "")).lower()
        # 入力テキスト全体で部分一致検索
        if text in article_text:
            score += article_text.count(text)
        # さらに2文字以上の部分文字列でも検索
        for i in range(len(text) - 1):
            for j in range(i + 2, len(text) + 1):
                substr = text[i:j]
                if len(substr) >= 2 and substr in article_text:
                    score += 1
        if score > 0:
            a_copy = article.copy()
            a_copy["score"] = score
            search_results.append(a_copy)

    print(f"[DEBUG] 検索結果: {search_results}")

    search_results.sort(key=lambda x: x["score"], reverse=True)
    top_results = search_results[:3]

    # --- 2. 検索結果をプロンプト用に整形 (RAGのAugmentation) ---
    context_data = ""
    if top_results:
        # 検索された記事を整形し、プロンプトに組み込む
        context_data = "【参照すべき内部ヘルプ情報 (knowledge base)】\n"
        for i, article in enumerate(top_results):
            context_data += f"--- 記事 {i+1}: {article.get('title')} (カテゴリ: {article.get('category', 'N/A')}) ---\n"
            context_data += f"{article.get('content')}\n"
        context_data += "--------------------------------------\n\n"
    else:
        # 検索結果がなかった場合の指示
        context_data = "【参照すべき内部ヘルプ情報 (knowledge base)】\n該当する記事は見つかりませんでした。\n--------------------------------------\n\n"

    # --- 直近の会話履歴(最大5件) ---
    history_text = "\n".join(
        [f"{h['role']}: {h['content']}" for h in conversation_history[user_id][-5:]]
    )

    # --- 3. プロンプトの定義 ---
    # NASシステムの画面設計情報をRAGの補足情報として追加
    NAS_SYSTEM_INFO = """
    ## NASシステム画面リストと概要 (補足情報)
    -  ログイン画面
    -  新規利用者登録画面 (メールアドレス登録)
    -  本登録画面 (詳細情報、パスワード設定)
    -  利用者ホーム画面 (ヘッダー参照)
    -  睡眠グラフ画面 (今週/一週間前などの期間選定可)
    -  心拍、体温グラフ画面 (週平均表示)
    -  利用者ヘルプ画面 (このチャットボットが設置される場所)
    -  利用者情報画面 (身長・体重などの編集、保存が可能)
    -  パスワード再設定画面
    -  利用者お問い合わせ入力画面 (解決済みのステータス変更が可能)
    -  管理者ヘルプ設定画面
    """

    # システム指示、ルール、RAGコンテキストを全て含めた最終指示
    final_system_instruction = f"""
    あなたは親切で役立つ、会社のシステムアシスタントです。
    ユーザーからの質問に回答してください。

    【最重要ルール】
    1. **必ず**、提供された「参照すべき内部ヘルプ情報」を**最も重要な根拠**として利用し、その情報に基づいて回答を生成してください。
    2. 参照情報に質問の答えが見つからない場合は、「参照情報には該当する情報が見つかりませんでした。一般的な情報で回答します。」と前置きしてから、一般的な知識で回答してください。
    3. 参照情報の内容をそのまま返すのではなく、ユーザーフレンドリーな言葉で要約・整理して伝えてください。
    4. 参照情報が全くない場合は、通常の親切なアシスタントとして振る舞ってください。

    {history_text}

    {context_data}

    {NAS_SYSTEM_INFO}
    """
    
    final_prompt = f"""
    {final_system_instruction}

--- ユーザーの質問 ---
{text}
"""
    
    try:
        # 🔥 新SDK: client.models.generate_content()
        response = GEMINI_CLIENT.models.generate_content(
            model=MODEL_NAME,  # ここを固定
            contents=final_prompt
        )
        reply = response.text.strip() if response and hasattr(response, "text") else "回答を生成できませんでした。"
    except Exception as e:
        # 429エラーが発生した場合の親切なメッセージ対応
        if "429" in str(e):
            return "🤖 (API制限) 申し訳ありません、現在リクエストが集中しています。1分ほど待ってから再度話しかけてください。"
        
        print(f"Gemini API Error: {e}")
        reply = f"🤖 ボット: 応答生成中にエラーが発生しました: {e}"

    return reply