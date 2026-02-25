from django.urls import path
from .views import (
    HelpCategoryListView,
    HelpArticleListView,
    HelpArticleDetailView,
    HelpArticleSearchView,
    InquiryListAPIView,
    InquiryCreateAPIView,
    InquiryDetailAPIView,
    InquiryAddMessageAPIView,
    InquiryCloseAPIView,
    ChatbotAPIView,
)

urlpatterns = [
    # ヘルプ記事
    path('help/categories/', HelpCategoryListView.as_view(), name='help_categories'),
    path('help/articles/', HelpArticleListView.as_view(), name='help_articles'),
    path('help/articles/<str:help_id>/', HelpArticleDetailView.as_view(), name='help_article_detail'),
    path('help/search/', HelpArticleSearchView.as_view(), name='help_search'),
    
    # 問い合わせ
    path('inquiries/', InquiryListAPIView.as_view(), name='inquiry_list'),
    path('inquiries/new/', InquiryCreateAPIView.as_view(), name='inquiry_create'),
    path('inquiries/<str:inquiry_id>/', InquiryDetailAPIView.as_view(), name='inquiry_detail'),
    path('inquiries/<str:inquiry_id>/message/', InquiryAddMessageAPIView.as_view(), name='inquiry_add_message'),
    path('inquiries/<str:inquiry_id>/close/', InquiryCloseAPIView.as_view(), name='inquiry_close'),
    
    # チャットボット
    path('chatbot/', ChatbotAPIView.as_view(), name='chatbot'),
]