import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import { stripHtml } from "string-strip-html";

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

    const verifyUser = await db.collection('participants').findOne({ name: stripHtml(user.name).result.trim() });

    if (verifyUser) {
      return res.sendStatus(409);
    }

    user.lastStatus = Date.now();

    await db.collection('participants').insertOne(user);

    const updateStatus = {
      to: 'Todos',
      from: stripHtml(user.name).result.trim(),
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss'),
    }

    await db.collection('messages').insertOne(updateStatus);

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
    message.to = stripHtml(message.to).result.trim();
    message.time = dayjs().format('HH:mm:ss');
    message.from = stripHtml(user).result.trim();
    message.text = stripHtml(message.text).result.trim();

    await db.collection('messages').insertOne(message);    

    res.sendStatus(201);

  } catch (err) {
    res.sendStatus(500);
  }
});

app.get('/messages', async (req, res) => {
  try {
    let limit = parseInt(req.query.limit);  

    const messages = await db.collection('messages').find().sort({$natural:-1}).limit(limit).toArray();

    const user = req.headers.user;

    if (!user) return res.sendStatus(401);

    const verifyUser = await db.collection('participants').findOne({ name: user });

    if (!verifyUser) {
      return res.sendStatus(401);
    }

    const filteredMessages = messages.filter(message => (message.type === 'message' || message.to === user || message.from === user || message.to === 'Todos'));
    console.log(filteredMessages)
    res.send(filteredMessages.reverse())
  } catch (err) {
    res.sendStatus(500);
  }
});

app.post('/status', async (req, res) => {
  try {
    const user = req.headers.user;

    if (!user) return res.sendStatus(401);

    const verifyUser = await db.collection('participants').findOne({ name: user });

    if (!verifyUser) {
      return res.sendStatus(404);
    }

    await db.collection('participants').updateOne({ 
			_id: verifyUser._id 
		}, { $set: {"lastStatus": Date.now()} });
    
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

async function removeInactiveUsers () {
  try {
    const participants = await db.collection('participants').find().toArray();

    for (let i = 0; i < participants.length; i++) {
      if ((Date.now() - participants[i].lastStatus) > 10000) {
        await db.collection('participants').deleteOne({ _id: new ObjectId(participants[i]._id) });
        const messageUpdate = {
          from: participants[i].name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: dayjs().format('HH:mm:ss'),
        };
        await db.collection('messages').insertOne(messageUpdate);
      }
    }
  } catch (err) {
    console.log(err)
  }
  
}

setInterval(removeInactiveUsers, 15000);

app.delete('/messages/:id', async (req, res) => {
  try {
    const user = req.headers.user;

    if (!user) return res.sendStatus(401);

    const verifyUser = await db.collection('participants').findOne({ name: user });

    if (!verifyUser) {
      return res.sendStatus(404);
    }

    const _id = req.params.id;

    const message = await db.collection('messages').findOne({ _id: new ObjectId(_id) });

    if (!message) {
      return res.sendStatus(404);
    }

    if (message.from !== user) {
      return res.sendStatus(401);
    }

    await db.collection('messages').deleteOne({ _id: new ObjectId(_id) });

    res.sendStatus(200);

  } catch (err) {
    res.sendStatus(500);
  }
})

app.listen(5000);