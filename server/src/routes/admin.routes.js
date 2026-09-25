/**
 * Admin routes. Mounted at /api/admin.
 *
 * Every route except POST /login runs through requireAdmin, so a request
 * without a valid Supabase session cannot reach any of them.
 */
import { asyncRouter } from '../utils/asyncRouter.js';
import { login } from '../controllers/auth.controller.js';
import * as participants from '../controllers/admin.participant.controller.js';
import * as content from '../controllers/admin.content.controller.js';
import * as mail from '../controllers/admin.email.controller.js';
import * as users from '../controllers/admin.user.controller.js';
import { requireAdmin, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { singleImage } from '../middleware/upload.js';

const router = asyncRouter();

// Public
router.post('/login', loginLimiter, login);

// Everything below requires a valid administrator session.
router.use(requireAdmin);

// Dashboard & stats
router.get('/dashboard', participants.dashboard);
router.get('/stats', participants.stats);

// Participants
router.get('/participants', participants.index);
router.post('/participants/bulk-delete', participants.bulkDelete);
router.get('/participants/:id', participants.show);
router.put('/participants/:id', participants.update);
router.delete('/participants/:id', participants.destroy);
router.post('/participants/:id/regenerate-pass', participants.regenerate);

// Sponsors
router.get('/sponsors', content.listSponsors);
router.post('/sponsors', singleImage('logo'), content.createSponsor);
router.put('/sponsors/:id', singleImage('logo'), content.updateSponsor);
router.delete('/sponsors/:id', content.deleteSponsor);

// Gallery
router.get('/gallery', content.listGallery);
router.post('/gallery', singleImage('image'), content.createGalleryItem);
router.put('/gallery/:id', singleImage('image'), content.updateGalleryItem);
router.delete('/gallery/:id', content.deleteGalleryItem);

// Contacts
router.get('/contacts', content.listContacts);
router.put('/contacts/:id', content.updateContact);
router.delete('/contacts/:id', content.deleteContact);

// Event settings
router.get('/event', content.getEvent);
router.put('/event', singleImage('banner'), content.updateEvent);

// Admin users (super only)
router.get('/admins', requireRole('super'), users.listAdmins);
router.post('/admins', requireRole('super'), users.createAdmin);
router.put('/admins/:id', requireRole('super'), users.updateAdmin);
router.delete('/admins/:id', requireRole('super'), users.deleteAdmin);

// Email broadcast
router.post('/email/send', mail.sendEmail);

// CSV export
router.get('/export/:type', mail.exportCsv);

export default router;
