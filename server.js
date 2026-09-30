const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let users = {}; // id -> {id,name,dp,username,online}
let statuses = [];
let groups = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function isUsernameTaken(uname, myId){
  if(!uname) return false;
  uname = uname.toLowerCase().trim();
  // sirf ONLINE users ko check karo, offline ko ignore karo
  return Object.values(users).some(u=>
    u.username?.toLowerCase().trim() === uname &&
    u.id!== myId &&
    u.online === true
  );
}
  uname = uname.toLowerCase();
  return Object.values(users).some(u=> u.username?.toLowerCase()===uname && u.id!==myId);
}

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    if(!data.username) data.username = data.id;
    if(isUsernameTaken(data.username, data.id)){
      socket.emit('usernameTaken');
      return;
    }
    users[data.id] = {...data, socketId: socket.id, online: true };
    socket.userId = data.id;
    io.emit('users', Object.values(users));
    socket.emit('statuses', statuses);
    io.emit('groups', Object.values(groups));
  });

  socket.on('updateProfile', (data)=>{
    if(isUsernameTaken(data.username, data.id)){
      socket.emit('usernameTaken');
      return;
    }
    if(users[data.id]){
      users[data.id] = {...users[data.id],...data, socketId: users[data.id].socketId, online:true };
      io.emit('users', Object.values(users));
      socket.emit('profileUpdated', users[data.id]);
    }
  });

  socket.on('searchUser', (q)=>{
    q=q.toLowerCase();
    let res=Object.values(users).filter(u=> u.username?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q)).slice(0,10);
    socket.emit('searchResult', res);
  });

  socket.on('send', (data) => {
    const target = users[data.to] || Object.values(users).find(u=>u.username===data.to);
    if(target) io.to(target.socketId).emit('receive', data);
    else socket.broadcast.emit('receive', data);
  });

  socket.on('postStatus', (st) => {
    statuses = statuses.filter(s => s.id!== st.id);
    statuses.unshift({...st, time: Date.now() });
    io.emit('statuses', statuses);
  });
  socket.on('createGroup', (g) => {
    groups[g.id] = g;
    io.emit('groups', Object.values(groups));
  });
  socket.on('groupMsg', (data) => io.emit('groupMsg', data));
  socket.on('deleteMsg', (data) => io.emit('deleteMsg', data));
  socket.on('typing', (d) => socket.broadcast.emit('typing', d));

  socket.on('disconnect', () => {
    if (socket.userId && users[socket.userId]) {
      users[socket.userId].online = false;
      io.emit('users', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Running on '+PORT));
