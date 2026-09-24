import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

const $ = id => document.getElementById(id);
let scene, camera, renderer, orbit, transform, grid, selected=null;
let objects=[];
let savedProject = null;

function status(t){$("status").textContent=t}

function init(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0xdfe5ea);

  camera=new THREE.PerspectiveCamera(60,1,.1,2000);
  camera.position.set(8,7,10);

  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize($("viewport").clientWidth,$("viewport").clientHeight);
  $("viewport").appendChild(renderer.domElement);

  orbit=new OrbitControls(camera,renderer.domElement);
  orbit.enableDamping=true;
  orbit.target.set(0,1,0);

  transform=new TransformControls(camera,renderer.domElement);
  transform.setMode("translate");
  transform.addEventListener("dragging-changed",e=>orbit.enabled=!e.value);
  scene.add(transform);

  scene.add(new THREE.HemisphereLight(0xffffff,0x687580,2));
  const sun=new THREE.DirectionalLight(0xffffff,3);
  sun.position.set(7,12,8);
  scene.add(sun);

  grid=new THREE.GridHelper(50,50,0x777777,0xbbbbbb);
  scene.add(grid);

  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addAsset(b.dataset.add));
  document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{transform.setMode(b.dataset.tool);status("Інструмент: "+b.dataset.tool)});
  $("gridToggle").onchange=e=>grid.visible=e.target.checked;
  $("snapToggle").onchange=e=>{
    const on=e.target.checked;
    transform.setTranslationSnap(on?.5:null);
    transform.setRotationSnap(on?THREE.MathUtils.degToRad(15):null);
    transform.setScaleSnap(on?.25:null);
  };
  $("deleteBtn").onclick=deleteSelected;
  $("duplicateBtn").onclick=duplicateSelected;
  $("textureBtn").onclick=()=>$("textureInput").click();
  $("textureInput").onchange=e=>e.target.files[0]&&applyTexture(e.target.files[0]);
  $("newBtn").onclick=newProject;
  $("saveBtn").onclick=saveToServer;
  $("exportBtn").onclick=exportZYVO;
  $("glbBtn").onclick=exportGLB;
  $("openBtn").onclick=()=>$("fileInput").click();
  $("fileInput").onchange=importFile;
  $("playBtn").onclick=startGame;
  $("exitGame").onclick=stopGame;
  $("cameraBtn").onclick=toggleGameCamera;
  $("publishBtn").onclick=()=>openPublish(true);
  $("closePublish").onclick=()=>$("publishModal").classList.add("hidden");
  $("confirmPublish").onclick=publishGame;
  bindProperties();

  renderer.domElement.addEventListener("pointerdown",pick);
  window.addEventListener("resize",resize);
  addAsset("box");
  animate();
  resize();
}

function resize(){
  if(!renderer)return;
  const w=$("viewport").clientWidth,h=$("viewport").clientHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
}
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)}

