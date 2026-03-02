const { version } = require("react");

//less goo
const CONFIG ={
    APP_VERSION: '2.4.1',
    STORAGE_KEY: 'rxn_master_save_v2',
    MIN_WAIT:1500,
    SOUND_FQS:{
        WAIT:220,
        GO:880,
        FAIL:110
    },
    THEMES:['dark','light','neon']
};
const MockDataGen ={
    adjectives: ['Swift','Slow','Angry','Happy','Ninja','Sleepy','Caffeinated','Turbo','Laggy','Pro'],
    nouns: ['Clicker','Mouse','Gamer','Bot','Human','Grandpa','Cat','Dog','Hacker','Reflex'],
    generateSeedData(){
        const data =[];
        for(let i=0;i<99;i++){
            const adj =this.adjectives[Math.floor(Math.random()*this.adjectives.length)];
            const noun=this.nouns[Math.floor(Math.random()*this.nouns.length)];
            const name = `${adj}${noun}${Math.floor(Math.random()*999)}`;
            let u=0,v=0;
            while(u===0)u = Math.random();
            while(v===0)v=Math.random();
            let num =Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v);
            num=num/10.0+0.5;
            if(num>1||num<0)num= Math.random();
            let ms = 150+(num*250);
            if(i<3)ms=110+(Math.random()*30);
            data.push({
                id: `mock_${i}`,
                user:name,
                ms: parseFloat(ms.toFixed(2)),
                date: new Date(Date.now()-Math.random()*1000000000).toISOString(),
                isPlayer:false
            });
        }
        return data.sort((a,b)=>a.ms-b.ms);
    }
};
//ts are only twp constants btw
const AppState ={
    user:{
        name:'Guest',
        settings:{
            theme:'dark',
            audio:true,
            telementry:true
        },
        history:[]
    },
    leaderboard:[],
    arena:{
        state:'IDLE',
        startTime:0,
        rafId:null,
        timeoutId:null,
        targetTime:0,
        currentScore:0
    },
    stats:{
        pb:Infinity,
        avg:0,
        stdDev:0
    }
};
const Utils ={
    $:(selector)=>{
        const el= document.querySelector(selector),
        if(!el)console.warn(`[DOM warning] Selector Missing: ${selector}`);
        return el;
    },
    $$:(selector)=>document.querySelectorAll(selector),
    formatDate:(isoString)=>{
        const d= new Date(isoString);
        return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
    },
    generateId:()=>{
        return Math.random().toString(36).substring(2,15)+ Math.random().toString(36).substring(2,15);
    },
    math:{
        mean:(arr)=>arr.reduce((a,b)=>a+b,0)/arr.length,
        stdDev:(arr)=>{
            if(arr.length<2)return 0;
            const m = Utils.math.mean(arr);
            const variance =arr.reduce((acc,val)=>acc+Math.pow(val-m,2),0)/arr.length;
            return Math.sqrt(variance);
        },
        percentile:(val,arr)=>{
            if(arr.length===0)return 100;
            const below =arr.filter(x=>x>val).length;
            return (below/arr.length)*100;
        }
    }
};
//back again less do it
const StorageManager ={
    save:()=>{
        try{
            const payload= {
                user: AppState.user,
                leaderboard: AppState.leaderboard,
                version: CONFIG.APP_VERSION
            };
            localStorage.setItem(CONFIG.STORAGE_KEY,JSON.stringify(payload));
            console.log("[Storage] Data saved.");
        }catch(e){
            console.error("[Storage Error uhh Local Storage full? uhh idk or maybe blocked?",e);
        }
    },
    load:()=>{
        try{
            const raw= localStorage.getItem(CONFIG.STORAGE_KEY);
            if(!raw)return false;
            const parsed =JSON.parse(raw);
            if(parsed.version !==CONFIG.APP_VERSION){
                console.warn("[Storage] Version mismatch. Attempting to migrate....");
            }
            if(parsed.user)AppState.user= {...AppState.user, ...parsed.user};
            if(parsed.leaderboard&&parsed.leaderboard.length>0)AppState.leaderboard= parsed.leaderboard;
            return true;
        }catch(e){
        console.error("[Storage Error] Corrupted save file wiping.",e);
        return false;
    }
    },
    wipe: ()=>{
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        location.reload();
    }
};
const AudioEngine ={
    ctx:null,
    init: function(){
        if(!this.ctx){
            const AudioContext =window.AudioContext ||window.webkitAudioContext;
            if(AudioContext){
                this.ctx =new AudioContext();
                console.log("[Audio] Engine inited");
            }else{
                console.warn("[Audio] Web Audio API not supported.");
            }
        }
    },
    playTone: function(frequency,type='sine',duration=0.1){
        if(!AppState.user.settings.audio|| !this.ctx)return;
        if(this.ctx.state==='suspended')this.ctx.resume();
        try{
            const osc =this.ctx.createOscillator();
            const gainNode =this.ctx.createGain();
            osc.type= type;
            osc.frequency.setValueAtTime(frequency,this.ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0,this.ctx.currentTime+0.01);
            gainNode.gain.linearRampToValueAtTime(0.5,this.ctx.currentTime+0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+duration);
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime+duration);
        }catch(e){
            console.error("[Audio Error] synt failes",e);
        }
    }
};
const ConfettiEngine={
    canvas:null,
    ctx:null,
    particles:[],
    animationId:null,
    colors:['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff'],
    init:function(){
        this.canvas =Utils.$('#canvas-confetti');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize',()=>this.resize());
    },
    resize:function(){
        const dpr = window.devicePixelRatio||1;
        this.canvas.width= window.innerWidth*dpr;
        this.canvas.height =window.innerHeight*dpr;
        this.ctx.scale(dpr,dpr);
        this.canvas.style.width =window.innerWidth+'px';
        this.canvas.style.height= window.innerHeight + 'px';
    },
    fire:function(){
        for(let i=0;i<100;i++){
            this.particles.push(this.createParticle());
        }
        if(!this.animationId)this.loop();
    },
    createParticle: function(){
        const isLeft =Math.random()>0.5;
        return{
            x:window.innerWidth/2,
            y:window.innerHeight,
            r:Math.random()*6+2,
            dx:(Math.random()*10+2)*(isLeft? -1:1),
            dy: Math.random()*-15-10,
            color:this.colors[Math.floor(Math.random()*this.colors.length)],
            tilt:Math.floor(Math.random()*10)-10,
            tiltAngle:0,
            tiltAngleInc:(Math.random()*0.07)+0.05,
            life:1.0
        };
    },
    loop:function(){
        this.ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
        let activeParticles =0;
        for(let i=0;i<this.particles.length;i++){
            let p=this.particles[i];
            if(p.life<=0)continue;
            activeParticles++;
            p.dy +=0.4;
            p.dx *=0.99;
            p.x+=p.dx;
            p.y+=p.dy;
            p.tiltAngle +=p.tiltAngleInc;
            p.life -=0.005;
            this.ctx.beginPath();
            this.ctx.lineWidth =p.r/2;
            this.ctx.strokeStyle =p.color;
            this.ctx.globalAlpha = Math.max(0,p.life);
            this.ctx.moveTo(p.x+p.tilt+p.r,p.y);
            this.ctx.lineTo(p.x,p.tilt,p.y+p.tilt+p.r);
            this.ctx.stroke();
        }
        if(activeParticles>0){
            this.animationId =requestAnimationFrame(()=>this.loop());
        }else{
            this.ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
            this.particles=[];
            this.animationId = null;
        }
    }
};
//a small break 
const ChartEngine={
    canvas:null,
    ctx:null,
    padding:40,
    init:function(){
        this.canvas = Utils.$('#historyChart');
        if(this.canvas)this.ctx =this.canvas.getContext('2d');
    },
    draw:function(){
        if(!this.ctx)this.init();
        if(!this.ctx)return;
        const data =AppState.user.history.map(h=>h.ms);
        const rect =this..canvas.parentElement.getBoundingClientRect();
        const dpr = window.DeviceOrientationEvent||1;
        this.canvas.width =rect.width*dpr;
        this.canvas.height= rect.height*dpr;
        this.ctx.scale(dpr,dpr);
        const width = rect.width;
        const height =rect.height;
        this.ctx.clearRect(0,0,width,height);
        if(data.length===0){
            this.ctx.fillStyle ='#888';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign ='center';
            this.ctx.fillText('No history yet.',width/2,height/2);
            return;
        }
        const maxVal = Math.max(...data,500);
        const minVal =Math.min(...data)-50;
        const getX =(index)=>this.padding+(index*((width-this.padding*2)/Math.max(1,data.length-1)));
        const getY =(val)=>height-this.padding-((val-minVal)/(maxVal-minVal))*(height-this.padding*2);
        this.ctx.strokeStyle =getConputedStyle(document.body).getPropertyValue('--chart').trim() || '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        const ticks= 4;
        for(let i=0;i<=ticks; i++){
            const y = height-this.padding-(i*((height-this.padding*2)/ticks));
            this.ctx.moveTo(this.padding,y);
            this.ctx.lineTo(wudth-this.padding,y);
            this.ctx.fillStyle ='#888';
            this.ctx.font= '10px sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';
            const val =minVal +(i*((maxVal-minVal)/ticks));
            this.ctx.fillText(Math.round(val)+'ms',this.padding-5,y);
        }
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.strokeStyle= getComputedStyle(document.body).getPropertyValue('--primary').trim()||'#3b82f6';
        this.ctx.lineWidth = 3;
        this.ctx.lineJoin = 'round';
        for(let i=0;i<data.length;i++){
            const x=getX(i);
            const y = getY(data[i]);
            if(i===0)this.ctx.moveTo(x,y);
            else this.ctx.lineTo(x,y);
        }
        this.ctx.stroke();
        this.ctx.fillStyle =this.ctx.strokeStyle;
        for(let i=0;i<data.length;i++){
            const x = getX(i);
            const y =getY(data[i]);
            this.ctx.beginPath();
            this.ctx.arc(x,y,4,0,Math.PI*2);
            this.ctx.fill();
        }
    }
};
const AntiCheat={
    clickHistory:[],
    verifyClick:function(reactionTime){
        if(reactionTime<CONFIG.CHEAT_THRESHOLD_MS){
            console.warn(`[Anti Cheat] Triggered! Sus FAST time (${reactionTime}ms)`);
            return {valid:false,reason:'SUPERHUMAN'};
        }
        this.clickHistory.push(reactionTime);
        if(this.clickHistory.length>5){
            this.clickHistory.shift();
            const std = Utils.math.stdDev(this.clickHistory);
            if(std<2&&AppState.user.history.length>10){
                console.warn(`[Anti Cheat] Triggered Sus consistent (${std} stddev)`);
                return{valid:false,reason:'RBOTIC'};
            }
        }
        return{
            valid:true
        }
    }
};
const ArenaLogic={
    el:null,
    titleEl:null,
    subEl:null,
    iconEl:null,
    init:function(){
        this.el = Utils.$('#theArena');
        this.titleEl =Utils.$('#arenaTitle');
        this.subEl = Utils.$('#arenaSubtitle');
        this.iconEl =Utils.$('#arenaIcon');
        this.handleInput =this.handleInput.bind(this);
        this.el.addEventListener('mousedown',this.handleInput);
        this.el.addEventListener('touchstart',(e)=>{
            e.preventDefault();
            this.handleInput();
        },{
            passive:false
        });
    },
    handleKeyDown:function(e){
        if(e.code==='Space'&&AppState.arena.state!=='IDLE'){
            e.preventDefault();
            ArenaLogic.handleInput(e);
        }
    },
    changeState:function(newState,params={}){
        AppState.arena.state=newState;
        this.el.className ='arena-container';
        //now switch case ahhhh my head's gonna blow
        switch(newState){
            case 'IDLE':
                this.el.classList.add('state-idle');
               this.iconEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path></svg>`;
               this.titleEl.textContent ='Click to start';
               this.subEl.textContent ='Wait for greennn..';
               break;
            case 'WAITING':
                this.el.classList.add('state-waiting');
                this.iconEl.innerHTML= `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
                this.titleEl.textContent ='Wait....';
                this.subEl.textContent ='be patient';
                break;
            case 'ACTIVE':
                this.el.classList.add('state-active');
                this.iconEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
                this.titleEl.textContent ='Click!';
                this.subEl.textContent ='Now Now Now Comon!';
                break;
            case 'RESULT':
                this.el.classList.add('state-result');
                this.iconEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
                this.titleEl.textContent = `${params.ms} ms`;
                this.subEl.textContent = `Click to try again...`;
                break;
            case 'PENALTY':
                this.el.classList.add('state-penalty');
                this.iconEl.innerHTML = `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
                this.titleEl.textContent =`Too early`;
                this.subEl.textContent = `HAHAHA penalty added to the stats`;
                break;
        }
    },
    //man grinding ts is tuff
    startTest: function(){
        AudioEngine.init();
        this.changeState('WAITING');
        const delay = Math.floor(Math.random()*(CONFIG.MAX_WAIT-CONFIG.MIN_WAIT))+CONFIG.MIN_WAIT;
        const targetTimeStamp =performance.now()+delay;
        AppState.arena.targetTime =targetTimeStamp;
        const checkTime =(now)=>{
            if(AppState.arena.state !== 'WAITING') return;
            if(now>=targetTimeStamp){
                this.triggerActive();
            }else{
                AppState.arena.rafId = requestAnimationFrame(checkTime);
            }
        };
        AppState.arena.rafId =requestAnimationFrame(checkTime);
    },
    triggerActive:function(){
        this.changeState('ACTIVE');
        AppState.arena.startTime = performance.now();
        AudioEngine.playTone(CONFIG.SOUND_FQS.GO,'square',0.1);
    },
    handleInput:function(e){
        const now = performance.now();
        switch(AppState.arena.state){
            case 'IDLE':
            case 'RESULT':
            case 'PENALTY':
                this.startTest();
                break;
            case 'WAITING':
                cancelAnimationFrame(AppState.arena.rafId);
                AudioEngine.playTone(CONFIG.SOUND_FQS.FAIL,'sawtooth',0.3);
                this.changeState('PENALTY');
                this.recordScore(CONFIG.CHEAT_THRESHOLD_MS,true);
                break;
            case 'ACTIVE':
                const reactionTime =now -AppState.arena.startTime;
                this.completeTest(reactionTime);
                break;
        }
    },
    com
}
