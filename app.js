(function(){
'use strict';
var NS='http://www.w3.org/2000/svg';
function el(name,attrs,parent,text){var e=document.createElementNS(NS,name);for(var k in attrs)e.setAttribute(k,attrs[k]);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;}
function $(id){return document.getElementById(id);}
function fmt(n){return (Math.round(n*10)/10).toFixed(1);}

/* ---------- Workflow stepper ---------- */
var STEPS=[
 {t:'Input',tech:'React, TypeScript, Axios',what:'The user enters depots, customers, package weights, deadlines and vehicles in the dashboard, then clicks Optimize. The browser sends everything to the backend as JSON.',ex:'2 depots, 6 customers, 3 vehicles of different sizes.',why:'One place to describe the whole delivery day.'},
 {t:'Validate',tech:'FastAPI, Pydantic',what:'The backend checks that every field has the right type and sensible values before any algorithm runs.',ex:'A package with a negative weight is rejected with a clear error.',why:'Bad data is caught early, so algorithms never work on nonsense.'},
 {t:'Build graph',tech:'Graph module, adjacency list',what:'Depots, customers and junctions become nodes. Roads become edges with a weight (distance or time).',ex:'Edge Depot to A = 5 km.',why:'Algorithms need a map they can search. Adjacency lists suit sparse road networks.',demo:'#demo-dijkstra'},
 {t:'Predict travel time',tech:'scikit-learn models',what:'For each road, an ML model predicts travel time from distance, speed limit, hour, weekday, weather and congestion. The prediction replaces the edge weight.',ex:'A road that takes 12 min normally is predicted at 25 min at peak.',why:'Real roads change through the day. Predictions keep the graph realistic.',demo:'#demo-traffic'},
 {t:'Shortest paths',tech:'Dijkstra, A*, Floyd-Warshall',what:'Path algorithms find the cheapest way between important places. The results are stored in a distance and time matrix.',ex:'Depot to G is 16 km via the best roads.',why:'Later steps reuse the matrix instead of searching again for every comparison.',demo:'#demo-dijkstra'},
 {t:'Assign and order',tech:'Knapsack DP, Bitmask DP, Branch and Bound, Clarke-Wright, 2-Opt',what:'The optimizer decides which packages go in which vehicle and in which order each vehicle visits its stops. Exact methods handle small cases; heuristics handle large ones.',ex:'Van 1 takes customers 1, 3, 4 in that order.',why:'This is the core decision that saves cost and time.',demo:'#demo-tsp'},
 {t:'Validate the plan',tech:'Constraint checks, cost model',what:'Every plan is checked against vehicle capacity, time windows, driver limits and EV battery. Plans that break a rule are rejected or penalized, then the rest are scored on cost, time and emissions.',ex:'A 120 kg package cannot go in a 100 kg van.',why:'A cheap plan that cannot be driven is useless.',demo:'#demo-capacity'},
 {t:'Show results',tech:'React, Leaflet',what:'Routes, vehicle assignments, ETAs and metrics appear on the map. Visualizers show how the DP and Branch and Bound worked, and the what-if simulator re-plans after a road closure.',ex:'Closing a road updates the routes and shows the before and after.',why:'Results must be understandable and explainable, not a black box.'}
];
var cur=0;
var btns=$('stepButtons');
STEPS.forEach(function(s,i){var b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-label','Step '+(i+1)+': '+s.t);b.textContent=i+1;b.addEventListener('click',function(){go(i);});btns.appendChild(b);});
function go(i){
  cur=Math.max(0,Math.min(STEPS.length-1,i));
  var s=STEPS[cur];
  Array.prototype.forEach.call(btns.children,function(b,j){b.setAttribute('aria-selected',j===cur);b.className=j<cur?'done':'';});
  var pipe=STEPS.map(function(x,j){return '<div class="pipe'+(j===cur?' on':'')+'"><b>'+(j+1)+'</b>'+x.t+'</div>';}).join('');
  $('stepBody').innerHTML='<div><h3>'+(cur+1)+'. '+s.t+'</h3><dl><dt>What happens</dt><dd>'+s.what+'</dd><dt>Example</dt><dd>'+s.ex+'</dd><dt>Why it matters</dt><dd>'+s.why+'</dd><dt>Technology</dt><dd>'+s.tech+'</dd></dl>'+(s.demo?'<a class="try" href="'+s.demo+'">Try this step →</a>':'')+'</div><div class="step-vis" aria-hidden="true">'+pipe+'</div>';
  $('stepCount').textContent='Step '+(cur+1)+' of '+STEPS.length;
  $('prevStep').disabled=cur===0;$('nextStep').disabled=cur===STEPS.length-1;
}
$('prevStep').addEventListener('click',function(){go(cur-1);});
$('nextStep').addEventListener('click',function(){go(cur+1);});
go(0);

/* ---------- Dijkstra demo ---------- */
var NODES={D:{x:60,y:170,n:'D'},A:{x:190,y:60,n:'A'},B:{x:190,y:280,n:'B'},C:{x:330,y:170,n:'C'},E:{x:470,y:60,n:'E'},F:{x:470,y:280,n:'F'},G:{x:555,y:170,n:'G'}};
var EDGES=[['D','A',5],['D','B',4],['A','C',4],['B','C',6],['A','E',7],['C','E',3],['C','F',5],['B','F',9],['E','G',4],['F','G',3],['C','G',8]];
var ADJ={};Object.keys(NODES).forEach(function(k){ADJ[k]=[];});
EDGES.forEach(function(e){ADJ[e[0]].push([e[1],e[2]]);ADJ[e[1]].push([e[0],e[2]]);});
var dFrom=$('dFrom'),dTo=$('dTo');
Object.keys(NODES).forEach(function(k){[dFrom,dTo].forEach(function(s){var o=document.createElement('option');o.value=k;o.textContent=k==='D'?'Depot (D)':NODES[k].n;s.appendChild(o);});});
dFrom.value='D';dTo.value='G';
var dSnaps=[],dIdx=0,dTimer=null;
function dBuild(){
  var src=dFrom.value,dst=dTo.value;var dist={},prev={},vis={};
  Object.keys(NODES).forEach(function(k){dist[k]=Infinity;});dist[src]=0;
  dSnaps=[{cur:null,dist:Object.assign({},dist),vis:Object.assign({},vis),msg:'Start: '+(src==='D'?'the depot (D)':NODES[src].n)+' has distance 0 km. Everything else is unknown (∞). Press Step.'}];
  while(true){
    var best=null;Object.keys(dist).forEach(function(k){if(!vis[k]&&dist[k]<Infinity&&(best===null||dist[k]<dist[best]))best=k;});
    if(best===null)break;
    vis[best]=true;var notes=[];
    ADJ[best].forEach(function(p){var n=p[0],w=p[1];if(vis[n])return;var nd=dist[best]+w;
      if(nd<dist[n]){notes.push(NODES[n].n+': '+dist[best]+' + '+w+' = '+nd+(dist[n]===Infinity?' (first time reached)':' (shorter than '+dist[n]+')')+' → update');dist[n]=nd;prev[n]=best;}
      else notes.push(NODES[n].n+': '+nd+' is not shorter than '+dist[n]+' → keep');});
    var msg='Visit '+NODES[best].n+' (best distance '+dist[best]+' km). '+(notes.length?'Check neighbours — '+notes.join('; ')+'.':'No unvisited neighbours.');
    var snap={cur:best,dist:Object.assign({},dist),vis:Object.assign({},vis),msg:msg};
    if(best===dst){var path=[dst];while(path[0]!==src)path.unshift(prev[path[0]]);snap.path=path;snap.msg=msg+' Destination reached! Shortest path: '+path.map(function(k){return NODES[k].n;}).join(' → ')+' = '+dist[dst]+' km.';dSnaps.push(snap);break;}
    dSnaps.push(snap);
  }
  dIdx=0;dDraw();
}
var dSvg=$('dSvg');
function dDraw(){
  var s=dSnaps[dIdx];dSvg.innerHTML='';
  var pathEdge={};if(s.path){for(var i=0;i<s.path.length-1;i++){pathEdge[s.path[i]+s.path[i+1]]=1;pathEdge[s.path[i+1]+s.path[i]]=1;}}
  EDGES.forEach(function(e){var a=NODES[e[0]],b=NODES[e[1]];var on=pathEdge[e[0]+e[1]];
    el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:on?'#36916E':'#9AA8C2','stroke-width':on?7:3,'stroke-linecap':'round'},dSvg);
    var mx=(a.x+b.x)/2,my=(a.y+b.y)/2;el('rect',{x:mx-14,y:my-11,width:28,height:22,rx:6,fill:'#fff',stroke:'#DCE4F0'},dSvg);
    el('text',{x:mx,y:my+5,'text-anchor':'middle','font-size':14,'font-weight':700,fill:'#4F5F7D'},dSvg,e[2]);});
  Object.keys(NODES).forEach(function(k){var n=NODES[k];var fill='#E3EAF5',stroke='#9AA8C2',tc='#0F1B33';
    if(s.vis[k]){fill='#1FA3AB';stroke='#1FA3AB';tc='#06242A';}else if(s.dist[k]<Infinity){fill='#fff';stroke='#2C69B0';}
    if(s.cur===k){fill='#E08A2E';stroke='#E08A2E';tc='#fff';}
    el('circle',{cx:n.x,cy:n.y,r:22,fill:fill,stroke:stroke,'stroke-width':4},dSvg);
    el('text',{x:n.x,y:n.y+6,'text-anchor':'middle','font-size':17,'font-weight':700,fill:tc},dSvg,n.n);
    el('text',{x:n.x,y:n.y+44,'text-anchor':'middle','font-size':15,'font-weight':700,fill:'#2C69B0'},dSvg,s.dist[k]===Infinity?'∞':s.dist[k]);});
  $('dLog').textContent=s.msg;
  $('dBack').disabled=dIdx===0;$('dStep').disabled=dIdx===dSnaps.length-1;
}
function dStop(){if(dTimer){clearInterval(dTimer);dTimer=null;$('dPlay').textContent='Auto-play';}}
$('dStep').addEventListener('click',function(){if(dIdx<dSnaps.length-1){dIdx++;dDraw();}});
$('dBack').addEventListener('click',function(){dStop();if(dIdx>0){dIdx--;dDraw();}});
$('dReset').addEventListener('click',function(){dStop();dIdx=0;dDraw();});
$('dPlay').addEventListener('click',function(){if(dTimer){dStop();return;}if(dIdx>=dSnaps.length-1){dIdx=0;dDraw();}$('dPlay').textContent='Pause';dTimer=setInterval(function(){if(dIdx<dSnaps.length-1){dIdx++;dDraw();}else dStop();},1400);});
[dFrom,dTo].forEach(function(s){s.addEventListener('change',function(){dStop();dBuild();});});
dBuild();

/* ---------- TSP demo ---------- */
var tN=$('tN');var pts=[];
function rnd(a,b){return a+Math.random()*(b-a);}
function gen(n){var a=[{x:200,y:130}],tries=0;
  while(a.length<n+1&&tries<500){tries++;var p={x:rnd(30,370),y:rnd(25,235)};var ok=a.every(function(q){return Math.hypot(p.x-q.x,p.y-q.y)>45;});if(ok)a.push(p);}return a;}
function newCity(){var n=+tN.value;
  // prefer a city where the simple rule is visibly worse, so the lesson is clear
  for(var t=0;t<60;t++){pts=gen(n);var d=dmat();if(greedy(d).cost>heldKarp(d).cost*1.04)break;}
  tSolve();}
function dmat(){var n=pts.length,d=[];for(var i=0;i<n;i++){d[i]=[];for(var j=0;j<n;j++)d[i][j]=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y)/20;}return d;}
function greedy(d){var n=d.length,left={},r=[0],c=0,tot=0;for(var i=1;i<n;i++)left[i]=1;
  while(Object.keys(left).length){var b=null;Object.keys(left).forEach(function(k){if(b===null||d[c][k]<d[c][b])b=k;});b=+b;tot+=d[c][b];r.push(b);delete left[b];c=b;}
  tot+=d[c][0];r.push(0);return {route:r,cost:tot};}
function heldKarp(d){var n=d.length-1,full=(1<<n)-1,INF=1e18;var dp=[],par=[];
  for(var m=0;m<=full;m++){dp[m]=[];par[m]=[];for(var j=0;j<n;j++){dp[m][j]=INF;par[m][j]=-1;}}
  for(var j=0;j<n;j++)dp[1<<j][j]=d[0][j+1];
  for(var m2=1;m2<=full;m2++)for(var u=0;u<n;u++){if(!(m2&(1<<u))||dp[m2][u]>=INF)continue;
    for(var v=0;v<n;v++){if(m2&(1<<v))continue;var nm=m2|(1<<v),c=dp[m2][u]+d[u+1][v+1];if(c<dp[nm][v]){dp[nm][v]=c;par[nm][v]=u;}}}
  var best=INF,last=-1;for(var e=0;e<n;e++){var c2=dp[full][e]+d[e+1][0];if(c2<best){best=c2;last=e;}}
  var order=[],m3=full,x=last;while(x!==-1){order.unshift(x+1);var px=par[m3][x];m3^=(1<<x);x=px;}
  return {route:[0].concat(order,[0]),cost:best};}
function brute(d){var n=d.length-1,best=Infinity;var idx=[];for(var i=1;i<=n;i++)idx.push(i);
  (function perm(a,k){if(k===a.length){var c=d[0][a[0]];for(var i=0;i<a.length-1;i++)c+=d[a[i]][a[i+1]];c+=d[a[a.length-1]][0];if(c<best)best=c;return;}
    for(var i=k;i<a.length;i++){var t=a[k];a[k]=a[i];a[i]=t;perm(a,k+1);t=a[k];a[k]=a[i];a[i]=t;}})(idx,0);return best;}
function drawRoute(svg,route,color){svg.innerHTML='';
  var pl=route.map(function(i){return pts[i].x+','+pts[i].y;}).join(' ');
  el('polyline',{points:pl,fill:'none',stroke:color,'stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'},svg);
  route.slice(0,-1).forEach(function(i,k){if(k===route.length-2)return;var a=pts[route[k]],b=pts[route[k+1]];var mx=(a.x+b.x)/2,my=(a.y+b.y)/2,ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;el('path',{d:'M-6,-5 L6,0 L-6,5 Z',fill:color,transform:'translate('+mx+','+my+') rotate('+ang+')'},svg);});
  pts.forEach(function(p,i){if(i===0){el('rect',{x:p.x-14,y:p.y-14,width:28,height:28,rx:6,fill:'#E08A2E'},svg);el('text',{x:p.x,y:p.y+5,'text-anchor':'middle','font-size':14,'font-weight':700,fill:'#fff'},svg,'D');}
    else{el('circle',{cx:p.x,cy:p.y,r:13,fill:'#fff',stroke:color,'stroke-width':3},svg);el('text',{x:p.x,y:p.y+5,'text-anchor':'middle','font-size':14,'font-weight':700,fill:'#0F1B33'},svg,i);}});}
function bits(m,n){var s='';for(var i=n-1;i>=0;i--)s+=(m&(1<<i))?'1':'0';return s;}
function tSolve(){var d=dmat(),n=pts.length-1;
  var g=greedy(d),o=heldKarp(d),bf=brute(d);
  drawRoute($('tGreedy'),g.route,'#E08A2E');drawRoute($('tOpt'),o.route,'#1FA3AB');
  $('tGreedyCap').textContent='Nearest-neighbour rule: '+fmt(g.cost)+' km';
  $('tOptCap').textContent='Optimal (bitmask DP): '+fmt(o.cost)+' km';
  var save=(g.cost-o.cost)/g.cost*100;
  $('tResult').textContent=(save<0.05?'The simple rule happened to be optimal here. Try another random city. ':'The exact method saves '+fmt(g.cost-o.cost)+' km ('+fmt(save)+'%). ')+'Brute-force check of all '+factorial(n)+' orders: '+(Math.abs(bf-o.cost)<1e-6?'✓ same minimum cost.':'✗ mismatch!');
  var box=$('tMasks');box.innerHTML='';var m=0;
  o.route.slice(1,-1).forEach(function(c,k){m|=1<<(c-1);var div=document.createElement('div');div.className='mask';div.innerHTML='Stop '+(k+1)+': customer '+c+'<br><code>'+bits(m,n)+'</code>';box.appendChild(div);});
}
function factorial(n){var r=1;for(var i=2;i<=n;i++)r*=i;return r;}
tN.addEventListener('input',function(){$('tNOut').textContent=tN.value;newCity();});
$('tNew').addEventListener('click',newCity);
newCity();

/* ---------- Capacity demo ---------- */
var VEH=[{n:'Bike (20 kg, 0.08 m³)',w:20,v:0.08},{n:'Van (500 kg, 3 m³)',w:500,v:3},{n:'Truck (2000 kg, 15 m³)',w:2000,v:15}];
var PK=[{n:'Documents',w:2,v:0.01},{n:'Laptop box',w:8,v:0.05},{n:'Bulky foam pack',w:6,v:0.4},{n:'Water cans',w:60,v:0.12},{n:'Refrigerator',w:70,v:0.8},{n:'Sofa',w:90,v:1.6},{n:'Machine part',w:350,v:0.5}];
var cVeh=$('cVeh');VEH.forEach(function(v,i){var o=document.createElement('option');o.value=i;o.textContent=v.n;cVeh.appendChild(o);});cVeh.value=1;
var packs=$('cPacks');
PK.forEach(function(p,i){var l=document.createElement('label');l.innerHTML='<input type="checkbox" data-i="'+i+'"> '+p.n+'<small>'+p.w+' kg · '+p.v+' m³</small>';packs.appendChild(l);});
function cUpdate(){var v=VEH[+cVeh.value],w=0,vol=0;
  Array.prototype.forEach.call(packs.querySelectorAll('input'),function(c){if(c.checked){w+=PK[+c.dataset.i].w;vol+=PK[+c.dataset.i].v;}});
  vol=Math.round(vol*100)/100;
  function bar(id,val,cap){var b=$(id);b.style.width=Math.min(100,val/cap*100)+'%';b.className=val>cap?'over':'';}
  bar('cWBar',w,v.w);bar('cVBar',vol,v.v);
  $('cWText').textContent=w+' / '+v.w+' kg';$('cVText').textContent=vol+' / '+v.v+' m³';
  var vd=$('cVerdict');var msgs=[];if(w>v.w)msgs.push('over weight by '+(w-v.w)+' kg');if(vol>v.v)msgs.push('over volume by '+fmt(vol-v.v)+' m³');
  if(msgs.length){vd.className='verdict bad';vd.textContent='Rejected: '+msgs.join(' and ')+'. Remove a package or use a bigger vehicle.';}
  else{vd.className='verdict';vd.textContent=(w===0?'Empty load. Tick some packages.':'Feasible: this load fits the vehicle.');}}
cVeh.addEventListener('change',cUpdate);packs.addEventListener('change',cUpdate);cUpdate();

/* ---------- Traffic demo ---------- */
function gauss(h,mu,s){var x=(h-mu)/s;return Math.exp(-x*x);}
function cong(h){return 1+1.2*gauss(h,9,1.6)+1.4*gauss(h,18,1.8);}
function hLabel(h){var a=h<12?'AM':'PM',x=h%12===0?12:h%12;return x+':00 '+a;}
function hUpdate(){var h=+$('hHour').value,c=cong(h);
  var ta=5/40*60*c,tb=8/50*60*(1+0.3*(c-1));
  $('hOut').textContent=hLabel(h);
  var mx=Math.max(ta,tb,25);
  [['roadA',ta],['roadB',tb]].forEach(function(r){var e=$(r[0]);e.querySelector('.mins').textContent=fmt(r[1])+' min';e.querySelector('.bar i').style.width=(r[1]/mx*100)+'%';});
  var a=ta<=tb;$('roadA').className='road'+(a?' best':'');$('roadB').className='road'+(a?'':' best');
  $('hResult').textContent='Chosen: Road '+(a?'A':'B')+' ('+fmt(a?ta:tb)+' min). '+(c>1.6?'Rush hour makes the short road slow, so the longer road wins.':'Traffic is light, so the shorter road wins.');}
$('hHour').addEventListener('input',hUpdate);hUpdate();
})();
