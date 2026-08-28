const path = require('path');
const express = require('express');
require('express-async-errors');
const config = require('./config');
const scheduler = require('./scheduler');

const authRoutes = require('./routes/auth');
const familyRoutes = require('./routes/family');
const taskRoutes = require('./routes/tasks');
const listRoutes = require('./routes/lists');
const pushRoutes = require('./routes/push');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/push', pushRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Serverfehler.' });
});

app.listen(config.port, () => {
  console.log(`iFamily läuft auf ${config.appUrl} (Port ${config.port})`);
  scheduler.start();
});
