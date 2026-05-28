"""
Settings de développement local.
Usage: DJANGO_SETTINGS_MODULE=backend.settings_dev
"""

import os
from pathlib import Path
from environs import env

BASE_DIR = Path(__file__).resolve().parent.parent
env.read_env(os.path.join(BASE_DIR, '.env'))

from backend.settings import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'babiresi',
        'USER': 'postgres',
        'PASSWORD': 'Olivier1207.',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

MEDIA_ROOT = BASE_DIR / 'media'
