// Proposal graphics, extracted from The Report: dot grids, clocks, coverage rings, year strip, folios, contents.
var NS='http://www.w3.org/2000/svg';
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e}
// dot grids
document.querySelectorAll('.dots').forEach(function(g){var on=+g.dataset.on;for(var i=0;i<100;i++){var d=document.createElement('i');if(i<on)d.className='on';g.appendChild(d)}});
// analog clocks
document.querySelectorAll('svg.clock').forEach(function(s){
  var t=s.dataset.t.split(':'),h=+t[0]%12,m=+t[1];s.setAttribute('viewBox','0 0 100 100');
  s.appendChild(el('circle',{cx:50,cy:50,r:46,fill:'none',stroke:'rgba(247,241,230,.35)','stroke-width':2}));
  for(var i=0;i<12;i++){var a=i*Math.PI/6,r1=i%3?38:34;s.appendChild(el('line',{x1:50+Math.sin(a)*r1,y1:50-Math.cos(a)*r1,x2:50+Math.sin(a)*42,y2:50-Math.cos(a)*42,stroke:'rgba(247,241,230,.5)','stroke-width':i%3?1.5:3,'stroke-linecap':'round'}))}
  var ha=(h+m/60)*Math.PI/6,ma=m*Math.PI/30;
  s.appendChild(el('line',{x1:50,y1:50,x2:50+Math.sin(ha)*22,y2:50-Math.cos(ha)*22,stroke:'#EBB9A8','stroke-width':5,'stroke-linecap':'round'}));
  s.appendChild(el('line',{x1:50,y1:50,x2:50+Math.sin(ma)*34,y2:50-Math.cos(ma)*34,stroke:'#F7F1E6','stroke-width':3,'stroke-linecap':'round'}));
  s.appendChild(el('circle',{cx:50,cy:50,r:4,fill:'#EBB9A8'}));
});
// coverage rings (hours of 168)
document.querySelectorAll('svg[data-ring]').forEach(function(s){
  var v=+s.dataset.ring,C=2*Math.PI*42,on=s.closest('.ringbox').classList.contains('on');
  s.appendChild(el('circle',{cx:50,cy:50,r:42,fill:'none',stroke:'rgba(31,26,20,.1)','stroke-width':10}));
  s.appendChild(el('circle',{cx:50,cy:50,r:42,fill:'none',stroke:on?'#9B2F45':'#7D7262','stroke-width':10,'stroke-dasharray':(C*v/168)+' '+C,transform:'rotate(-90 50 50)','stroke-linecap':v<168?'round':'butt'}));
  var t=el('text',{x:50,y:55,'text-anchor':'middle','font-family':'DM Mono, monospace','font-size':13,fill:on?'#9B2F45':'#7D7262'});t.textContent=Math.round(v/168*100)+'%';s.appendChild(t);
});
// year strip: <div class="year" data-rows='[["s-roof","Roof check","after winter",[2]]]'></div> (months 0-11)
document.querySelectorAll('.year[data-rows]').forEach(function(y){
  var M=['J','F','M','A','M','J','J','A','S','O','N','D'],rows=JSON.parse(y.dataset.rows);
  var h='<div class="yr head"><span></span>'+M.map(function(m){return '<span>'+m+'</span>'}).join('')+'</div>';
  rows.forEach(function(r){h+='<div class="yr"><div class="svc"><span class="sym"><svg class="ic"><use href="#'+r[0]+'"/></svg></span><div><b>'+r[1]+'</b><small>'+r[2]+'</small></div></div>'+M.map(function(_,i){return '<span class="m'+(r[3].indexOf(i)>-1?' on':'')+'"></span>'}).join('')+'</div>'});
  y.innerHTML=h;
});
// folios + contents
var pages=[].slice.call(document.querySelectorAll('.page'));
pages.forEach(function(p,i){if(!p.classList.contains('folio'))return;var f=document.createElement('div');f.className='foot';f.innerHTML='<span>'+(document.body.dataset.folio||'Lead Awaker')+'</span><span>'+String(i+1).padStart(2,'0')+'</span>';p.appendChild(f)});
var toc=document.getElementById('toc');if(toc)
pages.forEach(function(p,i){if(!p.dataset.toc||!toc)return;p.id='p'+(i+1);var a=document.createElement('a');a.href='#p'+(i+1);
  var n=p.dataset.tocI?'<span class="sym md"><svg class="ic"><use href="#'+p.dataset.tocI+'"/></svg></span>'+p.dataset.tocN:'';
  a.innerHTML='<span class="n">'+n+'</span><span class="t">'+p.dataset.toc+'<small>'+p.dataset.tocSub+'</small></span><span class="p">'+String(i+1).padStart(2,'0')+'</span>';toc.appendChild(a)});
