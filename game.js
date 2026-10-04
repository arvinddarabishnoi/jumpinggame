const C=document.getElementById('game'),X=C.getContext('2d',{alpha:false});
let W=innerWidth,H=innerHeight,DPR=1;function fit(){DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;C.width=W*DPR;C.height=H*DPR;C.style.width=W+'px';C.style.height=H+'px';X.setTransform(DPR,0,0,DPR,0,0)}addEventListener('resize',fit);fit();

const root='2d_car_game_assets_high_quality/';
const files={cars:'01_cars_vehicles.png',terrain:'03_terrain_road.png',bg:'04_background_environment.png',weather:'05_changing_world_weather.png'};
const imgs={},sprites={};
function load(k,f){return new Promise(r=>{const i=new Image();i.onload=()=>{imgs[k]=i;findSprites(i,k);r()};i.onerror=()=>r();i.src=root+f})}
function findSprites(im,k){try{const w=im.naturalWidth,h=im.naturalHeight,c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});c.width=w;c.height=h;g.drawImage(im,0,0);const d=g.getImageData(0,0,w,h).data,b=[d[0],d[1],d[2]],m=new Uint8Array(w*h),seen=new Uint8Array(w*h);let n=0;
for(let p=0;p<w*h;p++){const i=p*4,dr=d[i]-b[0],dg=d[i+1]-b[1],db=d[i+2]-b[2];if(d[i+3]>10&&Math.sqrt(dr*dr+dg*dg+db*db)>28){m[p]=1;n++}}
if(n<w*h*.004){sprites[k]=[];return}
const qx=new Int32Array(w*h),qy=new Int32Array(w*h),out=[];
for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){let s=yy*w+xx;if(!m[s]||seen[s])continue;let qh=0,qt=0,minX=xx,maxX=xx,minY=yy,maxY=yy,cnt=0;seen[s]=1;qx[qt]=xx;qy[qt++]=yy;
while(qh<qt){const x=qx[qh],y=qy[qh++];cnt++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]])if(nx>=0&&ny>=0&&nx<w&&ny<h){const z=ny*w+nx;if(m[z]&&!seen[z]){seen[z]=1;qx[qt]=nx;qy[qt++]=ny}}}
const bw=maxX-minX+1,bh=maxY-minY+1;if(bw>30&&bh>18&&bw*bh>400)out.push({x:minX,y:minY,w:bw,h:bh,a:bw*bh})}out.sort((a,b)=>b.a-a.a);sprites[k]=out.slice(0,24)}catch(e){sprites[k]=[]}}
Promise.all(Object.entries(files).map(([k,v])=>load(k,v)));

const KEY='gravity-run-v1';
const blank={coins:0,best:0,score:0,up:{engine:0,grip:0,suspension:0,fuel:0,nitro:0,gravity:0,armor:0,air:0},missions:{distance:0,flips:0,coins:0},sound:true};
let save=(()=>{try{return Object.assign(structuredClone(blank),JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return structuredClone(blank)}})();
function saveNow(){localStorage.setItem(KEY,JSON.stringify(save))}

const keys={l:0,r:0,u:0,d:0,n:0,g:0,w:0};
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='arrowright'||k==='d')keys.r=1;if(k==='arrowleft'||k==='a')keys.l=1;if(k==='arrowup'||k==='w')keys.u=1;if(k==='arrowdown'||k==='s')keys.d=1;if(k===' ')keys.n=1;if(k==='g')keys.g=1;if(k==='r')keys.w=1;if(k==='escape')pause()});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowright'||k==='d')keys.r=0;if(k==='arrowleft'||k==='a')keys.l=0;if(k==='arrowup'||k==='w')keys.u=0;if(k==='arrowdown'||k==='s')keys.d=0;if(k===' ')keys.n=0;if(k==='g')keys.g=0;if(k==='r')keys.w=0});
document.querySelectorAll('#touch button').forEach(b=>{const k=b.dataset.key,map={left:'l',right:'r',up:'u',down:'d',nitro:'n',gravity:'g',rewind:'w'};const f=e=>{e.preventDefault();keys[map[k]]=1},z=e=>{e.preventDefault();keys[map[k]]=0};b.onpointerdown=f;b.onpointerup=z;b.onpointercancel=z;b.onpointerleave=z});

const ui={menu:menu,over:document.getElementById('game-over'),garage:garage,missions:missions,settings:settings,pause:pause,touch:document.getElementById('touch'),hud:document.getElementById('hud')};
let state='menu',stopped=true,last=performance.now(),shake=0,toastT=0;

