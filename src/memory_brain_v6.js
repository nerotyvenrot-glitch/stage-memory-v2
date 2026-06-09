// MEMORY BRAIN v6 - ES5 | Bot outfit only | Sex history | Positions
var MEM_MARKER='###MEMORY###',LIVE_MARKER='###LIVE###';

// --- UTILITY ---
function clamp(v,lo,hi){return Math.min(Math.max(v,lo),hi);}
function pushCapped(a,item,max){a.push(item);while(a.length>max)a.shift();}
function timeMins(s){var p=(s||'00:00').split(':');return parseInt(p[0],10)*60+parseInt(p[1],10);}
function minsTime(m){m=((m%1440)+1440)%1440;var h=Math.floor(m/60),n=m%60;return(h<10?'0':'')+h+':'+(n<10?'0':'')+n;}
function getCat(h){return h>=4&&h<6?'dawn':h>=6&&h<11?'morning':h>=11&&h<15?'afternoon':h>=15&&h<18?'evening':h>=18?'night':'midnight';}
function safeWin(){try{return typeof window!=='undefined'?window:null;}catch(e){return null;}}

// --- IO ---
function getScenario(){return context&&context.character?context.character.scenario||'':('' );}
function setScenario(t){if(context&&context.character)context.character.scenario=t;}

function loadMemory(){
  var sc=getScenario(),s=sc.indexOf(MEM_MARKER);
  if(s===-1)return null;
  var js=s+MEM_MARKER.length,e=sc.indexOf(MEM_MARKER,js);
  if(e===-1)return null;
  try{return JSON.parse(sc.substring(js,e));}catch(x){return null;}
}

function saveMemory(mem){
  var sc=getScenario(),i=0,s,e;
  while(i++<10){s=sc.indexOf(MEM_MARKER);if(s===-1)break;e=sc.indexOf(MEM_MARKER,s+MEM_MARKER.length);if(e===-1)break;sc=sc.substring(0,s)+sc.substring(e+MEM_MARKER.length);}
  s=sc.indexOf(LIVE_MARKER);
  if(s!==-1){e=sc.indexOf(LIVE_MARKER,s+LIVE_MARKER.length);if(e!==-1)sc=sc.substring(0,s)+sc.substring(e+LIVE_MARKER.length);}
  sc+='\n'+MEM_MARKER+JSON.stringify(mem)+MEM_MARKER;
  sc+='\n'+LIVE_MARKER+'\n'+buildLive(mem)+'\n'+LIVE_MARKER;
  setScenario(sc);
}

// --- DEFAULT MEMORY ---
function defaultMemory(){
  return {
    time:'08:00',day:1,schedules:[],
    outfit:{upper:['shirt'],lower:['jeans'],legs:[],underwear:{bra:true,panties:true}},
    currentLocation:'unknown',previousLocation:'',recentLocations:[],
    currentSex:null,lastSex:null,
    sexHistory:[],   // riwayat sesi sex (capped 7)
    sexCount:0,      // total semua sesi sex
    affection:0,romance:0,trust:0,respect:0,lust:0,
    stage:'stranger',isMarried:false,familyRole:'',interactions:[],
    currentMood:'neutral',moodIntensity:50,moodReason:'',
    previousMood:'',previousMoodIntensity:0,
    pregnancy:null,lastSexDay:0,children:[],objects:{}
  };
}

// --- OUTFIT ---
function outfitStr(o){
  if(!o)return 'unknown';
  var p=[];
  p.push('upper:'+(o.upper&&o.upper.length?o.upper.join(','):'none'));
  p.push('lower:'+(o.lower&&o.lower.length?o.lower.join(','):'none'));
  if(o.legs&&o.legs.length)p.push('legs:'+o.legs.join(','));
  var u=o.underwear||{};
  p.push('bra:'+(u.bra?'ON':'OFF')+'|panties:'+(u.panties?'ON':'OFF'));
  return p.join(' ');
}

// Snapshot outfit saat ini (untuk disimpan di history)
function snapOutfit(){
  var o=memory.outfit;if(!o)return null;
  var u=o.underwear||{};
  return {
    upper:(o.upper||[]).slice(),
    lower:(o.lower||[]).slice(),
    legs:(o.legs||[]).slice(),
    underwear:{bra:!!u.bra,panties:!!u.panties}
  };
}

function addItem(layer,item){
  var o=memory.outfit;if(!o)return;
  if(layer==='bra'||layer==='panties'){if(!o.underwear)o.underwear={};o.underwear[layer]=true;return;}
  if(!o[layer])o[layer]=[];
  if(item&&o[layer].indexOf(item)===-1)o[layer].push(item);
}

