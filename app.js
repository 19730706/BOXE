const workouts=window.workouts;
const introAudio=window.introAudio;
const introText=window.introText;
const techAudio=window.techAudio;
const techText=window.techText;
const techPlan=window.techPlan;
const techTimes=window.techTimes;
const countdownAudio=window.countdownAudio;
const countdownText=window.countdownText;
let day='day1',ri=0,elapsed=0,running=false,started=0,tickId=null,lastCue=null,wake=null;
let fired=new Set(),audioQueue=[],audioBusy=false,currentAudio=null;
const el=id=>document.getElementById(id);
function fmt(s){s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
async function keepAwake(){try{if('wakeLock'in navigator)wake=await navigator.wakeLock.request('screen')}catch(e){}}
function stopVoices(){audioQueue=[];audioBusy=false;if(currentAudio){try{currentAudio.pause()}catch(e){}currentAudio=null}}
function enqueueAudio(item){audioQueue.push(item);playNextAudio()}
function playNextAudio(){if(audioBusy||!audioQueue.length)return;audioBusy=true;const item=audioQueue.shift();const a=new Audio(item.url);currentAudio=a;a.preload='auto';let finished=false,startedOnce=false,safetyTimer=null;function finish(){if(finished)return;finished=true;if(safetyTimer)clearTimeout(safetyTimer);try{a.pause()}catch(e){}currentAudio=null;audioBusy=false;setTimeout(playNextAudio,120)}function startPlayback(){if(startedOnce||finished)return;startedOnce=true;const p=a.play();if(p&&p.catch)p.catch(()=>finish());a.addEventListener('ended',finish,{once:true});safetyTimer=setTimeout(finish,45000)}a.addEventListener('canplay',startPlayback,{once:true});a.addEventListener('loadedmetadata',startPlayback,{once:true});a.addEventListener('error',finish,{once:true});setTimeout(()=>{if(!startedOnce&&!finished&&a.readyState>=2)startPlayback()},1500)}
function playRoundIntro(roundId){const url=introAudio[roundId];if(!url)return;lastCue={type:'intro',roundId};el('cue').textContent=introText[roundId]||'';enqueueAudio({url})}
function playTech(roundId,idx){const key=(techPlan[roundId]||[])[idx];if(!key||!techAudio[key])return;lastCue={type:'tech',key};el('cue').textContent=techText[key]||'';enqueueAudio({url:techAudio[key]})}
function playCountdown(key){if(!countdownAudio[key])return;lastCue={type:'countdown',key};el('cue').textContent=countdownText[key]||'';enqueueAudio({url:countdownAudio[key]})}
function renderRounds(){const box=el('rounds');box.innerHTML='';workouts[day].rounds.forEach((r,i)=>{const b=document.createElement('button');b.className='pill '+(i===ri?'on':'');b.textContent=i+1;b.onclick=()=>jumpRound(i);box.appendChild(b)})}
function render(){const r=workouts[day].rounds[ri];el('roundLabel').textContent='ROUND '+(ri+1)+' / '+workouts[day].rounds.length;el('roundTitle').textContent=r.name;el('timer').textContent=fmt(180-elapsed);renderRounds()}
function fireDue(){const r=workouts[day].rounds[ri];const introKey='intro-'+day+'-'+ri;if(elapsed>=0&&!fired.has(introKey)){fired.add(introKey);playRoundIntro(r.id)}techTimes.forEach((t,i)=>{const k='tech-'+day+'-'+ri+'-'+i;if(elapsed>=t&&!fired.has(k)){fired.add(k);playTech(r.id,i)}});[{t:150,key:'30'},{t:160,key:'20'},{t:170,key:'10'},{t:175,key:'5'}].forEach(c=>{const k='count-'+day+'-'+ri+'-'+c.key;if(elapsed>=c.t&&!fired.has(k)){fired.add(k);playCountdown(c.key)}})}
function tick(){if(!running)return;elapsed=(Date.now()-started)/1000;fireDue();if(elapsed>=180){if(ri<workouts[day].rounds.length-1){ri++;elapsed=0;started=Date.now();fired.clear();stopVoices();render();fireDue()}else{running=false;clearInterval(tickId);stopVoices();el('play').textContent='▶ Avvia';el('cue').textContent='Allenamento completato.'}}render()}
function start(){if(running){running=false;clearInterval(tickId);stopVoices();el('play').textContent='▶ Riprendi';return}running=true;started=Date.now()-elapsed*1000;el('play').textContent='⏸ Pausa';keepAwake();tickId=setInterval(tick,200);fireDue()}
function jumpRound(i){running=false;clearInterval(tickId);stopVoices();ri=Math.max(0,Math.min(workouts[day].rounds.length-1,i));elapsed=0;fired.clear();lastCue=null;el('play').textContent='▶ Avvia';el('cue').textContent='Premi Avvia.';render()}
function chooseDay(d){day=d;ri=0;elapsed=0;running=false;clearInterval(tickId);stopVoices();fired.clear();lastCue=null;el('day1').classList.toggle('on',d==='day1');el('day2').classList.toggle('on',d==='day2');el('play').textContent='▶ Avvia';el('cue').textContent='Premi Avvia.';render()}
function replayLast(){if(!lastCue)return;if(lastCue.type==='intro')playRoundIntro(lastCue.roundId);if(lastCue.type==='tech'){el('cue').textContent=techText[lastCue.key]||'';enqueueAudio({url:techAudio[lastCue.key]})}if(lastCue.type==='countdown')playCountdown(lastCue.key)}
el('play').onclick=start;el('prev').onclick=()=>jumpRound(ri-1);el('next').onclick=()=>jumpRound(ri+1);el('back').onclick=()=>{elapsed=Math.max(0,elapsed-15);started=Date.now()-elapsed*1000;fired.clear();stopVoices();render()};el('fwd').onclick=()=>{elapsed=Math.min(179,elapsed+15);started=Date.now()-elapsed*1000;fired.clear();stopVoices();render()};el('repeat').onclick=replayLast;el('day1').onclick=()=>chooseDay('day1');el('day2').onclick=()=>chooseDay('day2');render();