const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static('public'));

let users = {};
try{ if(fs.existsSync('users.json')) users = JSON.parse(fs.readFileSync('users.json','utf8')); }catch(e){}
function save(){ try{ fs.writeFileSync('users.json', JSON.stringify(users)); }catch(e){} }

io.on('connection', (socket) => {
  socket.on('register', (d)=>{
    let u = d.username.toLowerCase();
    if(users[u]) return socket.emit('authError','Username already taken');
    let id='u_'+Date.now();
    users[u]={ id, name:d.name, username:u, password:d.password, dp:`https://i.pravatar.cc/150?u=${id}` };
    save(); socket.emit('authOk', users[u]);
  });
  socket.on('login', (d)=>{
    let u = d.username.toLowerCase();
    if(!users[u]) return socket.emit('authError','User not found');
    if(users[u].password!==d.password) return socket.emit('authError','Wrong password');
    socket.emit('authOk', users[u]);
  });
  socket.on('join', (u)=>{ socket.userId=u.id; socket.join(u.id); io.emit('users', Object.values(users)); });
  socket.on('searchUser', (q)=>{ q=(q||'').toLowerCase(); let r=Object.values(users).filter(x=>x.username.includes(q)||x.name.toLowerCase().includes(q)).slice(0,10); socket.emit('searchResult', r); });
  socket.on('send', (d)=>{ io.to(d.to).emit('receive', d); });
  socket.on('call', (d)=>{ io.to(d.to).emit('incomingCall',{from:d.from,offer:d.offer,type:d.type}); });
  socket.on('answer', (d)=>{ io.to(d.to).emit('callAnswered',{answer:d.answer}); });
  socket.on('ice', (d)=>{ io.to(d.to).emit('ice',{candidate:d.candidate}); });
  socket.on('endCall', (d)=>{ io.to(d.to).emit('callEnded'); });
  socket.on('updateProfile', (d)=>{ let k=Object.keys(users).find(x=>users[x].id===d.id); if(k){ if(d.name) users[k].name=d.name; if(d.dp) users[k].dp=d.dp; save(); io.emit('users',Object.values(users)); } });
});
server.listen(process.env.PORT||3000, ()=>console.log('live'));
