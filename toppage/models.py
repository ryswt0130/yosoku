from django.db import models


class Product_line(models.Model):
    line_name = models.CharField(max_length=100)

    def __str__(self):
        return self.line_name


class Product_series(models.Model):
    series_name = models.CharField(max_length=100)
    product_line = models.ForeignKey(Product_line, on_delete=models.PROTECT, null=True)
    hatubaibi = models.DateField(blank=True, null=True)
    yosoku_date = models.DateField(blank=True, null=True)

    def __str__(self):
        return self.series_name


class User_yosoku_date(models.Model):
    product_series = models.ForeignKey(Product_series, on_delete=models.PROTECT, null=True)
    yosoku_date = models.DateField()


class Post(models.Model):
    title = models.CharField(max_length=255)

    def __str__(self):
        return self.title



