from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ColocProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('profile_type', models.CharField(choices=[('looking', 'Je cherche une coloc'), ('has_place', "J'ai une place")], default='looking', max_length=10)),
                ('bio', models.TextField(blank=True)),
                ('age', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('occupation', models.CharField(blank=True, max_length=80)),
                ('gender', models.CharField(blank=True, max_length=10)),
                ('budget_min', models.PositiveIntegerField(default=0)),
                ('budget_max', models.PositiveIntegerField(default=0)),
                ('place_zone', models.CharField(blank=True, max_length=20)),
                ('place_description', models.TextField(blank=True)),
                ('place_rent_total', models.PositiveIntegerField(default=0)),
                ('place_rent_share', models.PositiveIntegerField(default=0)),
                ('preferred_zones', models.JSONField(blank=True, default=list)),
                ('move_in_date', models.DateField(blank=True, null=True)),
                ('gender_pref', models.CharField(choices=[('any', 'Peu importe'), ('male', 'Homme'), ('female', 'Femme')], default='any', max_length=10)),
                ('lifestyle', models.JSONField(blank=True, default=dict)),
                ('interests', models.JSONField(blank=True, default=list)),
                ('is_premium', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('is_verified', models.BooleanField(default=False)),
                ('swipes_today', models.PositiveIntegerField(default=0)),
                ('swipe_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='coloc_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={'indexes': [models.Index(fields=['is_active', 'profile_type'], name='coloc_profil_is_acti_idx')]},
        ),
        migrations.CreateModel(
            name='ColocPhoto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cloudinary_url', models.URLField()),
                ('cloudinary_public_id', models.CharField(max_length=255)),
                ('is_cover', models.BooleanField(default=False)),
                ('order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='photos', to='coloc.colocprofile')),
            ],
            options={'ordering': ['-is_cover', 'order']},
        ),
        migrations.CreateModel(
            name='ColocSwipe',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('liked', models.BooleanField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('swiper', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coloc_swipes_made', to=settings.AUTH_USER_MODEL)),
                ('target', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='swipes_received', to='coloc.colocprofile')),
            ],
        ),
        migrations.CreateModel(
            name='ColocMatch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('matched_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('user1', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coloc_matches_1', to=settings.AUTH_USER_MODEL)),
                ('user2', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coloc_matches_2', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-matched_at']},
        ),
        migrations.CreateModel(
            name='ColocMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('match', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='coloc.colocmatch')),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='coloc_messages_sent', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['created_at']},
        ),
        migrations.AlterUniqueTogether(
            name='colocswipe',
            unique_together={('swiper', 'target')},
        ),
        migrations.AlterUniqueTogether(
            name='colocmatch',
            unique_together={('user1', 'user2')},
        ),
        migrations.AddIndex(
            model_name='colocswipe',
            index=models.Index(fields=['swiper', 'liked', 'created_at'], name='coloc_swipe_swiper_idx'),
        ),
        migrations.AddIndex(
            model_name='colocmessage',
            index=models.Index(fields=['match', 'created_at'], name='coloc_msg_match_idx'),
        ),
    ]