function removeItem(layer,item){
  var o=memory.outfit;if(!o)return;
  if(layer==='bra'||layer==='panties'){if(!o.underwear)o.underwear={};o.underwear[layer]=false;return;}
  if(layer==='all'){o.upper=[];o.lower=[];o.legs=[];o.underwear={bra:false,panties:false};return;}
  if(!o[layer])return;
  o[layer]=item?o[layer].filter(function(x){return x!==item;}):'';
  if(typeof o[layer]==='string')o[layer]=[];
}

// --- CONDOM ---
function lockC(){if(memory.currentSex)memory.currentSex.lock=true;}
function unlockC(){if(memory.currentSex)memory.currentSex.lock=false;}
function setCondom(s){
  if(!memory.currentSex)return;
  if(memory.currentSex.lock&&!s)return;
  memory.currentSex.condom=s;
  if(s)memory.currentSex.condomUsed=true;
}
function disposeCondom(){
  if(!memory.currentSex)return;
  unlockC();
  memory.currentSex.condom=false;
  memory.currentSex.condomDisposed=true;
  memory.currentSex.lock=false;
  memory.currentSex.condomBy=null;
}

// --- SEX SESSION ---
function startSex(partner,loc){
  memory.currentSex={
    active:true,condom:false,condomUsed:false,condomDisposed:false,
    lock:false,condomBy:null,startTime:memory.time,
    partner:partner||'unknown',location:loc||memory.currentLocation,
    position:null,          // posisi saat ini
    positions:[],           // semua posisi yang dipakai dalam sesi
    outfitAtStart:snapOutfit() // snapshot outfit saat mulai
  };
}

function finishSex(cum){
  if(!memory.currentSex||!memory.currentSex.active)return;
  if(memory.currentSex.condom)disposeCondom();

  var entry={
    day:memory.day,
    timeStart:memory.currentSex.startTime,
    timeEnd:memory.time,
    location:memory.currentSex.location,
    partner:memory.currentSex.partner,
    condomUsed:memory.currentSex.condomUsed,
    cum:cum||'none',
    positions:memory.currentSex.positions.length
      ? memory.currentSex.positions
      : (memory.currentSex.position ? [memory.currentSex.position] : ['unknown']),
    outfitBefore:memory.currentSex.outfitAtStart,  // outfit sebelum sex
    outfitAfter:snapOutfit(),                       // outfit setelah sex
    pregnancyChecked:false
  };

  memory.lastSex=entry;
  memory.sexCount=(memory.sexCount||0)+1;
  if(!memory.sexHistory)memory.sexHistory=[];
  pushCapped(memory.sexHistory,entry,7); // ingat 7 sesi terakhir

  memory.lastSexDay=memory.day;
  memory.currentSex=null;
  memory.lust=clamp(memory.lust-30,0,100);
}

// Deteksi & update posisi seks dari pesan
function parsePosition(msg){
  if(!memory.currentSex||!memory.currentSex.active)return;
  var pos=null;
  if(/doggy|dari belakang|nungging/i.test(msg))       pos='doggy';
  else if(/missionary|di bawah|menindih/i.test(msg))  pos='missionary';
  else if(/cowgirl|di atas|menunggangi/i.test(msg))   pos='cowgirl';
  else if(/reverse cowgirl/i.test(msg))               pos='reverse cowgirl';
  else if(/spooning|menyamping/i.test(msg))           pos='spooning';
  else if(/standing|berdiri/i.test(msg))              pos='standing';
  else if(/69/i.test(msg))                            pos='69';
  if(pos){
    memory.currentSex.position=pos;
    if(memory.currentSex.positions.indexOf(pos)===-1)
      memory.currentSex.positions.push(pos);
  }
}

function parseCondom(msg,who){
  if(!msg||!memory.currentSex||!memory.currentSex.active)return;
  var on=/(put on|use|wear|slips?|rolls?) (a |the )?condom|pakai kondom|pasang kondom|memasang kondom/i.test(msg);
  var off=/(remove|take off|pulls? off) (the )?condom|lepas kondom|buka kondom|buang kondom/i.test(msg);
  if(on){
    if(memory.currentSex.condom&&memory.currentSex.lock)return;
    unlockC();setCondom(true);lockC();
    memory.currentSex.condomBy=who||'unknown';
    memory.currentSex.condomDisposed=false;
  }
  if(off)disposeCondom();
}

