// all public api endpoints related to authentication
import express from 'express';
import { DriverRegister , Driverlogin} from '../controllers/AuthController.js';
const router = express.Router();

router.post('/driver/register', DriverRegister);
router.post('/driver/login', Driverlogin);

export default router;