const car={x:160,y:330,vx:0,vy:0,a:0,va:0,ground:false,fuel:100,nitro:100,damage:0,gHold:0,gcd:0,stunt:0};
const world={cam:0,g:1,ge:100,dist:0,coins:0,score:0,combo:0,comboT:0,flips:0,missionCoins:0,terrain:[],obj:[],p:[],snap:[]};
const themes=[
{name:'GREEN HILLS',at:0,sky:['#80d9ff','#e8fbff'],top:'#82d19b',soil:'#2e7057'},
{name:'DESERT',at:1500,sky:['#efaa62','#ffe5b7'],top:'#e4b869',soil:'#9c673c'},
{name:'SNOW',at:3200,sky:['#87cfff','#f6fbff'],top:'#f0f7ff',soil:'#769ac0'},
{name:'STORM',at:5200,sky:['#3f4b67','#909ab0'],top:'#748092',soil:'#384255'},
{name:'VOLCANO',at:7600,sky:['#201729','#833c33'],top:'#553536',soil:'#1d1718'},
{name:'ALIEN',at:10400,sky:['#1d214b','#654c97'],top:'#58c9a9',soil:'#29395f'}];
function theme(){let t=themes[0];for(const x of themes)if(world.dist>=x.at)t=x;return t}
function rnd(n){return Math.random()*n}
function yn(i){return (Math.sin(i*12.9898)*43758.5453)%1}
function initTerrain(){world.terrain=[];let y=510;for(let i=0;i<70;i++){const x=-400+i*80;const target=475+Math.sin(i*.55)*52+Math.sin(i*.18)*70;y+=(target-y)*.33;world.terrain.push({x,y})}for(let i=0;i<28;i++)addChunk()}
function addChunk(){const t=world.terrain,last=t[t.length-1],base=t.length,diff=Math.min(1,world.dist/6500),len=5+Math.floor(Math.random()*6);let y=last.y;
for(let n=1;n<=len;n++){const x=last.x+n*80;const dy=(Math.random()-.5)*65*(.8+diff);y=Math.max(290,Math.min(610,y+dy));t.push({x,y})}
if(Math.random()<.08+diff*.08&&world.dist>800){const gap=120+Math.random()*100,anchor=t[t.length-1];t.push({x:anchor.x+gap,y:anchor.y-80});t.push({x:anchor.x+gap+80,y:anchor.y-80})}
const e=t[t.length-1];if(Math.random()<.45)world.obj.push({k:'coin',x:e.x+40,y:e.y-90-rnd(75)});if(Math.random()<.16)world.obj.push({k:'fuel',x:e.x+100,y:e.y-105-rnd(55)});if(Math.random()<.08)world.obj.push({k:'gem',x:e.x+160,y:e.y-130-rnd(60)})}
function groundY(x){const t=world.terrain;while(t.length>3&&x>t[1].x+100)t.shift();let i=0;while(i<t.length-1&&x>t[i+1].x)i++;const a=t[i],b=t[i+1]||a,u=Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x||1)));return a.y+(b.y-a.y)*u}
function slope(x){return Math.atan2(groundY(x+8)-groundY(x-8),16)}

function toast(s){const t=document.getElementById('toast');t.textContent=s;t.classList.add('toast-show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('toast-show'),1000)}
function screen(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));if(id)document.getElementById(id).classList.add('active')}
function start(){state='game';stopped=false;ui.hud.classList.remove('hidden');ui.touch.classList.remove('hidden');screen(null);Object.assign(world,{cam:0,g:1,ge:100,dist:0,coins:0,score:0,combo:0,comboT:0,flips:0,missionCoins:0,obj:[],p:[],snap:[]});Object.assign(car,{x:160,y:330,vx:0,vy:0,a:0,va:0,ground:false,fuel:100,nitro:100,damage:0,gHold:0,gcd:0,stunt:0});initTerrain();toast('D DRIVE  •  G GRAVITY FLIP')}
function finish(){state='over';stopped=true;ui.hud.classList.add('hidden');ui.touch.classList.add('hidden');save.best=Math.max(save.best,Math.floor(world.dist));save.coins+=world.coins;save.score=Math.max(save.score,Math.floor(world.score));save.missions.distance=Math.max(save.missions.distance,Math.floor(world.dist));save.missions.flips=Math.max(save.missions.flips,world.flips);save.missions.coins+=world.missionCoins;saveNow();document.getElementById('result-distance').textContent=Math.floor(world.dist)+' m';document.getElementById('result-coins').textContent=world.coins;document.getElementById('result-score').textContent=Math.floor(world.score);document.getElementById('result-best').textContent=save.best+' m';screen('game-over')}
function pause(){if(state!=='game')return;stopped=!stopped;screen(stopped?'pause':null)}
function hurt(){shake=Math.max(shake,8);spawn(car.x,car.y,'impact',14);car.damage+=.18;if(car.damage>1+save.up.armor*.2){toast('WRECKED');finish()}}

