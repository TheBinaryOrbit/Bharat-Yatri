import express from 'express';
import { buySubscription , createOrder , getUserSubscriptions , getFreeTrialSubscription } from '../Controller/SubscriptionPurchaseController.js';

export const SubscriptionPurchaseRouter = express.Router();


SubscriptionPurchaseRouter.post('/buy' , buySubscription );
SubscriptionPurchaseRouter.post('/createorder', createOrder);
SubscriptionPurchaseRouter.get('/getuser/:userId', getUserSubscriptions);
SubscriptionPurchaseRouter.post('/getfreetrial/:userId', getFreeTrialSubscription);