import express from 'express';
import {handleBuySubscription , handleAddSubscription , handleGetSubscription , handleUpdateSubscription , handleDeleteSubscription , handleSpecficGetSubscription } from '../Controller/Subscription/Subscription.js'
import { checkadmin } from '../Middleware/auth.js';

export const SubscriptionRouter =  express.Router();

SubscriptionRouter.post('/buysubscription' ,handleBuySubscription);
SubscriptionRouter.patch('/updatesubscription/:id' ,checkadmin ,handleUpdateSubscription);
SubscriptionRouter.post('/addsubscription' ,handleAddSubscription);
SubscriptionRouter.post('/deletesubscription' , checkadmin,handleDeleteSubscription);
SubscriptionRouter.get('/getsubscription' , handleGetSubscription);
SubscriptionRouter.get('/getsubscription/:id' , handleSpecficGetSubscription);