// --- RELATIONSHIP ---
function addInteraction(type,aff,rom,tru,res,lst){
  memory.affection=clamp(memory.affection+(aff||0),-100,100);
  memory.romance=clamp(memory.romance+(rom||0),-100,100);
  memory.trust=clamp(memory.trust+(tru||0),-100,100);
  memory.respect=clamp(memory.respect+(res||0),-100,100);
  memory.lust=clamp(memory.lust+(lst||0),0,100);
  pushCapped(memory.interactions,{type:type,time:memory.time,
    aff:aff||0,rom:rom||0,tru:tru||0,res:res||0,lst:lst||0},10);
  updateStage();
}

function updateStage(){
  var t=memory.affection+memory.romance+memory.trust+memory.respect;
  if(memory.isMarried){memory.stage='partner';return;}
  memory.stage=t>=300?'partner':t>=200?'lover':t>=120?'close':t>=60?'friend':t>=20?'acquaintance':'stranger';
}

// --- MOOD ---
function setMood(mood,pct,reason){
  memory.previousMood=memory.currentMood;
  memory.previousMoodIntensity=memory.moodIntensity;
  memory.currentMood=mood||'neutral';
  memory.moodIntensity=clamp(pct||50,0,100);
  memory.moodReason=reason||'';
}

// --- TIME ---
function advanceTime(mins){memory.time=minsTime(timeMins(memory.time)+(mins||0));}
function addSchedule(t,ev){memory.schedules.push({time:t,event:ev});}
function clearSchedule(ev){memory.schedules=memory.schedules.filter(function(s){return s.event!==ev;});}

// --- LOCATION ---
function moveTo(loc){
  if(!loc||loc===memory.currentLocation)return;
  memory.previousLocation=memory.currentLocation;
  pushCapped(memory.recentLocations,memory.currentLocation,5);
  memory.currentLocation=loc;
}

// --- PREGNANCY ---
function startPregnancy(){
  if(memory.pregnancy)return;
  memory.pregnancy={dayStarted:memory.day,bellyPhase:'early',waterBroken:false};
}
function updatePregnancy(){
  if(!memory.pregnancy)return;
  var d=memory.day-memory.pregnancy.dayStarted+1;
  if(d>=30)memory.pregnancy.waterBroken=true;
  else if(d>=14)memory.pregnancy.bellyPhase='full';
  else if(d>=5)memory.pregnancy.bellyPhase='growing';
}
function deliverBaby(name,gender){
  if(!memory.pregnancy)return;
  memory.children.push({name:name||'Baby',gender:gender||'unknown',bornDay:memory.day});
  memory.pregnancy=null;
}
function checkPregnancy(){
  if(!memory.lastSex||memory.lastSex.pregnancyChecked||memory.pregnancy)return;
  if(memory.lastSex.condomUsed||memory.lastSex.cum!=='inside')return;
  memory.lastSex.pregnancyChecked=true;
  if(Math.floor(Math.random()*100)<30)startPregnancy();
}

