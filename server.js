const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let users = {};
let statuses = [];
let groups = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    users[data.id] = { ...data, socketId: socket.id, online: true };
    socket.userId = data.id;
    io.emit('users', Object.values(users));
    socket.emit('statuses', statuses);
    io.emit('groups', Object.values(groups));
  });

  socket.on('send', (data) => {
    if (data.to === 'all') {
      socket.broadcast.emit('receive', data);
    } else {
      const target = users[data.to];
      if (target) io.to(target.socketId).emit('receive', data);
    }
  });

  socket.on('postStatus', (st) => {
    statuses = statuses.filter(s => s.id !== st.id);
    statuses.unshift({ ...st, time: Date.now() });
    io.emit('statuses', statuses);
  });

  socket.on('createGroup', (g) => {
    groups[g.id] = g;
    io.emit('groups', Object.values(groups));
  });

  socket.on('groupMsg', (data) => {
    io.emit('groupMsg', data);
  });

  socket.on('delivered', (d) => io.emit('delivered', d));
  socket.on('seen', (d) => io.emit('seen', d));
  socket.on('typing', (d) => socket.broadcast.emit('typing', d));
  
  socket.on('updateDP', (data) => {
    if (users[data.id]) users[data.id].dp = data.dp;
    io.emit('users', Object.values(users));
  });

  socket.on('disconnect', () => {
    if (socket.userId && users[socket.userId]) {
      users[socket.userId].online = false;
      io.emit('users', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('WhatsApp Running on ' + PORT));
