from django.db import migrations, models


def fill_regions(apps, schema_editor):
    Application = apps.get_model('marketplace', 'BusinessApplication')
    for application in Application.objects.exclude(city=None).select_related('city').iterator():
        Application.objects.filter(pk=application.pk).update(region=application.city.region)


class Migration(migrations.Migration):
    dependencies = [('marketplace', '0004_businessapplication_businessapplicationphoto_and_more')]
    operations = [
        migrations.AddField(
            model_name='businessapplication', name='region',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.RunPython(fill_regions, migrations.RunPython.noop),
    ]
