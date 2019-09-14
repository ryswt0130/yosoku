# from django.shortcuts import render
from django.http import HttpResponse
from django.http import JsonResponse
from .models import Product_line, Product_series, User_yosoku_date
import json
from django.core import serializers

from django.db.models import Count
# #
# # def index(request):
# #     return render(request, 'toppage/index.html')
# #
# # def test_ajax_response(request):
# #     input_text = request.POST.get("name_input_text", "")
# #     hoge = "Ajax Response: " + input_text
# #     #if input_text!="";
# #
# #
# #     return HttpResponse(hoge)


def ajax_post_add(request):
    title = request.POST.get('title')
    post = Post.objects.create(title=title)
    d = {
        'title': post.title,
    }
    return JsonResponse(d)


from django.views.generic import TemplateView
from django.views import View
from django.views import generic
from .models import Post
import datetime


class PostList(generic.ListView):
    model = Post


class IndexView(TemplateView):
    template_name = 'toppage/index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs) # はじめに継承元のメソッドを呼び出す

        request_product_series = self.request.GET.get('series_name')
        product_series = Product_series.objects.get(series_name='zen3')
        all_yosoku_d = User_yosoku_date.objects.filter(product_series=product_series).values('yosoku_date').annotate(date_count=Count('yosoku_date'))

        all_yosoku_da = [(i['yosoku_date'].strftime('%Y/%m/%d'), i['date_count']) for i in all_yosoku_d]
        test_data = json.dumps(all_yosoku_da, ensure_ascii=False)
        context["test_data"] = test_data
        return context


class Test_Ajax_Response(View):

    def get(self, request):
        input_text = request.POST.get("name_input_text", "")
        hoge = "Ajax Response: " + input_text
        return HttpResponse(hoge)

    def post(self, request):
        post_date = request.POST.get('demo')
        post_yosoku_dete = datetime.datetime.strptime(post_date, '%Y/%m/%d')
        User_yosoku_date.objects.create(yosoku_date=post_yosoku_dete)
        hoge = post_date
        return HttpResponse(hoge)


class Test_Count_Yosoku(View):

    def get(self, request):
        request_product_series = request.GET.get('series_name')
        product_series = Product_series.objects.get(series_name=request_product_series)
        all_yosoku_d = User_yosoku_date.objects.filter(product_series=product_series).values('yosoku_date').annotate(date_count=Count('yosoku_date'))


        #all_yosoku_date = serializers.serialize('json', all_yosoku_d)

        #all_yosoku_da = [{'yosoku_date': int(i['yosoku_date'].strftime('%Y%m%d')), 'date_count': i['date_count']} for i in all_yosoku_d]
        all_yosoku_da = [(i['yosoku_date'].strftime('%Y/%m/%d'), i['date_count']) for i in all_yosoku_d]
        all_yosoku_date = json.dumps(all_yosoku_da, ensure_ascii=False)
        return HttpResponse(all_yosoku_date)
        #return HttpResponse(json_str)