function material(color=0x7cff00){
  return new THREE.MeshStandardMaterial({color,roughness:.65});
}
function addAsset(kind,silent=false){
  let group=new THREE.Group(), geom;
  const make=(g,name,mat=material())=>{const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);return m};

  if(["box","sphere","cylinder","cone","torus"].includes(kind)){
    if(kind==="sphere")geom=new THREE.SphereGeometry(1,24,16);
    if(kind==="cylinder")geom=new THREE.CylinderGeometry(1,1,2,24);
    if(kind==="cone")geom=new THREE.ConeGeometry(1,2,24);
    if(kind==="torus")geom=new THREE.TorusGeometry(1,.28,12,32);
    if(kind==="box")geom=new THREE.BoxGeometry(2,2,2);
    make(geom);
  } else if(kind==="tree"){
    make(new THREE.CylinderGeometry(.28,.38,2,12), "trunk", material(0x8b5a2b)).position.y=1;
    const crown=make(new THREE.SphereGeometry(1.25,16,12), "crown", material(0x35a83f)); crown.position.y=2.4;
  } else if(kind==="table"){
    const top=make(new THREE.BoxGeometry(2.8,.25,1.6)); top.position.y=1.8;
    [[-1.1,-.55],[1.1,-.55],[-1.1,.55],[1.1,.55]].forEach(([x,z])=>{const l=make(new THREE.BoxGeometry(.22,1.8,.22));l.position.set(x,.9,z)});
  } else if(kind==="chair"){
    const seat=make(new THREE.BoxGeometry(1.5,.2,1.5));seat.position.y=1;
    [[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]].forEach(([x,z])=>{const l=make(new THREE.BoxGeometry(.16,1,.16));l.position.set(x,.5,z)});
    const back=make(new THREE.BoxGeometry(1.5,1.6,.18));back.position.set(0,1.8,.66);
  } else if(kind==="car"){
    const body=make(new THREE.BoxGeometry(3.2,.75,1.7), "body", material(0x3b76ff));body.position.y=1;
    [[-1.1,-.8],[1.1,-.8],[-1.1,.8],[1.1,.8]].forEach(([x,z])=>{const w=make(new THREE.CylinderGeometry(.38,.38,.3,16), "wheel", material(0x222222));w.rotation.x=Math.PI/2;w.position.set(x,.45,z)});
    const top=make(new THREE.BoxGeometry(1.5,.65,1.4), "roof", material(0x5f9bff));top.position.set(.2,1.65,0);
  } else if(kind==="plane"){
    const body=make(new THREE.BoxGeometry(3.4,.45,.55), "body", material(0xe6e6e6));
    const wing=make(new THREE.BoxGeometry(1.2,.12,3.8), "wing", material(0xdddddd));
    wing.position.y=.1;
    const tail=make(new THREE.BoxGeometry(.55,.6,.12), "tail", material(0xffffff));tail.position.set(-1.25,.45,0);
  } else if(kind==="weapon"){
    const body=make(new THREE.BoxGeometry(1.5,.28,.5), "weapon", material(0x333333));
    const grip=make(new THREE.BoxGeometry(.35,.7,.35), "grip", material(0x222222));grip.position.set(-.35,-.42,0);
    group.userData.weapon={damage:25,range:30,pickup:true};
  } else if(kind==="spawn"){
    const pad=make(new THREE.CylinderGeometry(1.3,.95,.2,32), "spawn", material(0x20d96b));pad.position.y=.1;
    group.userData.spawn=true;
  }

  group.name=kind[0].toUpperCase()+kind.slice(1)+"_"+(objects.length+1);
  group.position.y=kind==="spawn"?0:1;
  group.userData.zyvo={id:crypto.randomUUID(),kind,texture:null};
  scene.add(group);objects.push(group);select(group);list();
  if(!silent)status("Додано "+group.name);
}

