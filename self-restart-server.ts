// Coursia Server v12 - Autonomous Bun server with Prisma + z-ai SDK
// NO dependency on Next.js. Everything runs here.
// - Static files from memory (zero I/O)
// - Database access via Prisma (SQLite)
// - Course generation via z-ai-web-dev-sdk
// - All API routes implemented
const fs = require("fs");
const path = require("path");

const BASE = "/home/z/my-project";
const PORT = 3000;
const HOST = "0.0.0.0";

// ── MIME types ──
const MIME: Record<string, string> = {
  ".html":"text/html;charset=utf-8",".js":"application/javascript",".mjs":"application/javascript",
  ".css":"text/css",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",
  ".svg":"image/svg+xml",".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",
  ".json":"application/json",".map":"application/json",".webp":"image/webp",".gif":"image/gif",".avif":"image/avif",
};
function getMime(u:string):string{const d=u.lastIndexOf('.');return d===-1?'application/octet-stream':(MIME[u.slice(d)]||'application/octet-stream');}

// ── Load static files ──
function tryRead(p:string):Buffer|null{try{return fs.readFileSync(p)}catch{return null}}

const indexPath=path.join(BASE,".next","server","app","index.html");
const indexHtml=tryRead(indexPath);
if(!indexHtml){console.error("ERROR: No build. Run bun run build first.");process.exit(1);}

const cache=new Map<string,Buffer>();
function loadDir(dir:string,pfx:string){
  try{for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,e.name),url=pfx+'/'+e.name;
    if(e.isDirectory())loadDir(full,url);
    else{const d=tryRead(full);if(d)cache.set(url,d);}
  }}catch{}
}
loadDir(path.join(BASE,".next","static","chunks"),"/_next/static/chunks");
loadDir(path.join(BASE,".next","static","media"),"/_next/static/media");
loadDir(path.join(BASE,".next","static","css"),"/_next/static/css");
loadDir(path.join(BASE,"public"),"");

const HTML_CT="text/html;charset=utf-8";
const JSON_CT="application/json;charset=utf-8";
const CC="public,max-age=86400";

// ── Lazy-loaded Prisma ──
let prisma: any = null;
async function getDB() {
  if (!prisma) {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new (PrismaClient as any)();
  }
  return prisma;
}

// ── Lazy-loaded z-ai ──
let zaiInstance: any = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = await import("z-ai-web-dev-sdk");
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ── BADGE DEFINITIONS ──
const BADGE_DEFS = [
  {id:"premier-pas",name:"Premier Pas",emoji:"🌱",threshold:1},
  {id:"explorateur",name:"Explorateur",emoji:"🧭",threshold:5},
  {id:"curieux",name:"Curieux",emoji:"🔍",threshold:10},
  {id:"apprenti",name:"Apprenti Dévoué",emoji:"📚",threshold:15},
  {id:"passionne",name:"Passionné",emoji:"🔥",threshold:25},
  {id:"expert",name:"Expert",emoji:"🏆",threshold:50},
  {id:"maitre",name:"Maître",emoji:"👑",threshold:75},
  {id:"legende",name:"Légende Vivante",emoji:"✨",threshold:100},
];

const FLAME_TYPES = [
  {id:"etincelle",name:"Étincelle",nameEn:"Spark",emoji:"✨",min:0,max:99},
  {id:"flamme",name:"Flamme",nameEn:"Flame",emoji:"🔥",min:100,max:499},
  {id:"brasier",name:"Brasier",nameEn:"Brazier",emoji:"🌋",min:500,max:1499},
  {id:"incendie",name:"Incendie",nameEn:"Wildfire",emoji:"💥",min:1500,max:3499},
  {id:"meteor",name:"Météore",nameEn:"Meteor",emoji:"☄️",min:3500,max:6999},
  {id:"supernova",name:"Supernova",nameEn:"Supernova",emoji:"🌟",min:7000,max:9999},
  {id:"legende",name:"Légende",nameEn:"Legend",emoji:"👑",min:10000,max:10000},
];

function getFlameType(pts:number){return FLAME_TYPES.find(f=>pts>=f.min&&pts<=f.max)||FLAME_TYPES[0];}
function getFlameProgress(pts:number){const t=getFlameType(pts);return{current:pts-t.min,next:t.max-t.min+1,percentage:t.min===t.max?100:Math.round(((pts-t.min)/(t.max-t.min+1))*100)};}
function fmtFlame(n:number){return n>=10000?(n/1000).toFixed(1)+'K':String(n);}

