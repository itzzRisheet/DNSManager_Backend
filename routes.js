import { Router } from "express";
import * as controller from "./controllers/controller.js";

// register & login

const router = Router();

router.route("/register").post(controller.register);
router.route("/login").post(controller.login);

// hostedzones or domains
router.route("/domains").get(controller.getRoutes);
router.route("/hostedzones").post(controller.createHostedZone);
router.route("/hostedzones").delete(controller.deletehostedzones);
router.route("/hostedzones/:id").put(controller.updateHostedZone);
router.route("/regions").get(controller.getRegions);
router.route("/vpcs/:region").get(controller.getVpcs);

// records
router.route("/recordsoperations").post(controller.changeRecords);
router.route("/records/:hostedZoneID").get(controller.getRecords);

export default router;
