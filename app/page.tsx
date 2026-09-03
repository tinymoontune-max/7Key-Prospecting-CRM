"use client";

import {useEffect,useMemo,useState} from "react";
import {
  Radar,Users,Trash2,Archive,Plus,Search,ShieldCheck,Mail,Smartphone,
  Send,RefreshCw,Wifi,WifiOff,Copy,Sparkles,CheckCircle2,AlertTriangle,
  ExternalLink,Database
} from "lucide-react";

type WhatsAppStatus="Unknown"|"Verified"|"Not available";
type VerificationStatus="Verified"|"Needs verification"|"Not contactable";

type EnrichmentPayload={
  company:string; city:string; country:string; niche:string; phone:string; email:string;
  website:string; wikidata?:string; source?:string; id?:string;
};

type Prospect={
  id:string; company:string; niche:string; country:string; city:string; email:string; phone:string;
  website:string; whatsapp:WhatsAppStatus; status:string; issue:string; score:number; source:string;
  subject?:string; message?:string; approval_status?:string;
  verification_status?:VerificationStatus; confidence?:number; safe_to_outreach?:boolean;
  evidence?:string[]; provenance?:Record<string,string>; discovery_notes?:string[];
  enrichment_payload?:EnrichmentPayload; wikidata?:string; contactable?:boolean; enriched_at?:string;
  email_history?:string[]; bounced_emails?:string[]; last_sent_email?:string;
  email_status?:string; bounce_reason?:string; bounced_at?:string;
};

const N8N={
  prospect:"http://localhost:5678/webhook/7key/prospect",
  sendApproved:"http://localhost:5678/webhook/7key/send-approved",
  whatsappLead:"http://localhost:5678/webhook/7key/whatsapp-lead",
  finder:"http://localhost:5678/webhook/7key/find-prospects",
  enrich:"http://localhost:5678/webhook/7key/enrich-prospect",
  emailEvents:"http://localhost:5678/webhook/7key/email-events"
};

const STORE="7key-v4.3";
const OLD_STORE="7key-v4.2";
const defaultNiches=["Roofing","Remodeling","Painting","Landscaping","Construction","Cleaning","Plumbing","HVAC"];
const defaultCountries=["USA","Canada","UK","France","Belgium","Switzerland","Morocco","Germany","Spain","Netherlands"];