function update(dt){
if(state!=='game'||stopped)return;
while(world.terrain.at(-1).x<car.x+1500)addChunk();
const t=theme(),eng=300*(1+save.up.engine*.09),grip=.985+save.up.grip*.006;
car.vx+=(keys.r?eng:0)*dt-(keys.l?eng*.65:0)*dt;if(keys.n&&car.nitro>0&&car.vx>20){car.vx+=500*dt;car.nitro-=32*dt;spawn(car.x,car.y,'speed',3)}else car.nitro=Math.min(100,car.nitro+6*dt);
car.vx*=Math.pow(grip,dt*60);car.vx=Math.max(-90,Math.min(650+save.up.engine*22,car.vx));
if(car.gcd>0)car.gcd-=dt;
if(keys.g&&!car.gHold&&car.gcd<=0&&world.ge>=35){world.g*=-1;world.ge-=35;car.gcd=.9;car.gHold=1;shake=9;spawn(car.x,car.y,'gravity',20);toast(world.g>0?'GRAVITY NORMAL':'GRAVITY REVERSED')}
if(!keys.g)car.gHold=0;world.ge=Math.min(100,world.ge+(8+save.up.gravity*1.2)*dt);
if(car.ground){const s=slope(car.x);car.a+=(s+Math.PI/2-car.a)*Math.min(1,dt*9);car.va*=Math.pow(.72,dt*60);if(keys.u)car.va-=4*dt;if(keys.d)car.va+=4*dt}else{if(keys.u)car.va-=4.5*dt;if(keys.d)car.va+=4.5*dt;car.va*=Math.pow(.95,dt*60)}
car.vy+=1680*world.g*dt;car.vy*=Math.pow(.985,dt*60);car.x+=car.vx*dt;car.y+=car.vy*dt;car.a+=car.va*dt;car.stunt+=car.va*dt;car.fuel=Math.max(0,car.fuel-((keys.r?2:0.3)+Math.max(0,car.vx)*.0018)*dt);
const sy=groundY(car.x),target=world.g>0?sy-49:sy+49;
if(world.g>0&&car.y>=target){if(!car.ground&&car.vy>330)land(car.vy);car.y=target;car.vy=0;car.ground=1}else if(world.g<0&&car.y<=target){if(!car.ground&&Math.abs(car.vy)>330)land(Math.abs(car.vy));car.y=target;car.vy=0;car.ground=1}else car.ground=0;
if(car.ground){if(Math.abs(car.stunt)>Math.PI*2){const turns=Math.floor(Math.abs(car.stunt)/(Math.PI*2));world.flips+=turns;world.combo=Math.min(8,world.combo+turns);world.comboT=3;world.score+=turns*120*(1+world.combo*.2);toast((car.stunt>0?'BACK':'FRONT')+' FLIP x'+turns)}car.stunt=0;car.damage=Math.max(0,car.damage-dt*.025)}
if(car.fuel<=0&&Math.abs(car.vx)<20){toast('OUT OF FUEL');finish();return}
world.dist=Math.max(0,(car.x-160)/5);world.cam+=(car.x-260-world.cam)*Math.min(1,dt*4);world.ge=Math.max(0,Math.min(100,world.ge));collect();snap(dt);particles(dt);world.comboT=Math.max(0,world.comboT-dt);if(world.comboT<=0)world.combo=0;drawHud();
}

function land(v){shake=Math.max(shake,Math.min(10,v/90));spawn(car.x,car.y,'land',12);car.damage=Math.max(0,car.damage-(save.up.suspension*.01))}
function collect(){for(const o of world.obj){if(o.taken)continue;const dx=o.x-car.x,dy=o.y-car.y;if(dx*dx+dy*dy<70*70){o.taken=1;if(o.k==='coin'){world.coins++;world.missionCoins++;world.score+=25}else if(o.k==='fuel'){car.fuel=Math.min(100+save.up.fuel*12,car.fuel+32);toast('FUEL +32')}else{world.score+=250;toast('RARE GEM +250')}spawn(o.x,o.y,o.k,8)}}world.obj=world.obj.filter(o=>!o.taken&&o.x>car.x-900)}
function snap(dt){world.snap.push({x:car.x,y:car.y,vx:car.vx,vy:car.vy,a:car.a,va:car.va,f:car.fuel,n:car.nitro,g:world.g,ge:world.ge,d:world.dist,c:world.coins,s:world.score});if(world.snap.length>150)world.snap.shift();if(keys.w&&world.snap.length>5){for(let i=0;i<3;i++)world.snap.pop();const s=world.snap.at(-1);if(s)Object.assign(car,{x:s.x,y:s.y,vx:s.vx,vy:s.vy,a:s.a,va:s.va,fuel:s.f,nitro:s.n}),Object.assign(world,{g:s.g,ge:s.ge,dist:s.d,coins:s.c,score:s.s})}}

