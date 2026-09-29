const KEY="pmv_surwari_quizzes_v1",RESULTS="pmv_surwari_results_v1";
const demo=[{id:"demo1",title:"NMMS Demo Quiz • सामान्य विज्ञान",subject:"विज्ञान",time:10,questions:[
{question:"पौधों में भोजन बनाने की मुख्य प्रक्रिया क्या कहलाती है?",options:["श्वसन","प्रकाश संश्लेषण","वाष्पीकरण","पाचन"],answer:1,explanation:"पौधे प्रकाश ऊर्जा का उपयोग करके प्रकाश संश्लेषण द्वारा भोजन बनाते हैं।"},
{question:"जल का रासायनिक सूत्र क्या है?",options:["CO₂","O₂","H₂O","N₂"],answer:2,explanation:"जल दो हाइड्रोजन और एक ऑक्सीजन परमाणु से बना है।"},
{question:"मानव शरीर में रक्त को पंप करने वाला अंग कौन सा है?",options:["फेफड़ा","हृदय","यकृत","गुर्दा"],answer:1,explanation:"हृदय रक्त को पूरे शरीर में पंप करता है।"}]}];

const API=(window.PMV_API_URL||"").trim();
let quizzes=loadQuizzes(),current=null,qi=0,score=0,timer=null,timeLeft=0;

function loadQuizzes(){try{const x=localStorage.getItem(KEY);if(x)return JSON.parse(x)}catch(e){}localStorage.setItem(KEY,JSON.stringify(demo));return demo}
function saveQuizzes(x){localStorage.setItem(KEY,JSON.stringify(x))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function fmt(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}

function apiGet(action,payload={}){
  return new Promise((resolve,reject)=>{
    if(!API)return reject(new Error("Backend URL configured नहीं है।"));
    const cb="pmvcb_"+Date.now()+"_"+Math.floor(Math.random()*100000);
    const params=new URLSearchParams({action,callback:cb});
    Object.entries(payload||{}).forEach(([k,v])=>params.set(k,typeof v==="string"?v:JSON.stringify(v)));
    const script=document.createElement("script");let done=false;
    const timer=setTimeout(()=>{if(done)return;done=true;script.remove();try{delete window[cb]}catch(e){};reject(new Error("Backend timeout. Google Apps Script ने जवाब नहीं दिया।"))},60000);
    window[cb]=(data)=>{if(done)return;done=true;clearTimeout(timer);script.remove();try{delete window[cb]}catch(e){};resolve(data)};
    script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);script.remove();try{delete window[cb]}catch(e){};reject(new Error("Backend request failed"))};
    script.src=API+(API.includes("?")?"&":"?")+params.toString();document.head.appendChild(script);
  })
}
async function api(action,payload={}){return apiGet(action,payload)}

