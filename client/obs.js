(function(){
  'use strict';
  const $=(id)=>document.getElementById(id);
  const root=$('obs-root'), portrait=$('obs-portrait'), pvFill=$('obs-pv-fill'), peFill=$('obs-pe-fill'), pvText=$('obs-pv-text'), peText=$('obs-pe-text');
  const params=new URLSearchParams(window.location.search||'');
  const setStatus=(status)=>{ if(root) root.dataset.status=status; };
  const toNumber=(value,fallback)=>{ const n=Number(value); return Number.isFinite(n)?n:fallback; };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const percent=(current,max)=>clamp((toNumber(current,0)/Math.max(1,toNumber(max,1)))*100,0,100);
  function setImage(src){ const fallback='/assets/logo.jpg'; const next=typeof src==='string'&&src.trim()?src.trim():fallback; if(portrait&&portrait.getAttribute('src')!==next) portrait.setAttribute('src',next); }
  function setBar(kind,current,max){ const fill=kind==='pv'?pvFill:peFill; const text=kind==='pv'?pvText:peText; const c=Math.max(0,toNumber(current,0)); const m=Math.max(1,toNumber(max,1)); if(fill) fill.style.width=`${percent(c,m)}%`; if(text) text.textContent=`${c} / ${m}`; }
  function normalize(raw){ const character=raw&&raw.character?raw.character:raw; const data=character&&character.data?character.data:character; if(!data||typeof data!=='object') return null; return { portrait:data.portrait||data.avatar||data.image||data.imageUrl||data.foto||'', pvCurrent:data.pvCurrent??data.pvAtual??data.pv??data.hpCurrent??data.hpAtual??0, pvMax:data.pvMax??data.pvTotal??data.hpMax??data.hpTotal??1, peCurrent:data.peCurrent??data.peAtual??data.pe??data.energyCurrent??0, peMax:data.peMax??data.peTotal??data.energyMax??1 }; }
  function getId(){ const q=params.get('character')||params.get('characterId')||params.get('id')||params.get('ficha'); if(q) return q.trim(); const parts=window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent); const i=parts.indexOf('personagem'); return i>=0&&parts[i+1]?parts[i+1]:''; }
  async function getCharacter(id){ const r=await fetch(`/api/characters/public/${encodeURIComponent(id)}`,{cache:'no-store',headers:{Accept:'application/json'}}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
  let last='';
  async function refresh(){ const id=getId(); if(!id){ setStatus('idle'); setImage(''); setBar('pv',0,1); setBar('pe',0,1); return; } try{ const payload=await getCharacter(id); const ch=normalize(payload); if(!ch) throw new Error('Ficha inválida'); const js=JSON.stringify(ch); if(js!==last){ setImage(ch.portrait); setBar('pv',ch.pvCurrent,ch.pvMax); setBar('pe',ch.peCurrent,ch.peMax); last=js; } setStatus('ready'); }catch(error){ console.warn('[One Dice OBS] Falha ao carregar ficha:',error); setStatus('error'); setImage(''); setBar('pv',0,1); setBar('pe',0,1); } }
  function boot(){ try{ document.documentElement.style.background='transparent'; document.body.style.background='transparent'; document.documentElement.classList.add('one-dice-obs-page'); document.body.classList.add('one-dice-obs-page'); }catch(_){} const scale=toNumber(params.get('scale')||params.get('escala'),NaN); if(Number.isFinite(scale)&&scale>0) document.documentElement.style.setProperty('--od-scale',String(clamp(scale,.35,2))); refresh(); const interval=clamp(toNumber(params.get('intervalo')||params.get('interval')||1200,1200),700,10000); window.setInterval(refresh,interval); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
