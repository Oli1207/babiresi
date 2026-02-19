from django.contrib import admin
from .models import *
# Register your models here.

admin.site.register(Listing)
admin.site.register(Booking)
admin.site.register(ListingImage)
admin.site.register(BookingDateProposal)
admin.site.register(PaymentTransaction)
admin.site.register(PushSubscription)