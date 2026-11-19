
import { Router } from "express";
import healthRouter from "../modules/health/health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRoutes);

export default apiRouter;
