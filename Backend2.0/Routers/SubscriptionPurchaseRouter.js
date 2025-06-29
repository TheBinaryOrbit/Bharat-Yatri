import express from 'express';
import { buySubscription } from '../Controller/SubscriptionPurchaseController.js';

export const SubscriptionPurchaseRouter = express.Router();


SubscriptionPurchaseRouter.post('/buy' , buySubscription )