// --- MASTER PARSER ---
function parseMaster(msg){
  if(!msg)return;

  // Time
  var tm=msg.match(/(?:maju|lewat|skip|advance)\s+(\d+)\s+(menit|jam|minutes?|hours?)/i);
  if(tm){var a=parseInt(tm[1],10);if(/jam|hour/i.test(tm[2]))a*=60;advanceTime(a);}
  if(/hari baru|next day|tidur malam/i.test(msg))memory.day=(memory.day||1)+1;

  // Location
  var lm=msg.match(/(?:pergi ke|pindah ke|go to|menuju)\s+([a-zA-Z\s]{2,30})(?:\.|,|\n|$)/i);
  if(lm)moveTo(lm[1].trim().toLowerCase());

  // Sex
  var ss=/mulai bercinta|start sex|let'?s have sex|making love|bercinta|having sex|lets? fuck|mulai ml/i.test(msg);
  var se=/selesai bercinta|finish sex|sex (?:done|over|finished)|berhenti bercinta/i.test(msg);
  var ci=/cum inside|keluar di dalam|ejakulasi di dalam|creampie/i.test(msg);
  var co=/cum outside|pull(?:ed|s)? out|keluar di luar/i.test(msg);
  var cc=/cum in(?:to)? (?:the )?condom|keluar di kondom/i.test(msg);

  if(ss&&(!memory.currentSex||!memory.currentSex.active)){
    startSex('partner',memory.currentLocation);
    addInteraction('sex_start',5,10,2,0,20);
  }
  if(memory.currentSex&&memory.currentSex.active){
    parseCondom(msg,'user');
    parsePosition(msg);
    if(ci){finishSex('inside');checkPregnancy();}
    else if(co)finishSex('outside');
    else if(cc)finishSex('condom');
    else if(se)finishSex('none');
  }

  // Outfit
  if(/\b(?:buka|lepas|tanggalkan|takes? off|removes?|undress)\b/i.test(msg)){
    if(/\b(?:bra|kutang|bh)\b/i.test(msg))removeItem('bra');
    if(/\b(?:celana dalam|panties|underwear)\b/i.test(msg))removeItem('panties');
    if(/\b(?:baju|kemeja|shirt|blou[sz]|kaos|top)\b/i.test(msg))removeItem('upper');
    if(/\b(?:celana|jeans|rok|skirt|pants|shorts)\b/i.test(msg))removeItem('lower');
    if(/\b(?:semua|all|everything)\b/i.test(msg))removeItem('all');
  }
  if(/\b(?:pakai|kenakan|puts? on|wear|dress(?:es)?)\b/i.test(msg)){
    if(/\b(?:bra|kutang|bh)\b/i.test(msg))addItem('bra');
    if(/\b(?:celana dalam|panties)\b/i.test(msg))addItem('panties');
    if(/\b(?:baju|kemeja|shirt|blou[sz])\b/i.test(msg))addItem('upper','shirt');
    if(/\b(?:celana|jeans|pants)\b/i.test(msg))addItem('lower','jeans');
  }

  // Relationship
  if(/\b(?:mencium|kiss(?:es|ed|ing)?|cium)\b/i.test(msg))addInteraction('kiss',3,5,1,0,5);
  if(/\b(?:peluk|hug(?:s|ged|ging)?)\b/i.test(msg))addInteraction('hug',4,3,2,0,2);
  if(/\b(?:marah|angry|upset|kesal|bertengkar)\b/i.test(msg))addInteraction('conflict',-5,-3,-3,-2,0);
  if(/\b(?:terima kasih|thank|makasih)\b/i.test(msg))addInteraction('thanks',2,1,2,1,0);
  if(/\b(?:love you|sayang kamu|aku sayang)\b/i.test(msg))addInteraction('affection',5,7,2,0,3);
  if(/\b(?:menikah|married|nikah|wedding)\b/i.test(msg)){memory.isMarried=true;updateStage();addInteraction('married',20,20,15,10,5);}

  // Mood
  if(/\b(?:senang|happy|bahagia|gembira)\b/i.test(msg))setMood('happy',70,'positive');
  else if(/\b(?:sedih|sad|menangis|nangis)\b/i.test(msg))setMood('sad',70,'negative');
  else if(/\b(?:marah|angry|kesal)\b/i.test(msg))setMood('angry',65,'conflict');
  else if(/\b(?:malu|embarrassed|blush)\b/i.test(msg))setMood('embarrassed',60,'shy');
  else if(/\b(?:excited|semangat|antusias)\b/i.test(msg))setMood('excited',75,'exciting');
  else if(/\b(?:takut|scared|afraid)\b/i.test(msg))setMood('scared',65,'fear');
  else if(/\b(?:tenang|calm|relax|santai)\b/i.test(msg))setMood('calm',60,'peaceful');

  // Pregnancy
  if(/\b(?:hamil|pregnant|mengandung)\b/i.test(msg)&&!memory.pregnancy)startPregnancy();
  if(/\b(?:lahir|melahirkan|give birth)\b/i.test(msg))deliverBaby('Baby','unknown');

  // External module hooks
  var w=safeWin();
  if(w){
    if(typeof w.updateTime==='function')w.updateTime(msg,memory);
    if(typeof w.updateLocation==='function')w.updateLocation(msg,memory);
    if(typeof w.updateRelationship==='function')w.updateRelationship(msg,memory);
    if(typeof w.updateMood==='function')w.updateMood(msg,memory);
    if(typeof w.updatePregnancy==='function')w.updatePregnancy(msg,memory);
  }
}

