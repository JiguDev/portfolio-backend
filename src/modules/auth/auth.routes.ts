
import { Router } from "express";

import { authController } from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";

const router = Router();

// Public authentication endpoints
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/forgot-password", authController.forgotPassword);

// Protected endpoint
router.get("/me", authenticate, authController.me);

export default router;
