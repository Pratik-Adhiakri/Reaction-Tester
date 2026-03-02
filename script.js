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
    leaderbpoard:[],
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