function makeId(){return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`}
function digits(v:string){return (v||"").replace(/\D/g,"")}
function normalizeProspect(p:any):Prospect{
  return {
    id:p.id||makeId(), company:p.company||"Unknown business", niche:p.niche||"", country:p.country||"", city:p.city||"",
    email:p.email||"", phone:p.phone||"", website:p.website||"", whatsapp:(p.whatsapp||"Unknown") as WhatsAppStatus,
    status:p.status||"New", issue:p.issue||"Needs qualification", score:Number(p.score??50), source:p.source||"Manual",
    subject:p.subject||"", message:p.message||"", approval_status:p.approval_status||"",
    verification_status:(p.verification_status||"Needs verification") as VerificationStatus,
    confidence:Number(p.confidence??0), safe_to_outreach:Boolean(p.safe_to_outreach), evidence:Array.isArray(p.evidence)?p.evidence:[],
    provenance:p.provenance||{}, discovery_notes:Array.isArray(p.discovery_notes)?p.discovery_notes:[],
    enrichment_payload:p.enrichment_payload, wikidata:p.wikidata||"", contactable:Boolean(p.contactable), enriched_at:p.enriched_at||"",
    email_history:Array.isArray(p.email_history)?p.email_history:[],
    bounced_emails:Array.isArray(p.bounced_emails)?p.bounced_emails:[],
    last_sent_email:p.last_sent_email||"",
    email_status:p.email_status||"",
    bounce_reason:p.bounce_reason||"",
    bounced_at:p.bounced_at||""
  };
}

async function postJson(url:string,body:any,timeout=20000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
    const text=await r.text();
    if(!r.ok) throw new Error(text||`HTTP ${r.status}`);
    try{return text?JSON.parse(text):{}}catch{return {raw:text}}
  } finally {clearTimeout(timer)}
}

// n8n can return either a plain object or an array containing the response object.
// Normalize both shapes so CRM actions work with test/production webhook responses.
function unwrapN8nResponse(data:any){
  let value=data;
  while(Array.isArray(value)&&value.length===1) value=value[0];
  return value&&typeof value==="object"?value:{};
}

export default function Home(){
 const [ps,setPs]=useState<Prospect[]>([]);
 const [q,setQ]=useState("");
 const [niche,setNiche]=useState("Remodeling");
 const [country,setCountry]=useState("USA");
 const [city,setCity]=useState("");
 const [cn,setCn]=useState("");
 const [cc,setCc]=useState("");
 const [ns,setNs]=useState(defaultNiches);
 const [cs,setCs]=useState(defaultCountries);
 const [busy,setBusy]=useState<string|null>(null);
 const [n8n,setN8n]=useState<"online"|"offline"|"checking">("checking");
 const [finderLimit,setFinderLimit]=useState(10);
 const [finderMsg,setFinderMsg]=useState("");
 const [filter,setFilter]=useState<"All"|VerificationStatus>("All");

 useEffect(()=>{
   try{
     const current=localStorage.getItem(STORE);
     const legacy=localStorage.getItem(OLD_STORE);
     const raw=JSON.parse(current||legacy||"[]");
     setPs(Array.isArray(raw)?raw.map(normalizeProspect):[]);
   }catch{}
 },[]);
 useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify(ps))}catch{}},[ps]);

 async function syncEmailEvents(showResult=false){
   try{
     const raw=await postJson(N8N.emailEvents,{},20000);
     const data=unwrapN8nResponse(raw);
     const events=Array.isArray(data.events)?data.events:[];
     if(!events.length){
       if(showResult) alert("Email sync: no new bounce found.");
       return;
     }

     const matchedProspectIds=new Set<string>();
     for(const p of ps){
       const known=[
         p.email,
         p.last_sent_email,
         ...(Array.isArray(p.email_history)?p.email_history:[]),
         ...(Array.isArray(p.bounced_emails)?p.bounced_emails:[])
       ].filter(Boolean).map(x=>String(x).toLowerCase());

       for(const ev of events){
         if(ev?.event!=="bounce"||!ev?.bounced_email) continue;
         const bounced=String(ev.bounced_email).toLowerCase();
         if(known.includes(bounced)) matchedProspectIds.add(p.id);
       }
     }
     const matched=matchedProspectIds.size;

     setPs(prev=>prev.map(p=>{
       let next={...p};
       for(const ev of events){
         if(ev?.event!=="bounce"||!ev?.bounced_email) continue;
         const bounced=String(ev.bounced_email).toLowerCase();
         const known=[
           p.email,
           p.last_sent_email,
           ...(Array.isArray(p.email_history)?p.email_history:[]),
           ...(Array.isArray(p.bounced_emails)?p.bounced_emails:[])
         ].filter(Boolean).map(x=>String(x).toLowerCase());

         if(!known.includes(bounced)) continue;

         const bouncedEmails=[...new Set([...(p.bounced_emails||[]),bounced])];
         const currentIsBounced=String(p.email||"").toLowerCase()===bounced;

         next={
           ...next,
           bounced_emails:bouncedEmails,
           email_status:currentIsBounced?"Bounced":(next.email_status||""),
           bounce_reason:ev.bounce_reason||next.bounce_reason||"",
           bounced_at:ev.detected_at||new Date().toISOString(),
           ...(currentIsBounced?{
             safe_to_outreach:false,
             verification_status:"Needs verification",
             status:"Bounced",
             approval_status:"bounced"
           }:{})
         };
       }
       return next;
     }));

     setN8n("online");
     if(showResult) alert("Email sync complete: "+events.length+" bounce event(s), "+matched+" prospect match(es).");
   }catch(err){
     setN8n("offline");
     if(showResult) alert("Email sync error: "+(err?.message||err));
   }
 }

 useEffect(()=>{
   const t=setInterval(()=>syncEmailEvents(false),60000);
   return ()=>clearInterval(t);
 },[]);

 function showOutreachSummary(){
   const total=ps.length;
   const sent=ps.filter(p=>Boolean(p.last_sent_email)||p.status==="Sent"||p.status==="Bounced").length;
   const delivered=ps.filter(p=>p.status==="Sent"||p.email_status==="Sent").length;
   const bounced=ps.filter(p=>p.status==="Bounced"||p.email_status==="Bounced"||(p.bounced_emails||[]).length>0).length;
   const failed=ps.filter(p=>p.status==="Send failed"||p.approval_status==="failed").length;
   const verified=ps.filter(p=>p.verification_status==="Verified").length;
   const ready=ps.filter(p=>Boolean(p.subject&&p.message)).length;
   const safe=ps.filter(p=>p.safe_to_outreach===true).length;

   const lines=ps
     .filter(p=>Boolean(p.last_sent_email)||p.status==="Sent"||p.status==="Bounced"||p.status==="Send failed")
     .map(p=>{
       const email=p.last_sent_email||p.email||"no email";
       const result=p.status==="Bounced"||p.email_status==="Bounced"
         ?"BOUNCED"
         :p.status==="Send failed"||p.approval_status==="failed"
           ?"FAILED"
           :"SENT";
       return "• "+p.company+" | "+email+" | "+result;
     });

   const details=lines.length
     ? lines.join("\n")
     : "No send results recorded yet.";

   alert(
     "7Key Outreach Summary\n\n"+
     "Total prospects: "+total+"\n"+
     "Emails sent/attempted: "+sent+"\n"+
     "Currently Sent: "+delivered+"\n"+
     "Bounced: "+bounced+"\n"+
     "Send failed: "+failed+"\n"+
     "Verified: "+verified+"\n"+
     "Drafts ready: "+ready+"\n"+
     "Safe to outreach: "+safe+"\n\n"+
     "SEND RESULTS\n"+
     details
   );
 }

 const update=(id:string,patch:Partial<Prospect>)=>setPs(prev=>prev.map(p=>p.id===id?{...p,...patch}:p));
 const valid=(p:Prospect)=>{
   const e:string[]=[]; const w:string[]=[];
   if(!p.company.trim()) e.push("Company missing");
   if(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) e.push("Invalid email");
   if(p.website&&!/^https?:\/\//i.test(p.website)) w.push("Website should start with http:// or https://");
   if(p.whatsapp==="Verified"&&!p.phone) e.push("WhatsApp verified but phone missing");
   if(ps.some(x=>x.id!==p.id&&((p.email&&x.email&&p.email.toLowerCase()===x.email.toLowerCase())||(p.phone&&x.phone&&digits(p.phone)===digits(x.phone))))) e.push("Duplicate email or phone");
   if(!Number.isFinite(p.score)||p.score<0||p.score>100) e.push("Score out of range");
   return {e,w,state:e.length?"BLOCKED":w.length?"WARNING":"TECH OK"};
 };

 async function checkN8n(){
   setN8n("checking");
   try{
     await postJson(N8N.prospect,{company:"Health Check",niche:"Test",country:"Local",city:"",email:"",phone:"",website:"",issue:"health-check",score:0},7000);
     setN8n("online");
   }catch{setN8n("offline")}
 }

 async function findProspects(){
   if(!city.trim()) return alert("Enter a city/region first");
   setBusy("finder"); setFinderMsg("Searching...");
   try{
     const raw=await postJson(N8N.finder,{country,city,niche,limit:finderLimit},35000);
     const data=unwrapN8nResponse(raw);
     const found:Array<any>=Array.isArray(data.prospects)?data.prospects:Array.isArray(data)?data:[];
     let added=0,skipped=0;
     setPs(prev=>{
       const next=[...prev];
       for(const f of found){
         const duplicate=next.some(x=>(f.id&&x.id===f.id)||(f.email&&x.email&&f.email.toLowerCase()===x.email.toLowerCase())||(f.phone&&x.phone&&digits(f.phone)===digits(x.phone))||(x.company.toLowerCase()===String(f.company||"").toLowerCase()&&x.city.toLowerCase()===String(f.city||"").toLowerCase()));
         if(duplicate){skipped++;continue;}
         next.unshift(normalizeProspect({...f,verification_status:f.verification_status||"Needs verification",safe_to_outreach:Boolean(f.safe_to_outreach),enrichment_payload:f.enrichment_payload||{
           company:f.company||"",city:f.city||city,country:f.country||country,niche:f.niche||niche,phone:f.phone||"",email:f.email||"",website:f.website||"",wikidata:f.wikidata||"",source:f.source||"OpenStreetMap",id:f.id
         }}));
         added++;
       }
       return next;
     });
     setFinderMsg(`${added} added · ${skipped} duplicate(s) skipped · ${found.length} returned`);
     setN8n("online");
   }catch(err:any){setN8n("offline");setFinderMsg("Finder error");alert("Finder error: "+(err?.message||err))}
   finally{setBusy(null)}
 }

 async function enrichProspect(p:Prospect){
   const c=valid(p); if(c.state==="BLOCKED") return alert("Prospect blocked: "+c.e.join(", "));
   setBusy(p.id+":enrich");
   try{
     const payload:EnrichmentPayload=p.enrichment_payload||{company:p.company,city:p.city,country:p.country,niche:p.niche,phone:p.phone,email:p.email,website:p.website,wikidata:p.wikidata||"",source:p.source,id:p.id};
     const raw=await postJson(N8N.enrich,{...payload,company:p.company,city:p.city,country:p.country,niche:p.niche,phone:p.phone,email:p.email,website:p.website,wikidata:p.wikidata||payload.wikidata||"",source:p.source,id:p.id},25000);
     const data=unwrapN8nResponse(raw);
     update(p.id,{
       website:data.website||p.website,
       email:data.email||p.email,
       email_history:[
         ...new Set([
           ...(p.email_history||[]),
           ...(p.email?[p.email]:[]),
           ...(data.email?[data.email]:[])
         ].map(x=>String(x).toLowerCase()))
       ],
       phone:data.phone||p.phone,
       verification_status:(data.verification_status||"Needs verification") as VerificationStatus,
       confidence:Number(data.confidence??0),safe_to_outreach:Boolean(data.safe_to_outreach),contactable:Boolean(data.contactable),
       evidence:Array.isArray(data.evidence)?data.evidence:[],provenance:data.provenance||{},discovery_notes:Array.isArray(data.discovery_notes)?data.discovery_notes:[],
       enriched_at:data.enriched_at||new Date().toISOString(),status:data.safe_to_outreach?"Verified":"Needs verification",
       issue:data.safe_to_outreach?(p.issue||"Verified prospect"):(data.notes||p.issue||"Needs verification")
     });
     setN8n("online");
   }catch(err:any){setN8n("offline");alert("Enrichment error: "+(err?.message||err))}
   finally{setBusy(null)}
 }

 async function generateDraft(p:Prospect){
   const c=valid(p); if(c.state==="BLOCKED") return alert("Prospect blocked: "+c.e.join(", "));
   if(!p.contactable && !p.email) return alert("Email missing or prospect not contactable.");
   setBusy(p.id+":draft");
   try{
     const raw=await postJson(N8N.prospect,{company:p.company,niche:p.niche,country:p.country,city:p.city,email:p.email,phone:p.phone,website:p.website,issue:p.issue,score:p.score,verification_status:p.verification_status,confidence:p.confidence},20000);
     const data=unwrapN8nResponse(raw);
     update(p.id,{subject:data.subject,message:data.message,approval_status:data.approval_status||"pending",status:"Qualified"});
     setN8n("online");
   }catch(err:any){setN8n("offline");alert("n8n error: "+(err?.message||err))}
   finally{setBusy(null)}
 }

 function verifyProspect(p:Prospect){
   const c=valid(p);
   if(c.state==="BLOCKED") return alert("Prospect blocked: "+c.e.join(", "));
   if(!p.enriched_at||(!p.contactable && !p.email))
    return alert("Enrich this prospect first and make sure a valid email is available.");
   const ok=confirm(`Verify ${p.company}?\n\nConfirm that you reviewed the public contact details/website and that a personalized outreach is relevant. This will unlock Approve & Send.`);
   if(!ok) return;
   update(p.id,{
     verification_status:"Verified",
     safe_to_outreach:true,
     status:"Verified",
     evidence:[...(p.evidence||[]),"Human verification approved in CRM"]
   });
 }

 async function approveSend(p:Prospect){
   const c=valid(p); if(c.state==="BLOCKED") return alert("Prospect blocked: "+c.e.join(", "));
   if(!p.safe_to_outreach||p.verification_status!=="Verified") return alert("Send blocked: prospect must be Verified and safe_to_outreach=true.");
   if(!p.email) return alert("Email missing");
   if((p.bounced_emails||[]).map(x=>x.toLowerCase()).includes(p.email.toLowerCase()))
     return alert("Send blocked: this email address previously bounced.");
   if(!p.subject||!p.message) return alert("Generate the draft first");
   if(!confirm(`Send email to ${p.email}?`)) return;
   setBusy(p.id+":send");
   try{
    const raw=await postJson(
      N8N.sendApproved,
      {
        approved:true,
        email:p.email,
        subject:p.subject,
        message:p.message,
        company:p.company,
        prospect_id:p.id
      },
      20000
    );
    
    const data=unwrapN8nResponse(raw);
    
    if(data.ok!==true || data.status!=="sent"){
      const reason=
        data.reason||
        data.message||
        data.error||
        "n8n did not confirm that Gmail sent the message";
    
      update(p.id,{
        status:"Send failed",
        approval_status:"failed"
      });
    
      throw new Error(reason);
    }
    
    update(p.id,{
      status:"Sent",
      approval_status:"approved",
      last_sent_email:p.email,
      email_history:[
        ...new Set([...(p.email_history||[]),p.email].filter(Boolean).map(x=>String(x).toLowerCase()))
      ],
      email_status:"Sent"
    });
    
    setN8n("online");
   }catch(err:any){setN8n("offline");alert("Send error: "+(err?.message||err))}
   finally{setBusy(null)}
 }

 async function notifyWhatsApp(p:Prospect){
   if(!p.safe_to_outreach||p.verification_status!=="Verified") return alert("WhatsApp notice blocked until the prospect is Verified.");
   if(!p.phone) return alert("Phone missing");
   setBusy(p.id+":wa");
   try{
     await postJson(N8N.whatsappLead,{notifyEmail:"digital7key@gmail.com",company:p.company,country:p.country,phone:p.phone,site:p.website,score:p.score,issue:p.issue,message:p.message||`Hi ${p.company}, I noticed an opportunity to improve your online presence. I can prepare a free homepage concept. Would you like to see it?`},20000);
     update(p.id,{status:"Queued"}); setN8n("online");
   }catch(err:any){setN8n("offline");alert("WhatsApp notification error: "+(err?.message||err))}
   finally{setBusy(null)}
 }

 const add=()=>setPs(prev=>[normalizeProspect({id:makeId(),company:"New prospect",niche,country,city,email:"",phone:"",website:"",whatsapp:"Unknown",status:"New",issue:"Needs qualification",score:70,source:"Manual"}),...prev]);
 const rows=useMemo(()=>ps.filter(p=>(filter==="All"||p.verification_status===filter)&&JSON.stringify(p).toLowerCase().includes(q.toLowerCase())),[ps,q,filter]);
 const stats=useMemo(()=>({total:ps.length,verified:ps.filter(p=>p.verification_status==="Verified").length,needs:ps.filter(p=>p.verification_status==="Needs verification").length,sent:ps.filter(p=>p.status==="Sent").length}),[ps]);

 return <main>
 <aside><h2>7KeySolutions</h2><span>CRM v4.3.6 · Outreach Summary</span><nav><b><Radar/> Prospect Finder</b><b><Users/> Prospects</b><b><Sparkles/> Enrichment</b><b><Mail/> Email Queue</b><b><Smartphone/> WhatsApp</b><b><ShieldCheck/> Safety</b></nav></aside>
 <section>
 <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:10}}>
   <button onClick={showOutreachSummary} disabled={busy!==null}>
     Outreach summary
   </button>
   <button onClick={()=>syncEmailEvents(true)} disabled={busy!==null}>
     <RefreshCw/> Sync email events
   </button>
 </div>
 <header><div><small>7KEY SALES ENGINE</small><h1>CRM + n8n</h1></div><div className="headActions"><button className="ghost" onClick={checkN8n}>{n8n==="online"?<Wifi/>:n8n==="offline"?<WifiOff/>:<RefreshCw/>}{n8n}</button><button onClick={add}><Plus/> Add prospect</button></div></header>

 <div className="stats"><div><b>{stats.total}</b><span>Total</span></div><div><b>{stats.verified}</b><span>Verified</span></div><div><b>{stats.needs}</b><span>Needs verify</span></div><div><b>{stats.sent}</b><span>Sent</span></div></div>

 <div className="grid">
  <div className="card">
   <h3>Live Prospect Finder</h3>
   <label>Country<select value={country} onChange={e=>setCountry(e.target.value)}>{cs.map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="add"><input placeholder="Add country" value={cc} onChange={e=>setCc(e.target.value)}/><button onClick={()=>{if(cc.trim()){setCs([...new Set([...cs,cc.trim()])]);setCountry(cc.trim());setCc("")}}}>+</button></div>
   <label>Niche<select value={niche} onChange={e=>setNiche(e.target.value)}>{ns.map(x=><option key={x}>{x}</option>)}</select></label>
   <div className="add"><input placeholder="Add niche" value={cn} onChange={e=>setCn(e.target.value)}/><button onClick={()=>{if(cn.trim()){setNs([...new Set([...ns,cn.trim()])]);setNiche(cn.trim());setCn("")}}}>+</button></div>
   <label>City / Region<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Corpus Christi"/></label>
   <label>Limit<input type="number" min="1" max="25" value={finderLimit} onChange={e=>setFinderLimit(Math.max(1,Math.min(25,Number(e.target.value)||10)))}/></label>
   <button className="finderBtn" disabled={busy!==null} onClick={findProspects}><Search/> {busy==="finder"?"Finding...":"Find real prospects"}</button>
   <div className="notice">{finderMsg||"Workflow 05 finds prospects. Workflow 06 verifies them before outreach."}</div>
  </div>
  <div className="card"><h3>n8n endpoints</h3><code>{N8N.finder}</code><code>{N8N.enrich}</code><code>{N8N.prospect}</code><code>{N8N.sendApproved}</code><code>{N8N.whatsappLead}</code><p className="muted">Expected production setup: Finder 05 v1.2 + Enrichment 06 v2.2.</p></div>
 </div>

 <div className="card"><div className="tools"><div><Search/><input placeholder="Search prospects..." value={q} onChange={e=>setQ(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value as any)}><option>All</option><option>Verified</option><option>Needs verification</option><option>Not contactable</option></select></div><button className="danger" onClick={()=>{if(confirm("Delete all prospects?"))setPs([])}}><Trash2/> Clear all</button></div>
 <div className="table">{rows.length===0?<div className="empty">No prospects in this view.</div>:rows.map(p=>{const v=valid(p);const ready=p.verification_status==="Verified"&&p.safe_to_outreach;return <div className="row" key={p.id}>
  <div className="fields"><input value={p.company} onChange={e=>update(p.id,{company:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})}/><input value={p.email} onChange={e=>update(p.id,{email:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})} placeholder="email"/><input value={p.phone} onChange={e=>update(p.id,{phone:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})} placeholder="phone"/><select value={p.whatsapp} onChange={e=>update(p.id,{whatsapp:e.target.value as WhatsAppStatus})}><option>Unknown</option><option>Verified</option><option>Not available</option></select><input value={p.website} onChange={e=>update(p.id,{website:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})} placeholder="https://..."/></div>
  <div className="fields second"><input value={p.niche} onChange={e=>update(p.id,{niche:e.target.value})}/><input value={p.city} onChange={e=>update(p.id,{city:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})}/><input value={p.country} onChange={e=>update(p.id,{country:e.target.value,safe_to_outreach:false,verification_status:"Needs verification"})}/><input value={p.issue} onChange={e=>update(p.id,{issue:e.target.value})}/><input type="number" min="0" max="100" value={p.score} onChange={e=>update(p.id,{score:Number(e.target.value)})}/></div>
  <div className="statusLine"><div className={"check "+(v.state==="BLOCKED"?"blocked":v.state==="WARNING"?"warning":"valid")}><b>{v.state}</b> {[...v.e,...v.w].join(" · ")}</div><div className={"verifyBadge "+(ready?"ready":"needs")}>{ready?<CheckCircle2/>:<AlertTriangle/>}{p.verification_status||"Needs verification"} · confidence {p.confidence??0}%</div></div>
  {(p.evidence?.length||p.discovery_notes?.length)?<details className="evidence"><summary><Database/> Verification evidence</summary>{p.evidence?.map((x,i)=><div key={'e'+i}>✓ {x}</div>)}{p.discovery_notes?.map((x,i)=><div key={'d'+i}>• {x}</div>)}</details>:null}
  {p.subject&&<div className="draft"><div className="draftHead"><b>{p.subject}</b><button className="ghost" onClick={()=>navigator.clipboard.writeText(p.message||"")}><Copy/> Copy</button></div><textarea value={p.message||""} onChange={e=>update(p.id,{message:e.target.value})}/></div>}
  <div className="meta">{p.source} · {p.niche} · {p.city} {p.country} · score {p.score} · status {p.status}{p.enriched_at?` · enriched ${new Date(p.enriched_at).toLocaleString()}`:""}</div>
  <div className="acts"><button className="enrichBtn" disabled={busy!==null||v.state==="BLOCKED"} onClick={()=>enrichProspect(p)}><Sparkles/>{busy===p.id+":enrich"?"Enriching...":"Enrich prospect"}</button><button disabled={busy!==null||v.state==="BLOCKED"||(!p.contactable && !p.email)} onClick={()=>generateDraft(p)}><RefreshCw/>Generate draft</button><button disabled={busy!==null||v.state==="BLOCKED"||!p.enriched_at||(!p.contactable && !p.email)||ready} onClick={()=>verifyProspect(p)}><ShieldCheck/>{ready?"Verified":"Verify prospect"}</button><button disabled={busy!==null||v.state==="BLOCKED"||!p.subject||!ready} onClick={()=>approveSend(p)}><Send/>Approve & Send</button><button disabled={busy!==null||!p.phone||!ready} onClick={()=>notifyWhatsApp(p)}><Smartphone/>WhatsApp notice</button>{p.website&&<a className="linkBtn" href={p.website} target="_blank" rel="noreferrer"><ExternalLink/>Website</a>}<button className="ghost" onClick={()=>update(p.id,{status:"Archived"})}><Archive/>Archive</button><button className="danger" onClick={()=>{if(confirm("Delete this prospect?"))setPs(prev=>prev.filter(x=>x.id!==p.id))}}><Trash2/>Delete</button></div>
 </div>})}</div></div>
 </section></main>
}
