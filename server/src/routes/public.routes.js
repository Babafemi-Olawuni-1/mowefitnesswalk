/**
 * Public routes. Mounted at /api.
 */
import { asyncRouter } from '../utils/asyncRouter.js';
import * as publicController from '../controllers/public.controller.js';
import { register } from '../controllers/registration.controller.js';
import { singleImage } from '../middleware/upload.js';
import { registerLimiter, contactLimiter } from '../middleware/rateLimit.js';

const router = asyncRouter();

router.post('/register', registerLimiter, singleImage('photo'), register);

router.get('/verify/:id', publicController.verify);
router.get('/sponsors', publicController.listSponsors);
router.get('/gallery', publicController.listGallery);
router.get('/event', publicController.getEvent);
router.post('/contact', contactLimiter, publicController.submitContact);
router.get('/download-pass/:filename', publicController.downloadPass);

export default router;
