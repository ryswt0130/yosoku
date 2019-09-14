from django.urls import path
from . import views

app_name = 'toppage'
urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),
    path('ajax/', views.Test_Ajax_Response.as_view(), name='test_ajax_response'),
    path('ajax_post_add', views.ajax_post_add, name='ajax_post_add'),
    path('ajax_test_count_yosoku', views.Test_Count_Yosoku.as_view(), name='ajax_test_count_yosoku'),
]
