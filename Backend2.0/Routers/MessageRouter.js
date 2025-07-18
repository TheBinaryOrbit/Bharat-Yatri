import express from 'express';
import { getMyChats , getChatBetweenUsers } from '../Controller/MessageController.js';

export const MessageRouter = express.Router();

MessageRouter.get('/mychats/:userId' , getMyChats)
MessageRouter.get('/chat/:userId1/:userId2/:bookingId', getChatBetweenUsers);
