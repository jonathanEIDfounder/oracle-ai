import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kimiRouter from "./kimi";
import projectsRouter from "./projects";
import xcodeRouter from "./xcode";
import deployRouter from "./deploy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kimiRouter);
router.use(projectsRouter);
router.use(xcodeRouter);
router.use("/deploy", deployRouter);

export default router;
