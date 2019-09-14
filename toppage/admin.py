from django.contrib import admin
from .models import Product_line, Product_series, User_yosoku_date, Post

admin.site.register([Product_line, Product_series, User_yosoku_date, Post])