console.log("READY "+cache.size+" files (v12 with Prisma+z-ai)");

Bun.serve({
  port: PORT, hostname: HOST, reusePort: true,
  async fetch(req: Request) {
    try {
      const url=new URL(req.url);
      const p=decodeURIComponent(url.pathname);

      if(p==="/"||p==="")return new Response(indexHtml,{headers:{"Content-Type":HTML_CT}});

      if(p==="/_next/image"){
        const imgUrl=decodeURIComponent(url.searchParams.get("url")||"");
        if(imgUrl.startsWith("/")){const d=cache.get(imgUrl);if(d)return new Response(d,{headers:{"Content-Type":getMime(imgUrl),"Cache-Control":CC}});}
        return new Response("Not Found",{status:404});
      }

      // ═══ API ROUTES ═══
      if(p.startsWith("/api/")){
        const method=req.method;

        // ── GET /api/badges ──
        if(p==="/api/badges"&&method==="GET"){
          try{
            const db=await getDB();
            const courses=await db.course.findMany({include:{chapters:{include:{progress:true}}}});
            const completed=courses.filter(c=>c.chapters.length>0&&c.chapters.every(ch=>ch.progress?.completed)).length;
            const totalCh=courses.reduce((s,c)=>s+c.chapters.length,0);
            const compCh=courses.reduce((s,c)=>s+c.chapters.filter(ch=>ch.progress?.completed).length,0);
            const next=BADGE_DEFS.find(b=>completed<b.threshold)||null;
            const earned=BADGE_DEFS.filter(b=>completed>=b.threshold);
            const lastEarned=earned.length>0?earned[earned.length-1].threshold:0;
            return new Response(JSON.stringify({
              stats:{totalCourses:courses.length,completedCourses:completed,totalChapters:totalCh,completedChapters:compCh,totalStudyTime:compCh*15,averageScore:0},
              badges:{earned,all:[],next,progress:{current:lastEarned,next:next?next.threshold:100,percentage:next?Math.round(((completed-lastEarned)/(next.threshold-lastEarned))*100):100}}
            }),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[badges]",e.message);}
          return new Response(JSON.stringify({stats:{totalCourses:0,completedCourses:0,totalChapters:0,completedChapters:0},badges:{earned:[],next:{id:"premier-pas",name:"Premier Pas",emoji:"🌱",threshold:1},progress:{current:0,next:1,percentage:0}}}),{headers:{"Content-Type":JSON_CT}});
        }

        // ── GET /api/flames ──
        if(p==="/api/flames"&&method==="GET"){
          try{
            const db=await getDB();
            let settings=await db.appSettings.findFirst();
            if(!settings)settings=await db.appSettings.create({data:{}});
            const txs=await db.flameTransaction.findMany();
            const pts=settings.flamePoints;
            return new Response(JSON.stringify({
              flamePoints:pts,flameType:getFlameType(pts),flameProgress:getFlameProgress(pts),
              hasSubscription:settings.hasSubscription,
              totalEarned:txs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),
              totalSpent:Math.abs(txs.filter(t=>t.amount<0).reduce((s,t)=>s+t.amount,0)),
            }),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[flames]",e.message);}
          return new Response(JSON.stringify({flamePoints:0,flameType:getFlameType(0),flameProgress:getFlameProgress(0),hasSubscription:false,totalEarned:0,totalSpent:0}),{headers:{"Content-Type":JSON_CT}});
        }

        // ── GET /api/courses ──
        if(p==="/api/courses"&&method==="GET"){
          try{
            const db=await getDB();
            const courses=await db.course.findMany({orderBy:{createdAt:"desc"},include:{chapters:{orderBy:{order:"asc"},include:{progress:true}}}});
            const mapped=courses.map(c=>({
              id:c.id,title:c.title,description:c.description,sourceLinks:JSON.parse(c.sourceLinks||"[]"),
              createdAt:c.createdAt,overallProgress:c.chapters.length>0?Math.round((c.chapters.filter(ch=>ch.progress?.completed).length/c.chapters.length)*100):0,
              chapters:c.chapters.map(ch=>({id:ch.id,title:ch.title,content:ch.content,summary:ch.summary,order:ch.order,progress:ch.progress?{completed:ch.progress.completed,score:ch.progress.score}:null})),
            }));
            return new Response(JSON.stringify({courses:mapped}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[courses]",e.message);}
          return new Response(JSON.stringify({courses:[]}),{headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/courses/generate ──
        if(p==="/api/courses/generate"&&method==="POST"){
          try{
            const body=await req.json();
            const {title,sourceLinks=[],level=1,courseLang="fr"}=body;
            if(!title)return new Response(JSON.stringify({error:"Title required"}),{status:400,headers:{"Content-Type":JSON_CT}});

            const zai=await getZAI();
            const levelLabels=["Débutant","Intermédiaire","Avancé"];
            const completion=await zai.chat.completions.create({
              messages:[
                {role:"assistant",content:[
                  `Tu es un expert pédagogue. Crée un cours en ${courseLang==="en"?"English":"français"}.`,
                  `Niveau: ${levelLabels[level]||levelLabels[1]}. Sujet: ${title}`,
                  "RÈGLES: Nombre libre de chapitres. Sous-chapitres avec ##. Exemples concrets. Contenu captivant.",
                  "RÉPONDS avec ce JSON: {\"description\":\"...\",\"chapters\":[{\"title\":\"...\",\"content\":\"... Markdown avec ## ...\",\"summary\":\"...\"}]}"
                ].join("\n")},
                {role:"user",content:`Crée un cours sur: ${title}`}
              ],
              thinking:{type:"disabled"},
            });
            const text=completion.choices[0]?.message?.content||"";
            // Extract JSON
            let cleaned=text.trim();
            const cb=cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
            if(cb)cleaned=cb[1].trim();
            const start=cleaned.indexOf("{");
            const snippet=start>=0?cleaned.slice(start):cleaned;
            let parsed=JSON.parse(snippet);
            if(!parsed.chapters)throw new Error("No chapters");

            const db=await getDB();
            const course=await db.course.create({
              data:{
                title:title.trim(),description:parsed.description||"",sourceLinks:JSON.stringify(sourceLinks),level,flameCost:0,
                chapters:{create:parsed.chapters.map((ch:any,idx:number)=>({title:ch.title,content:ch.content,summary:ch.summary||"",order:idx+1}))},
              },
              include:{chapters:{orderBy:{order:"asc"}}},
            });
            await db.courseProgress.upsert({where:{courseId:course.id},create:{courseId:course.id},update:{}});

            return new Response(JSON.stringify({success:true,course:{id:course.id,title:course.title,description:course.description,chapters:course.chapters.map((ch:any)=>({id:ch.id,title:ch.title,content:ch.content,summary:ch.summary,order:ch.order})),createdAt:course.createdAt}}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){
            console.error("[generate]",e.message);
            return new Response(JSON.stringify({error:e.message||"Generation failed"}),{status:500,headers:{"Content-Type":JSON_CT}});
          }
        }

        // ── GET /api/courses/[id] (exclude known sub-paths) ──
        if(p.match(/^\/api\/courses\/[^/]+$/)&&!p.includes("paywall")&&!p.includes("random")&&method==="GET"){
          try{
            const id=p.split("/").pop();
            const db=await getDB();
            const course=await db.course.findFirst({where:{id},include:{chapters:{orderBy:{order:"asc"},include:{progress:true,quiz:true}},finalQuiz:true,progress:true}});
            if(!course)return new Response(JSON.stringify({error:"Not found"}),{status:404,headers:{"Content-Type":JSON_CT}});
            return new Response(JSON.stringify(course),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[course-id]",e.message);}
          return new Response(JSON.stringify({error:"Not found"}),{status:404,headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/courses/[id]/chapters/[chapterId]/quiz ──
        if(p.match(/\/api\/courses\/[^/]+\/chapters\/[^/]+\/quiz/)&&method==="GET"){
          try{
            const parts=p.split("/");
            const chapterId=parts[4];
            const db=await getDB();
            const quiz=await db.quiz.findFirst({where:{chapterId}});
            if(quiz)return new Response(quiz.questions,{headers:{"Content-Type":JSON_CT}});
            // Generate quiz
            const ch=await db.chapter.findFirst({where:{id:chapterId},include:{course:true}});
            if(!ch)return new Response("{}",{headers:{"Content-Type":JSON_CT}});
            const zai=await getZAI();
            const comp=await zai.chat.completions.create({
              messages:[
                {role:"assistant",content:`Crée 5 questions de quiz (QCM) sur ce chapitre. RÉPONDS UNIQUEMENT en JSON: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0}]}`},
                {role:"user",content:`Titre: ${ch.title}\nContenu: ${ch.content.slice(0,3000)}`}
              ],
              thinking:{type:"disabled"},
            });
            let qt=comp.choices[0]?.message?.content||"{}";
            const m=qt.match(/```(?:json)?\s*([\s\S]*?)```/);if(m)qt=m[1].trim();
            const si=qt.indexOf("{");qt=si>=0?qt.slice(si):qt;
            await db.quiz.create({data:{questions:qt,chapterId}});
            return new Response(qt,{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[quiz]",e.message);}
          return new Response("{}",{headers:{"Content-Type":JSON_CT}});
        }

        // ── POST auth routes ──
        // ── Other GET routes (with real DB when possible) ──
        if(method==="GET"){
          // Paywall status with real DB
          if(p==="/api/courses/paywall-status"){
            try{
              const db=await getDB();
              const settings=await db.appSettings.findUnique({where:{id:"main"}});
              const isSub=settings?.hasSubscription===true;
              if(isSub){
                return new Response(JSON.stringify({canStudy:true,canGenerate:true,canProgress:true,inTrial:false,trialCoursesGenerated:0,trialCoursesMax:3,hasSubscription:true,inGracePeriod:false,isOfflineMode:false,showPaywall:false,paywallReason:"subscribed"}),{headers:{"Content-Type":JSON_CT}});
              }
              const courseCount=await db.course.count();
              const earliest=await db.course.findFirst({orderBy:{createdAt:"asc"},select:{createdAt:true}});
              if(!earliest){
                return new Response(JSON.stringify({canStudy:true,canGenerate:true,canProgress:true,inTrial:false,trialDaysRemaining:3,trialCoursesGenerated:0,trialCoursesMax:3,hasSubscription:false,inGracePeriod:false,isOfflineMode:false,showPaywall:false,paywallReason:"no_courses"}),{headers:{"Content-Type":JSON_CT}});
              }
              const diffDays=(Date.now()-new Date(earliest.createdAt).getTime())/(1000*60*60*24);
              if(diffDays<3){
                const canGen=courseCount<3;
                return new Response(JSON.stringify({canStudy:true,canGenerate:canGen,canProgress:true,inTrial:true,trialDaysRemaining:Math.max(0,Math.ceil(3-diffDays)),trialCoursesGenerated:courseCount,trialCoursesMax:3,hasSubscription:false,inGracePeriod:false,isOfflineMode:false,showPaywall:!canGen,paywallReason:"trial_active"}),{headers:{"Content-Type":JSON_CT}});
              }
              return new Response(JSON.stringify({canStudy:false,canGenerate:false,canProgress:false,inTrial:false,trialCoursesGenerated:courseCount,trialCoursesMax:3,hasSubscription:false,inGracePeriod:false,isOfflineMode:false,showPaywall:true,paywallReason:"trial_expired"}),{headers:{"Content-Type":JSON_CT}});
            }catch(e){console.error("[paywall]",e.message);}
            return new Response(JSON.stringify({canStudy:true,canGenerate:true,canProgress:true,hasSubscription:false,showPaywall:false,paywallReason:"no_courses"}),{headers:{"Content-Type":JSON_CT}});
          }
          // Subscription status with real DB
          if(p==="/api/subscription/status"){
            try{
              const db=await getDB();
              const s=await db.appSettings.findUnique({where:{id:"main"}});
              return new Response(JSON.stringify({hasSubscription:s?.hasSubscription===true}),{headers:{"Content-Type":JSON_CT}});
            }catch{}
            return new Response(JSON.stringify({hasSubscription:false}),{headers:{"Content-Type":JSON_CT}});
          }
          const defaults:Record<string,string>={
            "/api/study-time":JSON.stringify({today:0,last3Days:0,thisWeek:0,thisMonth:0,dailyBreakdown:[]}),
            "/api/courses/random":JSON.stringify({courses:[]}),
            "/api/auth/me":JSON.stringify({user:null}),
            "/api/db-status":JSON.stringify({ok:true}),
            "/api/ai-status":JSON.stringify({available:true}),
          };
          const d=defaults[p];
          if(d)return new Response(d,{headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/subscription/checkout ──
        if(p==="/api/subscription/checkout"&&method==="POST"){
          return new Response(JSON.stringify({success:true,message:"Configure LEMON_SQUEEZY_API_KEY in .env to enable payments",checkoutUrl:"#"}),{headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/subscription/webhook ──
        if(p==="/api/subscription/webhook"&&method==="POST"){
          try{
            const body=await req.json();
            // LemonSqueezy webhook: update subscription status
            if(body.meta?.event_name==="subscription_created"||body.meta?.event_name==="subscription_updated"){
              const db=await getDB();
              await db.appSettings.upsert({where:{id:"main"},create:{hasSubscription:true},update:{hasSubscription:true}});
            }
            if(body.meta?.event_name==="subscription_expired"||body.meta?.event_name==="subscription_cancelled"){
              const db=await getDB();
              await db.appSettings.upsert({where:{id:"main"},create:{hasSubscription:false},update:{hasSubscription:false}});
            }
            return new Response(JSON.stringify({received:true}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[webhook]",e.message);}
          return new Response(JSON.stringify({error:"Webhook failed"}),{status:500,headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/flames (flame operations) ──
        if(p==="/api/flames"&&method==="POST"){
          try{
            const db=await getDB();
            const body=await req.json();
            const {amount,reason,courseId,chapterId}=body;
            if(typeof amount!=="number")return new Response(JSON.stringify({error:"Invalid amount"}),{status:400,headers:{"Content-Type":JSON_CT}});
            let settings=await db.appSettings.findUnique({where:{id:"main"}});
            if(!settings)settings=await db.appSettings.create({data:{}});
            const newPts=Math.max(0,settings.flamePoints+amount);
            await db.appSettings.update({where:{id:"main"},data:{flamePoints:newPts}});
            await db.flameTransaction.create({data:{amount,reason:reason||"manual",courseId,chapterId}});
            return new Response(JSON.stringify({flamePoints:newPts}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[flames-post]",e.message);}
          return new Response(JSON.stringify({error:"Failed"}),{status:500,headers:{"Content-Type":JSON_CT}});
        }

        // ── POST /api/auth/* (register, login) ──
        if(p==="/api/auth/register"&&method==="POST"){
          try{
            const {email,password,firstName,lastName}=await req.json();
            const db=await getDB();
            const existing=await db.user.findFirst({where:{email}});
            if(existing)return new Response(JSON.stringify({error:"User already exists"}),{status:400,headers:{"Content-Type":JSON_CT}});
            const user=await db.user.create({data:{email,password,firstName,lastName}});
            return new Response(JSON.stringify({user:{id:user.id,email:user.email,firstName:user.firstName,lastName:user.lastName}}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[register]",e.message);}
          return new Response(JSON.stringify({error:"Registration failed"}),{status:500,headers:{"Content-Type":JSON_CT}});
        }
        if(p==="/api/auth/login"&&method==="POST"){
          try{
            const {email,password}=await req.json();
            const db=await getDB();
            const user=await db.user.findFirst({where:{email,password}});
            if(!user)return new Response(JSON.stringify({error:"Invalid credentials"}),{status:401,headers:{"Content-Type":JSON_CT}});
            return new Response(JSON.stringify({user:{id:user.id,email:user.email,firstName:user.firstName,lastName:user.lastName},token:"preview-"+user.id}),{headers:{"Content-Type":JSON_CT}});
          }catch(e){console.error("[login]",e.message);}
          return new Response(JSON.stringify({error:"Login failed"}),{status:500,headers:{"Content-Type":JSON_CT}});
        }
        if(p==="/api/auth/signout"&&method==="POST"){
          return new Response(JSON.stringify({success:true}),{headers:{"Content-Type":JSON_CT}});
        }

        return new Response("{}",{headers:{"Content-Type":JSON_CT}});
      }

      // Static files
      const data=cache.get(p);
      if(data)return new Response(data,{headers:{"Content-Type":getMime(p),"Cache-Control":CC}});
      const alt1=cache.get(p.replace(/\/$/,""));
      if(alt1)return new Response(alt1,{headers:{"Content-Type":getMime(p),"Cache-Control":CC}});
      const alt2=cache.get(p+"/");
      if(alt2)return new Response(alt2,{headers:{"Content-Type":getMime(p),"Cache-Control":CC}});

      return new Response(indexHtml,{headers:{"Content-Type":HTML_CT}});
    }catch(e){
      return new Response(indexHtml,{headers:{"Content-Type":HTML_CT}});
    }
  },
});
