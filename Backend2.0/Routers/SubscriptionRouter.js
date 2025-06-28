import express from "express";
import { addSubscription , deleteSubscription , getAllSubscriptions } from "../Controller/SubscriptionController.js";

export const SubscriptionRouter = express.Router();

SubscriptionRouter.post("/add", addSubscription);
SubscriptionRouter.delete("/delete/:id", deleteSubscription);
SubscriptionRouter.get("/get", getAllSubscriptions);

