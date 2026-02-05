import os
from django.core.wsgi import get_wsgi_application
from django.conf import settings
from whitenoise import WhiteNoise

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# 1. On initialise l'application Django standard
application = get_wsgi_application()

# 2. On enveloppe l'application avec WhiteNoise pour les MEDIA
# On ajoute 'autorefresh=True' car les médias changent souvent (nouveaux uploads)
application = WhiteNoise(
    application, 
    root=settings.MEDIA_ROOT, 
    prefix=settings.MEDIA_URL
)

# 3. On ajoute les fichiers STATIQUES (si tu veux que WhiteNoise gère tout)
application.add_files(settings.STATIC_ROOT, prefix=settings.STATIC_URL)