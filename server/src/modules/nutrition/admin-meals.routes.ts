import { Router } from "express";
import { z } from "zod";
import { PERMISSIONS, assignMealTemplateSchema, mealTemplateListQuerySchema, mealTemplateSchema, objectIdSchema } from "@recomptrack/shared";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as svc from "./mealTemplates.service";

const idParams = z.object({ id: objectIdSchema });

/** /api/admin/meal-templates */
export const adminMealTemplatesRouter = Router();
adminMealTemplatesRouter.use(authorize(PERMISSIONS.MEAL_PLANS_MANAGE));

adminMealTemplatesRouter.get("/", validate({ query: mealTemplateListQuerySchema }), async (req, res) => {
  res.json(await svc.listTemplates(req.valid.query));
});
adminMealTemplatesRouter.get("/:id", validate({ params: idParams }), async (req, res) => {
  res.json(await svc.getTemplate(req.valid.params.id));
});
adminMealTemplatesRouter.post("/", validate({ body: mealTemplateSchema }), async (req, res) => {
  res.status(201).json(await svc.createTemplate(req, req.valid.body));
});
adminMealTemplatesRouter.put("/:id", validate({ params: idParams, body: mealTemplateSchema }), async (req, res) => {
  res.json(await svc.updateTemplate(req, req.valid.params.id, req.valid.body));
});
for (const [action, status] of [["publish", "PUBLISHED"], ["unpublish", "DRAFT"], ["archive", "ARCHIVED"], ["restore", "DRAFT"]] as const) {
  adminMealTemplatesRouter.post(`/:id/${action}`, validate({ params: idParams }), async (req, res) => {
    res.json(await svc.setTemplateStatus(req, req.valid.params.id, status));
  });
}
adminMealTemplatesRouter.delete("/:id", validate({ params: idParams }), async (req, res) => {
  await svc.deleteTemplate(req, req.valid.params.id);
  res.status(204).end();
});

/** /api/admin/meal-assignments */
export const adminMealAssignmentsRouter = Router();
adminMealAssignmentsRouter.use(authorize(PERMISSIONS.MEAL_PLANS_MANAGE));

adminMealAssignmentsRouter.post("/", validate({ body: assignMealTemplateSchema }), async (req, res) => {
  res.status(201).json(await svc.assignTemplate(req, req.valid.body));
});
adminMealAssignmentsRouter.post("/:id/end", validate({ params: idParams }), async (req, res) => {
  await svc.endMealAssignment(req, req.valid.params.id);
  res.status(204).end();
});