function select(o){
  selected=o;transform.attach(o);
  $("noSelection").classList.add("hidden");$("propertyForm").classList.remove("hidden");
  refresh();list();
}
function refresh(){
  if(!selected)return;
  $("objName").value=selected.name;
  const mesh=selected.children.find(x=>x.isMesh);
  if(mesh){
    $("objColor").value="#"+mesh.material.color.getHexString();
    $("objOpacity").value=mesh.material.opacity;
  }
  ["x","y","z"].forEach(a=>{
    $("p"+a).value=selected.position[a].toFixed(2);
    $("r"+a).value=THREE.MathUtils.radToDeg(selected.rotation[a]).toFixed(1);
    $("s"+a).value=selected.scale[a].toFixed(2);
  });
}
function list(){
  $("objectList").innerHTML="";
  objects.forEach(o=>{
    const d=document.createElement("div");d.className="object-item"+(o===selected?" selected":"");d.textContent="▣ "+o.name;d.onclick=()=>select(o);$("objectList").appendChild(d);
  });
  $("objectCount").textContent=objects.length+" об'єктів";
}
function pick(e){
  if(e.button!==0)return;
  const r=renderer.domElement.getBoundingClientRect();
  const v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(v,camera);
  const hits=ray.intersectObjects(objects,true);if(!hits.length)return;
  let o=hits[0].object;while(o.parent&&!objects.includes(o))o=o.parent;if(objects.includes(o))select(o);
}
function bindProperties(){
  $("objName").oninput=e=>{if(selected){selected.name=e.target.value||"Object";list()}};
  $("objColor").oninput=e=>selected&&selected.traverse(x=>{if(x.isMesh)x.material.color.set(e.target.value)});
  $("objOpacity").oninput=e=>selected&&selected.traverse(x=>{if(x.isMesh){x.material.opacity=+e.target.value;x.material.transparent=x.material.opacity<1}});
  ["x","y","z"].forEach(a=>{
    $("p"+a).onchange=e=>selected&&(selected.position[a]=+e.target.value||0);
    $("r"+a).onchange=e=>selected&&(selected.rotation[a]=THREE.MathUtils.degToRad(+e.target.value||0));
    $("s"+a).onchange=e=>selected&&(selected.scale[a]=Math.max(.01,+e.target.value||1));
  });
}
function deleteSelected(){
  if(!selected)return;
  scene.remove(selected);objects=objects.filter(o=>o!==selected);selected=null;transform.detach();$("propertyForm").classList.add("hidden");$("noSelection").classList.remove("hidden");list();status("Видалено");
}
function duplicateSelected(){
  if(!selected)return;
  const c=selected.clone(true);c.name=selected.name+"_Copy";c.position.x+=1;c.userData={...selected.userData,zyvo:{...(selected.userData.zyvo||{}),id:crypto.randomUUID()}};scene.add(c);objects.push(c);select(c);
}
function applyTexture(file){
  if(!selected)return;
  const reader=new FileReader();
  reader.onload=()=>new THREE.TextureLoader().load(reader.result,t=>{
    t.colorSpace=THREE.SRGBColorSpace;
    selected.traverse(x=>{if(x.isMesh){x.material.map=t;x.material.needsUpdate=true}});
    selected.userData.zyvo.texture=reader.result;status("Текстуру додано");
  });
  reader.readAsDataURL(file);
}
function serialize(o){
  const first=o.children.find(x=>x.isMesh);
  const data={id:o.userData.zyvo?.id||crypto.randomUUID(),name:o.name,kind:o.userData.zyvo?.kind||"box",position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],scale:o.scale.toArray(),color:first?"#"+first.material.color.getHexString():"#7cff00",opacity:first?first.material.opacity:1,texture:o.userData.zyvo?.texture||null,spawn:!!o.userData.spawn,weapon:o.userData.weapon||null};
  return data;
}
function projectData(meta={}){
  return {format:"ZYVO",zyvoVersion:2,name:$("projectName").value.trim()||"MyWorld",multiplayer:$("multiplayerToggle").checked,objects:objects.map(serialize),metadata:meta};
}
function download(name,data,type="application/octet-stream"){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function exportZYVO(){const p=projectData();download((p.name||"MyWorld")+".zyvo",JSON.stringify(p,null,2),"application/json");status("Експортовано .zyvo")}
function exportGLB(){
  const exporter=new GLTFExporter();
  const group=new THREE.Group();objects.forEach(o=>group.add(o.clone(true)));
  exporter.parse(group,gltf=>{
    const blob=gltf instanceof ArrayBuffer?new Blob([gltf],{type:"model/gltf-binary"}):new Blob([JSON.stringify(gltf)],{type:"model/gltf+json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=(($("projectName").value||"MyWorld"))+".glb";a.click();status("Експортовано GLB");
  },err=>{console.error(err);status("Помилка GLB")},{binary:true});
}
function newProject(){
  objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();$("propertyForm").classList.add("hidden");$("noSelection").classList.remove("hidden");$("projectName").value="MyWorld";addAsset("box",true);status("Новий проєкт");
}
async function saveToServer(){
  try{
    const p=projectData();
    const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
    const d=await r.json();if(!r.ok)throw Error(d.error);savedProject=p;status("Збережено: "+d.file);localStorage.setItem("zyvoProject",JSON.stringify(p));
  }catch(e){console.error(e);status("Помилка збереження")}
}
async function importFile(e){
  const f=e.target.files[0];if(!f)return;
  try{
    if(f.name.toLowerCase().endsWith(".zyvo"))loadZYVO(JSON.parse(await f.text()));
    else if(f.name.toLowerCase().endsWith(".glb"))await importGLB(f);
    else throw Error("Невідомий формат");
  }catch(err){console.error(err);alert("Не вдалося імпортувати файл.");}
  e.target.value="";
}
function makeGeometry(k){
  if(k==="sphere")return new THREE.SphereGeometry(1,24,16);
  if(k==="cylinder")return new THREE.CylinderGeometry(1,1,2,24);
  if(k==="cone")return new THREE.ConeGeometry(1,2,24);
  if(k==="torus")return new THREE.TorusGeometry(1,.28,12,32);
  return new THREE.BoxGeometry(2,2,2);
}
function loadZYVO(data){
  if(data.format!=="ZYVO")throw Error("Не ZYVO");
  objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();
  $("projectName").value=data.name||"ImportedWorld";
  $("multiplayerToggle").checked=data.multiplayer!==false;
  (data.objects||[]).forEach(item=>{
    addAsset(item.kind,true);
    const o=objects[objects.length-1];
    o.name=item.name||o.name;o.position.fromArray(item.position||[0,0,0]);o.rotation.set(...(item.rotation||[0,0,0]));o.scale.fromArray(item.scale||[1,1,1]);
    o.userData.zyvo={id:item.id||crypto.randomUUID(),kind:item.kind,texture:item.texture||null};o.userData.spawn=!!item.spawn;o.userData.weapon=item.weapon||null;
    o.traverse(x=>{if(x.isMesh){x.material.color.set(item.color||"#7cff00");x.material.opacity=item.opacity??1;x.material.transparent=x.material.opacity<1}});
    if(item.texture)applyTextureData(o,item.texture);
  });
  list();status("Імпортовано");
}
function applyTextureData(o,data){
  new THREE.TextureLoader().load(data,t=>{t.colorSpace=THREE.SRGBColorSpace;o.traverse(x=>{if(x.isMesh){x.material.map=t;x.material.needsUpdate=true}})});
}
async function importGLB(file){
  const loader=new GLTFLoader();const buf=await file.arrayBuffer();
  const gltf=await new Promise((resolve,reject)=>loader.parse(buf,"",resolve,reject));
  objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();
  const root=gltf.scene;root.name=file.name.replace(/\.glb$/i,"");root.userData.zyvo={id:crypto.randomUUID(),kind:"imported"};scene.add(root);objects.push(root);select(root);status("GLB імпортовано");
}

/* Публікація */
function openPublish(){
  $("publishModal").classList.remove("hidden");
  $("pubName").value=$("projectName").value||"MyWorld";
}
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{if(!file)return resolve(null);const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
}
async function publishGame(){
  try{
    const avatar=await fileToDataURL($("pubAvatar").files[0]);
    const banner=await fileToDataURL($("pubBanner").files[0]);
    const meta={title:$("pubName").value.trim()||"MyWorld",avatar,banner,description:$("pubDescription").value.trim(),multiplayer:$("pubMultiplayer").checked};
    const p=projectData(meta);p.name=meta.title;
    const r=await fetch("/api/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
    const d=await r.json();if(!r.ok)throw Error(d.error||"Publish error");
    $("publishModal").classList.add("hidden");status(d.sentToPlatform?"Опубліковано на платформі":"Збережено для публікації");
    alert(d.message||"Гру опубліковано.");
  }catch(e){console.error(e);alert("Не вдалося опублікувати: "+e.message)}
}

/* Простий game preview: spawn, avatar, 1P/3P, nickname, jump, joystick, зброя, respawn, multiplayer. */
let game={running:false,scene:null,camera:null,renderer:null,clock:null,player:null,mode:3,keys:{},velocityY:0,grounded:true,spawn:new THREE.Vector3(0,1,0),others:new Map(),socket:null,health:100,weapon:null};
function startGame(){
  if(game.running)return;
  game.running=true;$("gameOverlay").classList.remove("hidden");
  game.scene=new THREE.Scene();game.scene.background=new THREE.Color(0x86b8e8);
  game.camera=new THREE.PerspectiveCamera(70,1,.1,1000);
  game.renderer=new THREE.WebGLRenderer({antialias:true});game.renderer.setPixelRatio(Math.min(devicePixelRatio,2));$("gameViewport").appendChild(game.renderer.domElement);
  game.clock=new THREE.Clock();
  game.scene.add(new THREE.HemisphereLight(0xffffff,0x607080,2));
  const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(5,10,5);game.scene.add(sun);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(80,.4,80),new THREE.MeshStandardMaterial({color:0x5da85b}));floor.position.y=-.2;game.scene.add(floor);
  const sp=objects.find(o=>o.userData.spawn);game.spawn.copy(sp?sp.position:new THREE.Vector3(0,1,0));
  objects.filter(o=>!o.userData.spawn).forEach(o=>game.scene.add(o.clone(true)));
  game.player=makeAvatar("You",0x4b78ff);game.player.position.copy(game.spawn);game.scene.add(game.player);
  game.weapon=objects.find(o=>o.userData.weapon)?.clone(true)||null;
  if(game.weapon){game.weapon.position.copy(game.player.position).add(new THREE.Vector3(1,0,0));game.scene.add(game.weapon)}
  game.camera.position.set(0,4,7);game.camera.lookAt(game.player.position);
  resizeGame();window.addEventListener("resize",resizeGame);
  window.onkeydown=e=>game.keys[e.key.toLowerCase()]=true;
  window.onkeyup=e=>game.keys[e.key.toLowerCase()]=false;
  game.renderer.domElement.addEventListener("pointerdown",shoot);
  if(window.io&&$("multiplayerToggle").checked){
    game.socket=io();game.socket.emit("joinGame",{gameId:$("projectName").value,nickname:"Player"});
    game.socket.on("players",arr=>arr.forEach(addOther));game.socket.on("playerJoined",addOther);
    game.socket.on("playerState",p=>updateOther(p));
    game.socket.on("playerLeft",id=>removeOther(id));
    game.socket.on("playerHit",x=>{if(x.targetId===game.socket.id)game.health=x.health});
    game.socket.on("playerKilled",x=>{if(x.victimId===game.socket.id)respawn()});
    game.socket.on("playerRespawn",p=>{if(p.id===game.socket.id){game.health=100;game.player.position.copy(game.spawn)}});
  }
  requestAnimationFrame(gameLoop);
}
function makeAvatar(name,color){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,1.4,.6),mat);body.position.y=1.1;g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshStandardMaterial({color:0xf0c7a0}));head.position.y=2.2;g.add(head);
  const leg1=new THREE.Mesh(new THREE.BoxGeometry(.35,.9,.35),mat);leg1.position.set(-.22,.3,0);g.add(leg1);
  const leg2=leg1.clone();leg2.position.x=.22;g.add(leg2);
  const tag=document.createElement("div");tag.className="nickname";tag.textContent=name;tag.dataset.id="local";$("nicknameLayer").appendChild(tag);g.userData.tag=tag;return g;
}
function addOther(p){
  if(p.id===game.socket?.id)return;
  if(game.others.has(p.id))return;
  const av=makeAvatar(p.nickname||"Player",0xff7043);av.position.set(p.x,p.y,p.z);game.scene.add(av);game.others.set(p.id,av);
}
function updateOther(p){
  const av=game.others.get(p.id);if(!av)return;
  av.position.lerp(new THREE.Vector3(p.x,p.y,p.z),.5);
  av.rotation.y=p.yaw||0;av.userData.health=p.health;
}
function removeOther(id){
  const av=game.others.get(id);if(!av)return;
  if(av.userData.tag)av.userData.tag.remove();game.scene.remove(av);game.others.delete(id);
}
function resizeGame(){if(!game.renderer)return;const w=$("gameViewport").clientWidth,h=$("gameViewport").clientHeight;game.camera.aspect=w/h;game.camera.updateProjectionMatrix();game.renderer.setSize(w,h)}
function toggleGameCamera(){game.mode=game.mode===3?1:3}
function gameLoop(){
  if(!game.running)return;
  const dt=Math.min(.05,game.clock.getDelta());
  const dir=new THREE.Vector3();
  if(game.keys.w)dir.z-=1;if(game.keys.s)dir.z+=1;if(game.keys.a)dir.x-=1;if(game.keys.d)dir.x+=1;
  if(dir.lengthSq())dir.normalize().multiplyScalar(5*dt);
  game.player.position.add(dir);
  if(game.keys[" "]&&game.grounded){game.velocityY=7;game.grounded=false}
  game.velocityY-=18*dt;game.player.position.y+=game.velocityY*dt;
  if(game.player.position.y<=game.spawn.y){game.player.position.y=game.spawn.y;game.velocityY=0;game.grounded=true}
  if(game.player.position.y<-10)respawn();
  const target=game.player.position.clone().add(new THREE.Vector3(0,1,0));
  if(game.mode===3){
    const behind=new THREE.Vector3(0,3.2,6);game.camera.position.lerp(target.clone().add(behind),.12);game.camera.lookAt(target);
  }else{
    game.camera.position.copy(game.player.position).add(new THREE.Vector3(0,1.8,0));game.camera.lookAt(target.clone().add(new THREE.Vector3(0,0,-5)));
  }
  updateTags();
  if(game.socket&&game.socket.connected)game.socket.emit("state",{x:game.player.position.x,y:game.player.position.y,z:game.player.position.z,yaw:game.player.rotation.y,health:game.health});
  game.renderer.render(game.scene,game.camera);requestAnimationFrame(gameLoop);
}
function updateTags(){
  const all=[game.player,...game.others.values()];
  all.forEach(av=>{
    if(!av.userData.tag)return;
    const p=av.position.clone().add(new THREE.Vector3(0,3,0)).project(game.camera);
    av.userData.tag.style.left=((p.x*.5+.5)*$("gameViewport").clientWidth)+"px";
    av.userData.tag.style.top=((-p.y*.5+.5)*$("gameViewport").clientHeight)+"px";
    av.userData.tag.style.display=p.z>1?"none":"block";
  });
}
function respawn(){game.player.position.copy(game.spawn);game.velocityY=0;game.health=100}
function shoot(){
  if(!game.running||!game.socket)return;
  const rc=new THREE.Raycaster();const dir=new THREE.Vector3(0,0,-1).applyQuaternion(game.camera.quaternion);rc.set(game.camera.position,dir);
  const hits=rc.intersectObjects([...game.others.values()],true);if(!hits.length)return;
  let o=hits[0].object;while(o.parent&&!game.others.has(o))o=o.parent;
  if(game.others.has(o))game.socket.emit("shoot",{targetId:[...game.others.entries()].find(([,v])=>v===o)?.[0],damage:25});
}
function stopGame(){
  game.running=false;
  if(game.socket)game.socket.disconnect();
  $("gameOverlay").classList.add("hidden");
  $("gameViewport").innerHTML="";$("nicknameLayer").innerHTML="";
}
init();