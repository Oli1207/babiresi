from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('userauths', '0002_notification'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='tiktok_handle',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='instagram_handle',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='facebook_handle',
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='twitter_handle',
            field=models.CharField(blank=True, max_length=80, null=True),
        ),
        migrations.AddField(
            model_name='profile',
            name='wave_number',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
    ]
