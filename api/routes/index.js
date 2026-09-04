const express = require('express');
const publicController = require('../controllers/publicController');
const authController = require('../controllers/authController');
const patientController = require('../controllers/patientController');
const professionalController = require('../controllers/professionalController');
const procedureController = require('../controllers/procedureController');
const appointmentController = require('../controllers/appointmentController');
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/public/home', publicController.getHomeData);
router.post('/auth/register', authController.registerPatient);
router.get('/auth/me', authenticate, authController.me);

router.get('/professionals', professionalController.listProfessionals);
router.get('/procedures', procedureController.listProcedures);
router.get('/appointments/available-slots', appointmentController.availableSlots);

router.get('/patients', authenticate, authorize('ADMINISTRADOR', 'PROFISSIONAL'), patientController.listPatients);
router.post('/patients', authenticate, authorize('ADMINISTRADOR'), patientController.savePatient);
router.get('/patients/:id', authenticate, patientController.getPatient);
router.put('/patients/:id', authenticate, patientController.savePatient);

router.get('/appointments', authenticate, appointmentController.listAppointments);
router.post('/appointments', authenticate, appointmentController.createAppointment);
router.patch('/appointments/:id/status', authenticate, authorize('ADMINISTRADOR', 'PROFISSIONAL'), appointmentController.updateAppointmentStatus);
router.patch('/appointments/:id/reschedule', authenticate, appointmentController.rescheduleAppointment);
router.post('/appointments/:id/cancel', authenticate, appointmentController.cancelAppointment);

router.post('/admin/professionals', authenticate, authorize('ADMINISTRADOR'), professionalController.createProfessional);
router.put('/admin/professionals/:id', authenticate, authorize('ADMINISTRADOR'), professionalController.updateProfessional);
router.post('/admin/procedures', authenticate, authorize('ADMINISTRADOR'), procedureController.createProcedure);
router.put('/admin/procedures/:id', authenticate, authorize('ADMINISTRADOR'), procedureController.updateProcedure);
router.get('/admin/dashboard', authenticate, authorize('ADMINISTRADOR'), adminController.dashboard);
router.get('/admin/notifications', authenticate, authorize('ADMINISTRADOR'), adminController.listNotifications);
router.post('/admin/blocked-slots', authenticate, authorize('ADMINISTRADOR'), adminController.createBlockedSlot);
router.put('/admin/settings', authenticate, authorize('ADMINISTRADOR'), adminController.updateClinicSettings);

module.exports = router;
