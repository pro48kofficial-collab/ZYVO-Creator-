import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {OrbitControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";
import {TransformControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/TransformControls.js";
import {GLTFLoader} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const $=id=>document.getElementById(id);
const viewport=$("viewport");
let scene,camera,renderer,orbit,transform,grid,selected=null;
let objects=[];

function status(t){$("status").textContent=t}
function resize(){if(!renderer)return;camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight)}
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)}

function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xdfe8ef);
 camera=new THREE.PerspectiveCamera(60,1,.1,2000);camera.position.set(8,7,10);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(viewport.clientWidth,viewport.clientHeight);viewport.appendChild(renderer.domElement);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.set(0,1,0);
 transform=new TransformControls(camera,renderer.domElement);transform.setMode("translate");transform.addEventListener("dragging-changed",e=>orbit.enabled=!e.value);scene.add(transform);
 scene.add(new THREE.HemisphereLight(0xffffff,0x667788,2));
 const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(6,12,8);sun.castShadow=true;scene.add(sun);
 grid=new THREE.GridHelper(40,40,0x777777,0xbbbbbb);scene.add(grid);
 addPrimitive("box");
 window.addEventListener("resize",resize);
 renderer.domElement.addEventListener("pointerdown",pick);
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addPrimitive(b.dataset.add));
 document.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{transform.setMode(b.dataset.tool);status("Інструмент: "+b.dataset.tool)});
 $("gridToggle").onchange=e=>grid.visible=e.target.checked;
 $("snapToggle").onchange=e=>{const s=e.target.checked?.5:0;transform.setTranslationSnap(s||null);transform.setRotationSnap(s?THREE.MathUtils.degToRad(15):null);transform.setScaleSnap(s?.25:null)};
 $("deleteBtn").onclick=deleteSelected;$("duplicateBtn").onclick=duplicateSelected;
 $("textureBtn").onclick=()=>$("textureInput").click();$("textureInput").onchange=e=>e.target.files[0]&&applyTexture(e.target.files[0]);
 $("newBtn").onclick=newProject;$("saveBtn").onclick=exportZYVO;$("openBtn").onclick=()=>$("fileInput").click();$("fileInput").onchange=importFile;$("publishBtn").onclick=saveToServer;
 bindProperties();animate();
 setTimeout(()=>{$("loadingFill").style.width="100%";setTimeout(()=>$("loading").remove(),350)},250);
}

function addPrimitive(kind,silent=false){
 let g=kind==="sphere"?new THREE.SphereGeometry(1,32,20):kind==="cylinder"?new THREE.CylinderGeometry(1,1,2,32):kind==="plane"?new THREE.BoxGeometry(5,.2,5):new THREE.BoxGeometry(2,2,2);
 const m=new THREE.MeshStandardMaterial({color:0x7cff00,roughness:.65});
 const o=new THREE.Mesh(g,m);o.name=kind[0].toUpperCase()+kind.slice(1)+"_"+(objects.length+1);o.position.y=kind==="plane"?0:1;o.userData.zyvo={id:crypto.randomUUID(),kind,texture:null};o.castShadow=true;o.receiveShadow=true;scene.add(o);objects.push(o);select(o);list();if(!silent)status("Створено "+o.name)
}
function select(o){selected=o;transform.attach(o);$("noSelection").classList.add("hidden");$("propertyForm").classList.remove("hidden");refresh();list()}
function refresh(){if(!selected)return;$("objName").value=selected.name;$("objColor").value="#"+selected.material.color.getHexString();$("objOpacity").value=selected.material.opacity;["x","y","z"].forEach(a=>{$("p"+a).value=selected.position[a].toFixed(2);$("r"+a).value=THREE.MathUtils.radToDeg(selected.rotation[a]).toFixed(1);$("s"+a).value=selected.scale[a].toFixed(2)})}
function list(){ $("objectList").innerHTML="";objects.forEach(o=>{const d=document.createElement("div");d.className="object-item"+(o===selected?" selected":"");d.textContent="▣ "+o.name;d.onclick=()=>select(o);$("objectList").appendChild(d)});$("objectCount").textContent=objects.length+" об'єктів"}
function pick(e){if(e.button!==0)return;const r=renderer.domElement.getBoundingClientRect(),p=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);const rc=new THREE.Raycaster();rc.setFromCamera(p,camera);const h=rc.intersectObjects(objects,true);if(h.length){let o=h[0].object;while(o.parent&&!objects.includes(o))o=o.parent;if(objects.includes(o))select(o)}}
function bindProperties(){
 $("objName").oninput=e=>{if(selected){selected.name=e.target.value||"Object";list()}};
 $("objColor").oninput=e=>selected&&selected.material.color.set(e.target.value);
 $("objOpacity").oninput=e=>{if(selected){selected.material.opacity=+e.target.value;selected.material.transparent=selected.material.opacity<1}};
 ["x","y","z"].forEach(a=>{$("p"+a).onchange=e=>selected&&(selected.position[a]=+e.target.value||0);$("r"+a).onchange=e=>selected&&(selected.rotation[a]=THREE.MathUtils.degToRad(+e.target.value||0));$("s"+a).onchange=e=>selected&&(selected.scale[a]=Math.max(.01,+e.target.value||1))})
}
function deleteSelected(){if(!selected)return;scene.remove(selected);objects=objects.filter(o=>o!==selected);selected=null;transform.detach();$("propertyForm").classList.add("hidden");$("noSelection").classList.remove("hidden");list();status("Об'єкт видалено")}
function duplicateSelected(){if(!selected)return;const c=selected.clone();c.name=selected.name+"_Copy";c.position.x+=1;c.userData.zyvo={...(selected.userData.zyvo||{}),id:crypto.randomUUID()};scene.add(c);objects.push(c);select(c);list()}
function applyTexture(file){const r=new FileReader();r.onload=()=>new THREE.TextureLoader().load(r.result,t=>{t.colorSpace=THREE.SRGBColorSpace;selected.material.map=t;selected.material.needsUpdate=true;selected.userData.zyvo.texture=r.result;status("Текстуру застосовано")});r.readAsDataURL(file)}

