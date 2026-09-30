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

app.get('/clear', (req,res)=>{
  users={};
  res.send('All cleared - ab sab username available hai ✅');
});

function isUsernameTaken(uname, myId){
  if(!uname) return false;
  uname = uname.toLowerCase().trim();
  return Object.values(users).some(u =>
    u.username?.toLowerCase().trim() === uname &&
    u.id!== myId &&
    u.online === true
  );
}

io.on('connection', (socket) => {

  socket.on('checkUsername', (q)=>{
    let taken = isUsernameTaken(q.q, q.myId);
    socket.emit('checkResult', {available:!taken});
  });

  socket.on('join', (data) => {
    if(!data.username) data.username = data.id;
    data.username = data.username.toLowerCase().trim();
    if(isUsernameTaken(data.username, data.id)){
      socket.emit('usernameTaken');
      return;
    }
    // same username ka offline user ho to hata do
    Object.keys(users).forEach(k=>{
      if(users[k].username === data.username && k!== data.id){
        delete users[k];
      }
    });
    users[data.id] = {...data, socketId: socket.id, online: true };
    socket.userId = data.id;
    io.emit('users', Object.values(users));
    socket.emit('joinOk', users[data.id]);
  });

  socket.on('updateProfile', (data)=>{
    data.username = data.username.toLowerCase().trim();
    if(isUsernameTaken(data.username, data.id)){
      socket.emit('usernameTaken');
      return;
    }
    Object.keys(users).forEach(k=>{
      if(users[k].username === data.username && k!== data.id) delete users[k];
    });
    if(users[data.id]){
      users[data.id] = {...users[data.id],...data, socketId: users[data.id].socketId, online:true };
      io.emit('users', Object.values(users));
      socket.emit('profileUpdated', users[data.id]);
    }
  });

  socket.on('searchUser', (q)=>{
    q=q.toLowerCase();
    let res=Object.values(users).filter(u=> u.online && (u.username?.includes(q) || u.name?.toLowerCase().includes(q))).slice(0,10);
    socket.emit('searchResult', res);
  });

  socket.on('send', (data) => {
    const target = users[data.to] || Object.values(users).find(u=>u.username===data.to);
    if(target) io.to(target.socketId).emit('receive', data);
    else socket.broadcast.emit('receive', data);
  });

  socket.on('groupMsg', (data) => io.emit('groupMsg', data));
  socket.on('deleteMsg', (data) => io.emit('deleteMsg', data));
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