// --- BUILD LIVE CONTEXT ---
function buildLive(mem){
  var L=[],h=parseInt((mem.time||'08:00').split(':')[0],10);
  L.push('[TIME] '+mem.time+' ('+getCat(h).toUpperCase()+') Day '+(mem.day||1));
  L.push('[LOC] '+(mem.currentLocation||'unknown')+(mem.previousLocation?' < '+mem.previousLocation:''));
  L.push('[OUTFIT] '+outfitStr(mem.outfit));
  L.push('');

  // Sex aktif
  if(mem.currentSex&&mem.currentSex.active){
    var cx=mem.currentSex;
    L.push('[SEX ACTIVE] '+cx.partner+' @ '+cx.location+' since '+cx.startTime);
    L.push('  position: '+(cx.position||'none')+(cx.positions&&cx.positions.length>1?' (all: '+cx.positions.join(', ')+')':''));
    L.push('  condom: '+(cx.condom?'ON':'OFF')+(cx.lock?' [LOCKED]':'')+(cx.condomBy?' by:'+cx.condomBy:'')+' | everUsed:'+(cx.condomUsed?'YES':'NO'));
    L.push('  outfit when started: '+outfitStr(cx.outfitAtStart));
    L.push('  !! condom OVERRIDES narrative - only ON if explicitly put on');
  } else {
    L.push('[SEX] none active | total sessions: '+(mem.sexCount||0));
  }
  L.push('');

  // Sex history (max 7 sesi terakhir)
  if(mem.sexHistory&&mem.sexHistory.length){
    // Hitung berapa kali hari ini
    var todayCount=0;
    for(var t=0;t<mem.sexHistory.length;t++){if(mem.sexHistory[t].day===mem.day)todayCount++;}
    L.push('[SEX HISTORY] '+mem.sexHistory.length+' sessions remembered | today: '+todayCount+'x');
    for(var i=mem.sexHistory.length-1;i>=0;i--){
      var sx=mem.sexHistory[i];
      var afterStr=outfitStr(sx.outfitAfter);
      var beforeStr=outfitStr(sx.outfitBefore);
      L.push('  [Day '+sx.day+' '+sx.timeStart+'-'+sx.timeEnd+'] @ '+sx.location);
      L.push('    pos: '+sx.positions.join('+')+' | cum: '+sx.cum+' | condom: '+(sx.condomUsed?'YES':'NO'));
      L.push('    before: '+beforeStr);
      L.push('    after : '+afterStr);
    }
  }
  L.push('');

  // Relationship
  var rel='[REL] '+(mem.stage||'stranger').toUpperCase();
  if(mem.familyRole)rel+=' ('+mem.familyRole+')';
  if(mem.isMarried)rel+=' MARRIED';
  L.push(rel);
  L.push('  Aff:'+mem.affection+' Rom:'+mem.romance+' Tru:'+mem.trust+' Res:'+mem.respect+' Lust:'+mem.lust);
  if(mem.interactions&&mem.interactions.length){
    for(var ii=0;ii<mem.interactions.length;ii++){
      var it=mem.interactions[ii];
      L.push('  ['+it.time+'] '+it.type+' A:'+(it.aff>=0?'+':'')+it.aff+' R:'+(it.rom>=0?'+':'')+it.rom+' L:'+(it.lst>=0?'+':'')+it.lst);
    }
  }
  L.push('');

  L.push('[MOOD] '+(mem.currentMood||'neutral').toUpperCase()+' '+(mem.moodIntensity||50)+'%'+(mem.moodReason?' - '+mem.moodReason:''));
  if(mem.previousMood)L.push('  prev: '+mem.previousMood+' '+mem.previousMoodIntensity+'%');
  L.push('');

  if(mem.pregnancy){
    var pd=(mem.day||1)-mem.pregnancy.dayStarted+1;
    L.push('[PREG] day '+pd+' | '+mem.pregnancy.bellyPhase+(mem.pregnancy.waterBroken?' | !! WATER BROKE':''));
  } else {
    L.push('[PREG] none');
  }
  if(mem.children&&mem.children.length){
    var cn=[];for(var c=0;c<mem.children.length;c++)cn.push(mem.children[c].name+'('+mem.children[c].gender+')');
    L.push('[CHILDREN] '+cn.join(', '));
  }

  var now=timeMins(mem.time||'00:00');
  for(var j=0;j<(mem.schedules||[]).length;j++){
    if(Math.abs(timeMins(mem.schedules[j].time)-now)<=30)
      L.push('[REMINDER] '+mem.schedules[j].event+' at '+mem.schedules[j].time);
  }

  L.push('');
  L.push('[RULES] Condom NOT default. Only ON if explicit. Auto-removed on sex end. Track outfit each step. Lust drops after sex. Mood affects tone. Pregnancy only: unprotected + cum inside. Use sex history for memory recall.');
  return L.join('\n');
}

// --- INIT ---
var memory=loadMemory();
if(!memory)memory=defaultMemory();
if(!memory.sexHistory)memory.sexHistory=[];
if(!memory.sexCount)memory.sexCount=0;

var lastMsg='';
if(context&&context.chat&&context.chat.length>0){
  var lo=context.chat[context.chat.length-1];
  if(lo&&typeof lo.content==='string')lastMsg=lo.content;
}

if(lastMsg)parseMaster(lastMsg);
if(memory.pregnancy)updatePregnancy();
saveMemory(memory);
