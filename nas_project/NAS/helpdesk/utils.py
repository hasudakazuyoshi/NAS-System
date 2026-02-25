# helpdesk/utils.py
from .models import HelpArticle

def load_help_data():
    articles = HelpArticle.objects.select_related("category").all()
    return [
        {
            "title": a.title,
            "content": a.content,
            "category": a.category.name  # カテゴリ名を取得
        }
        for a in articles
    ]