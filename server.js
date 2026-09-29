function showTab(t){
  if(t==='status'){
    let img = prompt('Status ke liye image URL ya text likh:');
    if(img) socket.emit('postStatus',{id:myId,name:myName,dp:myDP,text:img,time:Date.now()});
  }
  if(t==='groups'){
    let gname = prompt('Group ka naam:');
    if(!gname) return;
    let members = prompt('Members ke IDs comma se (ex: user_123,user_456):');
    let mArr = members? members.split(',') : [];
    socket.emit('createGroup',{groupId:'g_'+Date.now(),name:gname,members:mArr,creator:myId});
    alert('Group ban gaya: '+gname);
  }
}
socket.on('statuses', (list)=>{
  console.log('Statuses', list);
  // yaha tu status ko upar gol gol dikha sakta hai
});
socket.on('groups', (list)=>{
  console.log('Groups', list);
});
socket.on('groupMsg', (data)=>{
  // group message aaya
  addBubble({...data,text:'[Group '+data.groupId+'] '+data.text}, 'other');
});
