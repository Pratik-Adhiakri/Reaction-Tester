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