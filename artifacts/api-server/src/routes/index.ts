import { Router, type IRouter } from "express";
import healthRouter         from "./health";
import authRouter           from "./auth";
import authDeviceRouter     from "./auth-device";
import kimiRouter           from "./kimi";
import projectsRouter       from "./projects";
import xcodeRouter          from "./xcode";
import deployRouter         from "./deploy";
import sentientRouter       from "./sentient";
import qiRouter             from "./qi";
import formulaRouter        from "./formula";
import automateRouter       from "./automate";
import transformRouter      from "./transform";
import assetsRouter         from "./assets";
import { requireSovereign } from "../middleware/require-sovereign";

const router: IRouter = Router();

// ── Unguarded ─────────────────────────────────────────────────────
router.use(healthRouter);   // /healthz — no auth
router.use(authRouter);        // /auth/*               — no auth (issues the token)
router.use("/auth", authDeviceRouter); // /auth/github-device/* — no auth (bootstrap)

// ── Sovereign gate — all routes below require biometric JWT ───────
router.use(requireSovereign);

router.use(assetsRouter);
router.use(kimiRouter);
router.use(automateRouter);
router.use(transformRouter);
router.use(projectsRouter);
router.use(xcodeRouter);
router.use("/deploy", deployRouter);
router.use(sentientRouter);
router.use(qiRouter);
router.use(formulaRouter);

export default router;
