import express from 'express';
import {handleBuySubscription , handleAddSubscription , handleGetSubscription , handleUpdateSubscription , handleDeleteSubscription } from '../Controller/Subscription/Subscription.js'
import { checkadmin } from '../Middleware/auth.js';

export const SubscriptionRouter =  express.Router();

SubscriptionRouter.post('/buysubscription' ,handleBuySubscription);
SubscriptionRouter.post('/updatesubscription' ,checkadmin ,handleUpdateSubscription);
SubscriptionRouter.post('/addsubscription' , checkadmin,handleAddSubscription);
SubscriptionRouter.post('/deletesubscription' , checkadmin,handleDeleteSubscription);
SubscriptionRouter.get('/getsubscription' , handleGetSubscription);
