"""
Settings de production (serveur cPanel / LWS).
Usage: DJANGO_SETTINGS_MODULE=backend.settings_prod
"""

import os
from pathlib import Path
from environs import env

BASE_DIR = Path(__file__).resolve().parent.parent
env.read_env(os.path.join(BASE_DIR, '.env'))

from backend.settings import *  # noqa

DEBUG = False

ALLOWED_HOSTS = [
    'decrouresi.com',
    'www.decrouresi.com',
    '127.0.0.1',
]

CORS_ALLOWED_ORIGINS = [
    'https://decrouresi.com',
    'https://www.decrouresi.com',
]

CSRF_TRUSTED_ORIGINS = [
    'https://decrouresi.com',
    'https://www.decrouresi.com',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='127.0.0.1'),
        'PORT': env('DB_PORT', default='5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'mail.decrouresi.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')

MEDIA_ROOT = BASE_DIR / 'media'

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
