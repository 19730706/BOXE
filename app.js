const workouts=window.workouts;
const introAudio=window.introAudio;
const introText=window.introText;
const techAudio=window.techAudio;
const techText=window.techText;
const techPlan=window.techPlan;
const techTimes=window.techTimes;
const countdownAudio=window.countdownAudio;
const countdownText=window.countdownText;

let day='day1',ri=0,phase='round',elapsed=0,running=false,started=0,tickId=null,lastCue=null,wake=null;
let fired=new Set(),audioQueue=[],audioBusy=false,currentAudio=null;
const el=id=>document.getElementById(id);
const ROUND_SEC=180, REST_SEC=30;

function fmt(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function vibrate(pattern){try{if(navigator.vibrate)navigator.vibrate(pattern)}catch(e){}}
async function keepAwake(){try{if('wakeLock'in navigator)wake=await navigator.wakeLock.request('screen')}catch(e){}}

function saveState(){
  try{localStorage.setItem('boxe-state',JSON.stringify({day,ri,phase,elapsed,ts:Date.now()}))}catch(e){}
}
function restoreState(){
  try{
    const s=JSON.parse(localStorage.getItem('boxe-state')||'null');
    if(!s)return;
    if(!workouts[s.day])return;
    day=s.day;
    ri=Math.max(0,Math.min(workouts[day].rounds.length-1,s.ri||0));
    phase=s.phase==='rest'?'rest':'round';
    elapsed=Math.max(0,Math.min(phase==='rest'?REST_SEC:ROUND_SEC,Number(s.elapsed)||0));
  }catch(e){}
}

function stopVoices(){audioQueue=[];audioBusy=false;if(currentAudio){try{currentAudio.pause()}catch(e){}currentAudio=null}}
function enqueueAudio(item){audioQueue.push(item);playNextAudio()}
function playNextAudio(){
  if(audioBusy||!audioQueue.length)return;
  audioBusy=true;
  const item=audioQueue.shift();
  const a=new Audio(item.url);currentAudio=a;a.preload='auto';
  let finished=false,startedOnce=false,safetyTimer=null;
  function finish(){
    if(finished)return;finished=true;
    if(safetyTimer)clearTimeout(safetyTimer);
    try{a.pause()}catch(e){}
    currentAudio=null;audioBusy=false;
    setTimeout(playNextAudio,120);
  }
  function startPlayback(){
    if(startedOnce||finished)return;
    startedOnce=true;
    const p=a.play();if(p&&p.catch)p.catch(()=>finish());
    a.addEventListener('ended',finish,{once:true});
    safetyTimer=setTimeout(finish,45000);
  }
  a.addEventListener('canplay',startPlayback,{once:true});
  a.addEventListener('loadedmetadata',startPlayback,{once:true});
  a.addEventListener('error',finish,{once:true});
  setTimeout(()=>{if(!startedOnce&&!finished&&a.readyState>=2)startPlayback()},1500);
}
function playRoundIntro(roundId){const url=introAudio[roundId];if(!url)return;lastCue={type:'intro',roundId};el('cue').textContent=introText[roundId]||'';enqueueAudio({url})}
function playTech(roundId,idx){const key=(techPlan[roundId]||[])[idx];if(!key||!techAudio[key])return;lastCue={type:'tech',key};el('cue').textContent=techText[key]||'';enqueueAudio({url:techAudio[key]})}
function playCountdown(key){if(!countdownAudio[key])return;lastCue={type:'countdown',key};el('cue').textContent=countdownText[key]||'';enqueueAudio({url:countdownAudio[key]})}

function renderRounds(){
  const box=el('rounds');box.innerHTML='';
  workouts[day].rounds.forEach((r,i)=>{
    const b=document.createElement('button');
    b.className='pill '+(i===ri?'on':'');
    b.textContent=i+1;b.onclick=()=>jumpRound(i);
    box.appendChild(b);
  });
}
function render(){
  const card=document.querySelector('.card');
  const current=workouts[day].rounds[ri];
  const next=workouts[day].rounds[ri+1];

  card.classList.toggle('resting',phase==='rest');
  card.classList.toggle('final30',phase==='round'&&elapsed>=150);

  if(phase==='round'){
    el('roundLabel').textContent='ROUND '+(ri+1)+' / '+workouts[day].rounds.length;
    el('roundTitle').textContent=current.name;
    el('timer').textContent=fmt(ROUND_SEC-elapsed);
    el('nextBox').innerHTML=next?'Dopo: <strong>'+next.name+'</strong>':'Ultimo round';
    el('progressBar').style.width=Math.min(100,(elapsed/ROUND_SEC)*100)+'%';
    document.querySelector('.timerLabel').textContent='tempo round';
    document.querySelector('.round-kind').textContent='3 MIN';
  }else{
    el('roundLabel').textContent='RECUPERO';
    el('roundTitle').textContent='Respira e sciogli le spalle';
    el('timer').textContent=fmt(REST_SEC-elapsed);
    el('nextBox').innerHTML=next?'Prossimo: <strong>'+next.name+'</strong>':'Fine allenamento';
    el('progressBar').style.width=Math.min(100,(elapsed/REST_SEC)*100)+'%';
    document.querySelector('.timerLabel').textContent='recupero';
    document.querySelector('.round-kind').textContent='30 SEC';
  }
  renderRounds();
}

function fireDue(){
  if(phase!=='round')return;
  const r=workouts[day].rounds[ri];
  const introKey='intro-'+day+'-'+ri;
  if(elapsed>=0&&!fired.has(introKey)){fired.add(introKey);playRoundIntro(r.id);vibrate(80)}
  techTimes.forEach((t,i)=>{
    const k='tech-'+day+'-'+ri+'-'+i;
    if(elapsed>=t&&!fired.has(k)){fired.add(k);playTech(r.id,i)}
  });
  [{t:150,key:'30'},{t:160,key:'20'},{t:170,key:'10'},{t:175,key:'5'}].forEach(c=>{
    const k='count-'+day+'-'+ri+'-'+c.key;
    if(elapsed>=c.t&&!fired.has(k)){
      fired.add(k);playCountdown(c.key);
      if(c.key==='30')vibrate([90,70,90]);
      if(c.key==='5')vibrate([60,50,60,50,60]);
    }
  });
}

function startRest(){
  phase='rest';elapsed=0;started=Date.now();fired.clear();stopVoices();
  el('cue').textContent='Recupero. Respira e preparati al prossimo round.';
  vibrate([130,80,130]);
  saveState();render();
}
function startNextRound(){
  if(ri>=workouts[day].rounds.length-1){
    running=false;clearInterval(tickId);stopVoices();
    el('play').textContent='▶ Avvia';el('cue').textContent='Allenamento completato.';
    vibrate([180,90,180,90,300]);
    phase='round';elapsed=0;saveState();render();return;
  }
  ri++;phase='round';elapsed=0;started=Date.now();fired.clear();stopVoices();
  vibrate(100);saveState();render();fireDue();
}

function tick(){
  if(!running)return;
  elapsed=(Date.now()-started)/1000;
  if(phase==='round')fireDue();

  if(phase==='round'&&elapsed>=ROUND_SEC){
    startRest();
  }else if(phase==='rest'&&elapsed>=REST_SEC){
    startNextRound();
  }

  saveState();render();
}
function start(){
  if(running){
    running=false;clearInterval(tickId);stopVoices();el('play').textContent='▶ Riprendi';saveState();return;
  }
  running=true;started=Date.now()-elapsed*1000;el('play').textContent='⏸ Pausa';keepAwake();
  tickId=setInterval(tick,200);
  if(phase==='round')fireDue();
}
function jumpRound(i){
  running=false;clearInterval(tickId);stopVoices();
  ri=Math.max(0,Math.min(workouts[day].rounds.length-1,i));
  phase='round';elapsed=0;fired.clear();lastCue=null;
  el('play').textContent='▶ Avvia';el('cue').textContent='Premi Avvia.';
  saveState();render();
}
function chooseDay(d){
  day=d;ri=0;phase='round';elapsed=0;running=false;clearInterval(tickId);stopVoices();fired.clear();lastCue=null;
  el('day1').classList.toggle('on',d==='day1');el('day2').classList.toggle('on',d==='day2');
  el('play').textContent='▶ Avvia';el('cue').textContent='Premi Avvia.';
  saveState();render();
}
function replayLast(){
  if(!lastCue)return;
  if(lastCue.type==='intro')playRoundIntro(lastCue.roundId);
  if(lastCue.type==='tech'){el('cue').textContent=techText[lastCue.key]||'';enqueueAudio({url:techAudio[lastCue.key]})}
  if(lastCue.type==='countdown')playCountdown(lastCue.key);
}

el('play').onclick=start;
el('prev').onclick=()=>jumpRound(ri-1);
el('next').onclick=()=>jumpRound(ri+1);
el('back').onclick=()=>{
  const lim=phase==='rest'?REST_SEC:ROUND_SEC;
  elapsed=Math.max(0,elapsed-15);started=Date.now()-elapsed*1000;fired.clear();stopVoices();saveState();render()
};
el('fwd').onclick=()=>{
  const lim=phase==='rest'?REST_SEC:ROUND_SEC;
  elapsed=Math.min(lim-0.1,elapsed+15);started=Date.now()-elapsed*1000;fired.clear();stopVoices();saveState();render()
};
el('repeat').onclick=replayLast;
el('day1').onclick=()=>chooseDay('day1');
el('day2').onclick=()=>chooseDay('day2');

restoreState();
el('day1').classList.toggle('on',day==='day1');
el('day2').classList.toggle('on',day==='day2');
render();