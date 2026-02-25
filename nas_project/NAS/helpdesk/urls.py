from django.urls import path
from . import admin_views
from .views import (
    inquiry_form, 
    inquiry_page, 
    inquiry_detail_page, 
    chatbot_page, 
    chatbot_api,
    InquiryListAPIView, 
    InquiryNewAPIView, 
    InquiryDetailAPIView, 
    InquiryResponseAPIView, 
    InquiryCloseAPIView
)
from . import views 


app_name = "helpdesk"

urlpatterns = [
    # --- 管理画面 URL ---
    # 🔧 修正: admin_help と admin_help_list の両方を定義（後方互換性のため）
    path("admin/", admin_views.admin_help_list, name="admin_help_list"), 
    path("admin/", admin_views.admin_help_list, name="admin_help"),  # テンプレート互換用
    path("admin/<str:article_id>/", admin_views.admin_help_list, name="admin_help_edit"),
    path("admin/<str:article_id>/delete/", admin_views.delete_help_article, name="admin_help_delete"),
    path("admin/category/<str:category_id>/edit/", admin_views.edit_category, name="admin_category_edit"),
    path("admin/category/<str:category_id>/delete/", admin_views.delete_category, name="admin_category_delete"),
    
    # --- ヘルプ/チャットボット URL ---
    path("help/", chatbot_page, name="help"), 
    path("api/help/", chatbot_api, name="help_api"),

    # --- ユーザー画面 URL ---
    path("inquiry/form/", inquiry_form, name="inquiry_form"),
    path("inquiry/", inquiry_page, name="inquiry_page"),
    path("detail/<str:user_id>/<str:inquiry_id>/", inquiry_detail_page, name="inquiry_detail_page"), 

    # --- API URL ---
    path("api/inquiries/", InquiryListAPIView.as_view(), name="inquiry_list_api"),
    path("api/inquiries/new/", InquiryNewAPIView.as_view(), name="inquiry_new_api"),
    path("api/inquiries/<str:user_id>/<str:inquiry_id>/", InquiryDetailAPIView.as_view(), name="inquiry_detail_api"),
    path("api/inquiries/<str:user_id>/<str:inquiry_id>/response/", InquiryResponseAPIView.as_view(), name="inquiry_response_api"),
    path("api/inquiries/<str:user_id>/<str:inquiry_id>/close/", InquiryCloseAPIView.as_view(), name="inquiry_close_api"),
]