function spawn(x,y,k,n){for(let i=0;i<n&&world.p.length<280;i++){const a=Math.random()*6.283,s=20+Math.random()*150;world.p.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.2+Math.random()*.65,k})}}
function particles(dt){for(const p of world.p){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.vx*=.985}world.p=world.p.filter(p=>p.life>0)}

function bg(){const t=theme(),g=X.createLinearGradient(0,0,0,H);g.addColorStop(0,t.sky[0]);g.addColorStop(1,t.sky[1]);X.fillStyle=g;X.fillRect(0,0,W,H);X.save();X.translate(-world.cam*.08,0);for(let i=-1;i<10;i++){X.fillStyle='rgba(25,38,70,.2)';X.beginPath();X.moveTo(i*220,470);X.lineTo(i*220+110,290+(i%3)*35);X.lineTo(i*220+220,470);X.fill()}X.restore();X.save();X.translate(-world.cam*.2,0);for(let i=-1;i<14;i++){X.fillStyle='rgba(10,20,32,.18)';X.beginPath();X.moveTo(i*150,520);X.lineTo(i*150+75,350+(i%4)*20);X.lineTo(i*150+150,520);X.fill()}X.restore()}
function terrain(){const t=theme(),a=world.terrain[0];X.beginPath();X.moveTo(a.x-world.cam,-20);for(const p of world.terrain)if(p.x>world.cam-200&&p.x<world.cam+W+300)X.lineTo(p.x-world.cam,p.y);const e=world.terrain.at(-1);X.lineTo(e.x-world.cam,H+80);X.lineTo(a.x-world.cam,H+80);X.closePath();X.fillStyle=t.soil;X.fill();X.beginPath();let first=1;for(const p of world.terrain){if(p.x<world.cam-200||p.x>world.cam+W+300)continue;if(first){X.moveTo(p.x-world.cam,p.y);first=0}else X.lineTo(p.x-world.cam,p.y)}X.strokeStyle=t.top;X.lineWidth=10;X.stroke()}
function objects(){for(const o of world.obj){const x=o.x-world.cam,y=o.y;if(x<-50||x>W+50)continue;X.save();X.translate(x,y);if(o.k==='coin'){X.fillStyle='#ffd65e';X.shadowBlur=16;X.shadowColor='#ffd65e';X.beginPath();X.ellipse(0,0,10,15,0,0,6.283);X.fill();X.shadowBlur=0}else if(o.k==='fuel'){X.fillStyle='#5cf39e';X.fillRect(-9,-16,18,32);X.fillStyle='#123523';X.fillRect(-5,-22,10,7)}else{X.fillStyle='#b18aff';X.rotate(.785);X.fillRect(-11,-11,22,22)}X.restore()}}
function carDraw(){const x=car.x-world.cam,y=car.y;X.save();X.translate(x,y);X.rotate(car.a-Math.PI/2);const s=(sprites.cars||[]).find(q=>q.w>q.h*1.25)||sprites.cars?.[0];if(s&&imgs.cars)X.drawImage(imgs.cars,s.x,s.y,s.w,s.h,-58,-35,116,70);else{const g=X.createLinearGradient(-55,-25,55,30);g.addColorStop(0,'#64e9ff');g.addColorStop(1,'#776dff');X.fillStyle=g;X.beginPath();X.roundRect(-55,-24,110,44,14);X.fill();X.fillStyle='#11192a';X.beginPath();X.moveTo(-34,-24);X.lineTo(-8,-45);X.lineTo(28,-39);X.lineTo(43,-24);X.fill()}for(const wx of [-38,38]){X.save();X.translate(wx,23);X.rotate(car.x*.03);X.fillStyle='#10131a';X.beginPath();X.arc(0,0,18,0,6.283);X.fill();X.fillStyle='#aeb8ca';X.beginPath();X.arc(0,0,7,0,6.283);X.fill();X.restore()}X.restore()}
function particlesDraw(){for(const p of world.p){const x=p.x-world.cam;if(x<-20||x>W+20)continue;X.globalAlpha=Math.max(0,p.life);X.fillStyle=p.k==='gravity'?'#c3a7ff':p.k==='coin'?'#ffd65e':p.k==='speed'?'#9defff':'#fff';X.beginPath();X.arc(x,p.y,p.k==='gravity'?4:2.5,0,6.283);X.fill()}X.globalAlpha=1}
function draw(){const t=theme();X.save();if(shake>0)X.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);bg();terrain();objects();particlesDraw();carDraw();X.restore();if(state==='game'&&world.g<0){X.fillStyle='rgba(155,123,255,.05)';X.fillRect(0,0,W,H)}}
function drawHud(){document.getElementById('distance').textContent=Math.floor(world.dist)+' m';document.getElementById('coins').textContent=world.coins;document.getElementById('best').textContent=save.best+' m';document.getElementById('fuel-bar').style.transform='scaleX('+Math.max(0,car.fuel/100)+')';document.getElementById('nitro-bar').style.transform='scaleX('+Math.max(0,car.nitro/100)+')';document.getElementById('gravity-bar').style.transform='scaleX('+Math.max(0,world.ge/100)+')';const c=document.getElementById('combo');c.textContent=world.combo?world.combo+'x COMBO':'';c.classList.toggle('show',world.combo>0);document.getElementById('mission-hud').textContent=theme().name+'  •  '+Math.floor(world.dist)+' m'}
function garage(){document.getElementById('garage-coins').textContent=save.coins;const names=[['engine','ENGINE'],['grip','GRIP'],['suspension','SUSPENSION'],['fuel','FUEL'],['nitro','NITRO'],['gravity','GRAVITY'],['armor','ARMOR'],['air','AIR CONTROL']],box=document.getElementById('upgrades');box.innerHTML='';for(const [k,n] of names){const lv=save.up[k]||0,c=250+lv*300,e=document.createElement('div');e.className='upgrade';e.innerHTML='<div><b>'+n+'</b><br><small>LEVEL '+lv+'/5</small></div><button data-k="'+k+'" '+(lv>=5||save.coins<c?'disabled':'')+'>'+(lv>=5?'MAX':'◈ '+c)+'</button>';box.appendChild(e)}box.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k,lv=save.up[k],c=250+lv*300;if(lv<5&&save.coins>=c){save.coins-=c;save.up[k]++;saveNow();garage();toast(k.toUpperCase()+' +1')}});const g=document.getElementById('garage-car').getContext('2d');g.clearRect(0,0,480,300);g.save();g.translate(240,145);const s=(sprites.cars||[]).find(q=>q.w>q.h*1.25)||sprites.cars?.[0];if(s&&imgs.cars)g.drawImage(imgs.cars,s.x,s.y,s.w,s.h,-140,-85,280,170);else{g.fillStyle='#67e8ff';g.beginPath();g.roundRect(-140,-45,280,80,22);g.fill()}g.restore()}
function missions(){const d=[['distance','Travel 2500 m',2500],['flips','Perform 6 flips',6],['coins','Collect 120 coins',120]],box=document.getElementById('mission-list');box.innerHTML='';for(const [k,t,z] of d){const p=save.missions[k]||0,e=document.createElement('div');e.className='mission '+(p>=z?'done':'');e.innerHTML='<span class="dot"></span><span>'+t+'<br><small>'+Math.min(p,z)+' / '+z+'</small></span><b>'+(p>=z?'DONE':'REWARD')+'</b>';box.appendChild(e)}}
function settings(){document.querySelector('#reduced-motion b').textContent='OFF';document.querySelector('#sound-toggle b').textContent=save.sound?'ON':'OFF'}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='play'||a==='restart')start();else if(a==='resume'){stopped=false;screen(null)}else if(a==='menu'){state='menu';stopped=true;ui.hud.classList.add('hidden');ui.touch.classList.add('hidden');screen('menu');initMenu()}else if(a==='garage'){state='garage';garage();screen('garage')}else if(a==='missions'){state='missions';missions();screen('missions')}else if(a==='settings'){state='settings';settings();screen('settings')}});
document.getElementById('pause-btn').onclick=pause;document.getElementById('reset-save').onclick=()=>{if(confirm('Reset all progress?')){save=structuredClone(blank);saveNow();initMenu();toast('SAVE RESET')}};document.getElementById('sound-toggle').onclick=()=>{save.sound=!save.sound;saveNow();settings()};

function initMenu(){document.getElementById('menu-best').textContent=save.best+' m';garage();missions();settings()}
function loop(now){const dt=Math.min(.033,(now-last)/1000||.016);last=now;shake=Math.max(0,shake-dt*24);update(dt);draw();requestAnimationFrame(loop)}
initMenu();screen('menu');requestAnimationFrame(loop);