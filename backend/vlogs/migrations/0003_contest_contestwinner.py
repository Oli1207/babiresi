from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('vlogs', '0002_vlog_latitude_vlog_longitude_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Contest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=150)),
                ('description', models.TextField()),
                ('rules', models.TextField(blank=True)),
                ('cover_image', models.ImageField(blank=True, null=True, upload_to='contests/')),
                ('metric_type', models.CharField(
                    choices=[
                        ('vlog_likes', 'Likes sur un vlog (max)'),
                        ('total_points', 'Points totaux gagnés'),
                        ('vlog_comments', 'Commentaires sur un vlog (max)'),
                        ('vlog_views', 'Vues sur un vlog (max)'),
                        ('composite', 'Score composite pondéré'),
                    ],
                    default='vlog_likes', max_length=20,
                )),
                ('contest_type', models.CharField(
                    choices=[
                        ('threshold', 'Premier à atteindre le seuil'),
                        ('ranking', 'Classement en fin de période'),
                    ],
                    default='threshold', max_length=10,
                )),
                ('threshold', models.PositiveIntegerField(
                    blank=True, null=True,
                    help_text='Seuil à atteindre (threshold uniquement)',
                )),
                ('scoring_weights', models.JSONField(blank=True, default=dict)),
                ('min_vlogs_required', models.PositiveIntegerField(default=0)),
                ('max_winners', models.PositiveIntegerField(default=1)),
                ('prize_amount', models.PositiveIntegerField(default=0)),
                ('start_date', models.DateTimeField()),
                ('end_date', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(
                    choices=[
                        ('draft', 'Brouillon'),
                        ('active', 'Actif'),
                        ('extended', 'Prolongé'),
                        ('ended', 'Terminé'),
                    ],
                    default='draft', max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['-start_date']},
        ),
        migrations.CreateModel(
            name='ContestWinner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('threshold_reached_at', models.DateTimeField(blank=True, null=True)),
                ('won_at', models.DateTimeField(blank=True, null=True)),
                ('rank', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('score', models.PositiveIntegerField(default=0)),
                ('payout_status', models.CharField(
                    choices=[('pending', 'En attente'), ('paid', 'Payé')],
                    default='pending', max_length=10,
                )),
                ('payout_wave_ref', models.CharField(blank=True, max_length=120)),
                ('payout_amount', models.PositiveIntegerField(default=0)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('best_vlog', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='contest_wins', to='vlogs.vlog',
                )),
                ('contest', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='winners', to='vlogs.contest',
                )),
                ('paid_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='payouts_made', to=settings.AUTH_USER_MODEL,
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='contest_wins', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['won_at', 'rank']},
        ),
        migrations.AddIndex(
            model_name='contest',
            index=models.Index(fields=['status', 'start_date'], name='vlogs_conte_status_idx'),
        ),
        migrations.AddIndex(
            model_name='contestwinner',
            index=models.Index(fields=['contest', 'won_at'], name='vlogs_cw_contest_won_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='contestwinner',
            unique_together={('contest', 'user')},
        ),
    ]
