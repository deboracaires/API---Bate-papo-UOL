import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

import participantSchemma from './Schemmas/participantSchemma.js';
import messageSchemma from './Schemmas/messageSchemma.js';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("batepapouol");
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/participants', async (req, res) => {
  
  try {
    const user = req.body;
  
    const validation = participantSchemma.validate(user, { abortEarly: true});

    if (validation.error || user.name.trim().length === 0) {
      return res.sendStatus(422);
    }

    const verifyUser = await db.collection('participants').findOne({ name: user.name.trim() });

    if (verifyUser) {
      return res.sendStatus(409);
    }

    user.lastStatus = Date.now();

    await db.collection('participants').insertOne(user);

    res.sendStatus(201);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants)
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post('/messages', async (req, res) => {
  try {
    const user = req.headers.user;

    const message = req.body;

    if (!user) {
      return res.sendStatus(400);
    }
    const verifyUser = await db.collection('participants').findOne({ name: user });

    if (!verifyUser) {
      return res.sendStatus(401);
    }

    const validation = messageSchemma.validate(message, { abortEarly: true});

    if (validation.error || (message.type !== 'private_message' && message.type !== 'message')) {
      return res.sendStatus(422);
    }

    message.time = dayjs().format('HH:mm:ss');

    await db.collection('message').insertOne(message);    

    res.sendStatus(201);

  } catch (err) {
    res.sendStatus(500);
  }
})

app.listen(5000);