document.querySelectorAll("[data-section]").forEach(b=>b.addEventListener("click",()=>showSection(b.dataset.section)));
document.querySelectorAll(".subject button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.subject){showSection("quiz");renderQuizList(b.dataset.subject)}}));
document.getElementById("adminOpen").addEventListener("click",()=>showSection("admin"));

async function showSection(id){
 document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
 const el=document.getElementById(id);if(el)el.classList.add("active");
 window.scrollTo({top:0,behavior:"smooth"});
 if(id==="quiz")await renderQuizList();if(id==="progress")renderProgress();
}

async function getOnlineQuizzes(){
 try{const r=await api("listQuizzes");if(r&&r.ok&&Array.isArray(r.quizzes)){quizzes=r.quizzes;saveQuizzes(quizzes);return quizzes}}catch(e){console.warn(e)}
 return loadQuizzes()
}

async function renderQuizList(filter=""){
 quizzes=await getOnlineQuizzes();
 const el=document.getElementById("quizList");
 el.innerHTML=quizzes.filter(q=>!filter||q.subject===filter).map(q=>
 `<div class="quiz-card"><h3>${esc(q.title)}</h3><p>विषय: ${esc(q.subject)} • ${q.questions.length} प्रश्न • ${q.time||10} मिनट</p><button onclick="startQuiz('${esc(q.id)}')">Quiz शुरू करें →</button></div>`
 ).join("")||"<div class='quiz-card'><h3>अभी कोई quiz नहीं</h3><p>Admin Panel से नया quiz जोड़ें।</p></div>";
 document.getElementById("quizPlayer").classList.add("hidden");
}

async function startQuiz(id){
 current=(await getOnlineQuizzes()).find(q=>q.id===id);if(!current)return;
 qi=0;score=0;timeLeft=(current.time||10)*60;
 document.getElementById("quizList").classList.add("hidden");document.getElementById("quizPlayer").classList.remove("hidden");
 clearInterval(timer);timer=setInterval(()=>{timeLeft--;if(timeLeft<=0){clearInterval(timer);finishQuiz()}},1000);renderQuestion()
}
function renderQuestion(){
 const q=current.questions[qi],p=Math.round((qi/current.questions.length)*100);
 document.getElementById("quizPlayer").innerHTML=`<div class="q-progress">प्रश्न ${qi+1}/${current.questions.length} • ${fmt(timeLeft)} • ${p}%</div><h2>${esc(q.question)}</h2>`+
 q.options.map((o,i)=>`<label class="q-option"><input type="radio" name="ans" value="${i}"> ${esc(o)}</label>`).join("")+
 `<button class="primary" onclick="nextQuestion()">${qi===current.questions.length-1?"Result देखें":"अगला प्रश्न →"}</button>`;
}
function nextQuestion(){
 const c=document.querySelector('input[name="ans"]:checked');if(!c){alert("कृपया एक उत्तर चुनें।");return}
 if(Number(c.value)===current.questions[qi].answer)score++;qi++;if(qi>=current.questions.length)finishQuiz();else renderQuestion()
}
async function finishQuiz(){
 clearInterval(timer);const total=current.questions.length,pct=Math.round(score*100/total);
 const result={quizId:current.id,title:current.title,score,total,pct,date:new Date().toISOString()};
 const results=JSON.parse(localStorage.getItem(RESULTS)||"[]");results.push(result);localStorage.setItem(RESULTS,JSON.stringify(results.slice(-50)));
 let saved=false;try{const r=await api("saveResult",{result});saved=!!r?.ok}catch(e){}
 document.getElementById("quizPlayer").innerHTML=`<div class="result"><h2>🎉 Quiz पूरा हुआ</h2><h1>${score} / ${total}</h1><h2>${pct}%</h2><p>आपने ${total} में से ${score} प्रश्न सही किए।</p><p>${saved?"✅ Result online save हो गया।":"⚠️ Result इस device पर save हुआ।"}</p><button class="primary" onclick="showSection('quiz')">अन्य Quiz देखें</button></div>`;
}
function renderProgress(){
 const a=JSON.parse(localStorage.getItem(RESULTS)||"[]"),el=document.getElementById("progressBox");
 if(!a.length){el.innerHTML="<h3>अभी कोई quiz result नहीं है।</h3>";return}
 el.innerHTML=`<h3>हाल के परिणाम</h3>`+a.slice().reverse().map(x=>`<p><b>${esc(x.title)}</b> — ${x.score}/${x.total} (${x.pct}%) — ${esc(new Date(x.date).toLocaleString("hi-IN"))}</p>`).join("")
}

function adminLogin(){
 if(document.getElementById("adminPin").value==="1234"){document.getElementById("adminLogin").classList.add("hidden");document.getElementById("adminPanel").classList.remove("hidden");renderAdmin()}
 else alert("गलत PIN")
}
function logoutAdmin(){document.getElementById("adminLogin").classList.remove("hidden");document.getElementById("adminPanel").classList.add("hidden")}
function showAIForm(){document.getElementById("aiQuizForm").classList.remove("hidden");document.getElementById("quizForm").classList.add("hidden")}
function showQuizForm(){document.getElementById("quizForm").classList.toggle("hidden");document.getElementById("aiQuizForm").classList.add("hidden")}

async function generateAIQuiz(){
 const topic=document.getElementById("aiTopic").value.trim(),subject=document.getElementById("aiSubject").value;
 const count=Math.min(20,Math.max(1,Number(document.getElementById("aiCount").value)||10));
 const difficulty=document.getElementById("aiDifficulty").value,language=document.getElementById("aiLanguage").value;
 const className=document.getElementById("aiClass").value,time=Number(document.getElementById("aiTime").value)||10;
 const status=document.getElementById("aiStatus"),btn=document.getElementById("aiGenerateBtn");
 if(!topic){alert("पहले Topic / Chapter लिखें।");return}
 status.textContent="⏳ AI प्रश्न बना रहा है... कृपया 30–60 सेकंड प्रतीक्षा करें।";btn.disabled=true;
 try{
   const r=await api("generateQuiz",{pin:document.getElementById("adminPin").value,topic,subject,count,difficulty,language,className,time});
   if(!r?.ok)throw new Error(r?.error||"AI Quiz generate नहीं हुआ");
   status.textContent=`✅ ${r.quiz.questions.length} प्रश्न वाला quiz save हो गया।`;
   document.getElementById("aiTopic").value="";
   await renderAdmin();await renderQuizList();
 }catch(e){status.textContent="❌ "+e.message;alert("AI Quiz नहीं बन पाया:\n"+e.message)}
 finally{btn.disabled=false}
}

async function saveQuiz(){
 try{
  const questions=JSON.parse(document.getElementById("qJson").value);
  if(!Array.isArray(questions)||!questions.length)throw Error("Questions JSON गलत है");
  questions.forEach(q=>{if(!q.question||!Array.isArray(q.options)||q.options.length!==4||typeof q.answer!=="number")throw Error("हर प्रश्न में question, 4 options और numeric answer जरूरी है")});
  const q={id:"q"+Date.now(),title:document.getElementById("qTitle").value||"नया Quiz",subject:document.getElementById("qSubject").value,time:Number(document.getElementById("qTime").value)||10,questions};
  const r=await api("addQuiz",{pin:document.getElementById("adminPin").value,quiz:q});if(!r?.ok)throw Error(r?.error||"Server error");
  document.getElementById("qJson").value="";document.getElementById("quizForm").classList.add("hidden");await renderAdmin();await renderQuizList();alert("Quiz save हो गया।")
 }catch(e){alert("Quiz save नहीं हुआ: "+e.message)}
}
async function renderAdmin(){
 const arr=await getOnlineQuizzes();
 document.getElementById("adminQuizList").innerHTML=arr.map(q=>`<div class="admin-card" style="margin:10px 0"><b>${esc(q.title)}</b><p>${esc(q.subject)} • ${q.questions.length} प्रश्न</p><button onclick="deleteQuiz('${esc(q.id)}')">Delete</button></div>`).join("")
}
async function deleteQuiz(id){
 if(!confirm("क्या यह quiz हटाना है?"))return;
 try{const r=await api("deleteQuiz",{pin:document.getElementById("adminPin").value,id});if(!r?.ok){alert(r?.error||"Delete failed");return};await renderAdmin();await renderQuizList()}catch(e){alert(e.message)}
}
function exportData(){const b=new Blob([JSON.stringify(loadQuizzes(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="pmv-surwari-quizzes-backup.json";a.click();URL.revokeObjectURL(a.href)}
function importData(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d))throw Error();saveQuizzes(d);renderAdmin();renderQuizList();alert("Backup import हो गया।")}catch(x){alert("Backup file सही नहीं है।")}};r.readAsText(f)}

renderQuizList();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=5").catch(()=>{}));