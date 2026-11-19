
import { Router } from "express";
import {
  getApiHealth,
  getDatabaseHealth,
} from "./health.controller.js";

const healthRouter = Router();

healthRouter.get("/", getApiHealth);
healthRouter.get("/db", getDatabaseHealth);

export default healthRouter;