function serialize(o){return{id:o.userData.zyvo?.id||crypto.randomUUID(),name:o.name,kind:o.userData.zyvo?.kind||"box",position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],scale:o.scale.toArray(),color:"#"+o.material.color.getHexString(),opacity:o.material.opacity,texture:o.userData.zyvo?.texture||null}}
function data(){return{zyvoVersion:1,format:"ZYVO",name:$("projectName").value.trim()||"MyWorld",createdBy:"ZYVO Creator 3D",objects:objects.map(serialize)}}
function download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"application/octet-stream"}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportZYVO(){const d=data();download((d.name||"MyWorld")+".zyvo",JSON.stringify(d,null,2));status("Експортовано .zyvo")}
function newProject(){objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();$("projectName").value="MyWorld";$("propertyForm").classList.add("hidden");$("noSelection").classList.remove("hidden");addPrimitive("box",true);status("Новий проєкт")}
async function saveToServer(){try{const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data())});const d=await r.json();if(!r.ok)throw Error(d.error);status("Збережено: "+d.file)}catch(e){console.error(e);status("Помилка збереження")}}

async function importFile(e){
 const f=e.target.files[0];if(!f)return;
 try{
  if(f.name.toLowerCase().endsWith(".zyvo"))loadZYVO(JSON.parse(await f.text()));
  else if(f.name.toLowerCase().endsWith(".glb"))await importGLB(f);
  else throw Error("Підтримуються .zyvo і .glb");
  status("Імпортовано "+f.name);
 }catch(err){console.error(err);alert("Не вдалося імпортувати файл.")}e.target.value=""
}
function geometry(kind){return kind==="sphere"?new THREE.SphereGeometry(1,32,20):kind==="cylinder"?new THREE.CylinderGeometry(1,1,2,32):kind==="plane"?new THREE.BoxGeometry(5,.2,5):new THREE.BoxGeometry(2,2,2)}
function loadZYVO(d){
 if(d.format!=="ZYVO")throw Error("Не ZYVO");
 objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();$("projectName").value=d.name||"ImportedWorld";
 (d.objects||[]).forEach(x=>{const o=new THREE.Mesh(geometry(x.kind),new THREE.MeshStandardMaterial({color:x.color||"#7cff00",opacity:x.opacity??1,transparent:(x.opacity??1)<1,roughness:.65}));o.name=x.name||"Object";o.position.fromArray(x.position||[0,0,0]);o.rotation.set(...(x.rotation||[0,0,0]));o.scale.fromArray(x.scale||[1,1,1]);o.userData.zyvo={id:x.id||crypto.randomUUID(),kind:x.kind||"box",texture:x.texture||null};if(x.texture)new THREE.TextureLoader().load(x.texture,t=>{t.colorSpace=THREE.SRGBColorSpace;o.material.map=t;o.material.needsUpdate=true});scene.add(o);objects.push(o)});list()
}
async function importGLB(file){
 const loader=new GLTFLoader(),buffer=await file.arrayBuffer();const gltf=await new Promise((res,rej)=>loader.parse(buffer,"",res,rej));
 objects.forEach(o=>scene.remove(o));objects=[];selected=null;transform.detach();const root=gltf.scene;root.name=file.name.replace(/\.glb$/i,"");root.userData.zyvo={id:crypto.randomUUID(),kind:"imported"};scene.add(root);objects.push(root);select(root);list()
}
init();