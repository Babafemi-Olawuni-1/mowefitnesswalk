/**
 * Health and root routes. Mounted at the application root.
 */
import { asyncRouter } from '../utils/asyncRouter.js';
import { root, health } from '../controllers/health.controller.js';

const router = asyncRouter();

router.get('/', root);
router.get('/health', health);

export default router;
