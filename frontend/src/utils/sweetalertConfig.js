// Configuration globale pour SweetAlert2
import Swal from 'sweetalert2';

// Configuration par défaut pour toutes les alertes
Swal.mixin({
  customClass: {
    popup: 'swal2-popup-custom',
    container: 'swal2-container-custom',
  },
  position: 'center',
  showConfirmButton: true,
  confirmButtonText: 'OK',
  buttonsStyling: false,
  customClass: {
    confirmButton: 'swal2-confirm-custom',
  },
  allowOutsideClick: false,
  allowEscapeKey: true,
  width: 'auto',
  padding: '1.5rem',
});

export default Swal;

