const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let users = {}; // id -> {id,name,username,dp,socketId,online}

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/clear', (req,res)=>{ users={}; res.send('cleared ✅'); });

function isTaken(name, myId){
  if(!name) return false;
  name=name.toLowerCase().trim();
  return Object.values(users).some(u=> u.username.toLowerCase()===name && u.id!==myId);
}

io.on('connection', (socket)=>{

  socket.on('checkUsername', ({q, myId})=>{
    socket.emit('checkResult', {q, available:!isTaken(q, myId)});
  });

  socket.on('join', (data)=>{
    data.username = data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g,'');
    if(isTaken(data.username, data.id)){
      return socket.emit('usernameTaken');
    }
    // same username ka purana record hata do
    Object.keys(users).forEach(k=>{ if(users[k].username===data.username && k!==data.id) delete users[k]; });

    users[data.id] = {
      id:data.id,
      name:data.name,
      username:data.username,
      dp:data.dp,
      socketId:socket.id,
      online:true,
      lastSeen: Date.now()
    };
    socket.userId = data.id;
    socket.emit('joinOk', users[data.id]);
    io.emit('users', Object.values(users));
  });

  socket.on('searchUser', (q)=>{
    q=(q||'').toLowerCase().trim();
    if(!q) return socket.emit('searchResult', []);
    // ONLINE + OFFLINE dono me search
    let res = Object.values(users).filter(u=>
      u.username.includes(q) || u.name.toLowerCase().includes(q)
    ).slice(0,20);
    socket.emit('searchResult', res);
  });

  socket.on('send', (data)=>{
    let target = users[data.to] || Object.values(users).find(u=>u.username===data.to);
    if(target && target.socketId){
      io.to(target.socketId).emit('receive', data);
    } else {
      // target offline bhi ho to bhi broadcast kar do taaki jab online aaye to local me save rahe
      socket.broadcast.emit('receive', data);
    }
  });

  socket.on('updateProfile', (data)=>{
    data.username=data.username.toLowerCase().trim().replace(/[^a-z0-9_]/g,'');
    if(isTaken(data.username, data.id)) return socket.emit('usernameTaken');
    Object.keys(users).forEach(k=>{ if(users[k].username===data.username && k!==data.id) delete users[k]; });
    if(users[data.id]){
      users[data.id] = {...users[data.id], name:data.name, username:data.username, dp:data.dp, socketId: users[data.id].socketId, online:true};
      socket.emit('profileUpdated', users[data.id]);
      io.emit('users', Object.values(users));
    }
  });

  socket.on('typing', (d)=>{
    let target = users[d.to];
    if(target && target.socketId) io.to(target.socketId).emit('typing', {from:d.from});
  });

  socket.on('deleteMsg', (d)=> io.emit('deleteMsg', d));

  socket.on('disconnect', ()=>{
    if(socket.userId && users[socket.userId]){
      users[socket.userId].online=false;
      users[socket.userId].lastSeen=Date.now();
      // DELETE NAHI KARENGE - isiliye dusre phone se search me ayega
      io.emit('users', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=> console.log('Running '+PORT));
