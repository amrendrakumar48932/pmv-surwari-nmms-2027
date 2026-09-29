/***** PMV SURWARI NMMS 2027 — FREE GOOGLE SHEETS + GEMINI BACKEND *****/
const ADMIN_PIN = "1234";
const QUIZ_SHEET = "Quizzes";
const RESULT_SHEET = "Results";
const GEMINI_MODEL = "gemini-3.5-flash";

function setupSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let q=ss.getSheetByName(QUIZ_SHEET),r=ss.getSheetByName(RESULT_SHEET);
  if(!q)q=ss.insertSheet(QUIZ_SHEET);if(!r)r=ss.insertSheet(RESULT_SHEET);
  if(q.getLastRow()===0)q.appendRow(["ID","Title","Subject","Time","Questions","Created"]);
  if(r.getLastRow()===0)r.appendRow(["Date","Quiz ID","Quiz Title","Score","Total","Percentage"]);
}

/* Run this once from the Apps Script editor to save your Gemini API key securely.
   It asks for the key in a dialog and stores it in Script Properties. */
function setGeminiApiKey(){
  const ui=SpreadsheetApp.getUi();
  const result=ui.prompt("Gemini API Key","अपनी Gemini API key यहाँ paste करें:",ui.ButtonSet.OK_CANCEL);
  if(result.getSelectedButton()===ui.Button.OK){
    PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY",result.getResponseText().trim());
    ui.alert("Gemini API key सुरक्षित रूप से save हो गई।");
  }
}

function doGet(e){
  setupSheets();
  const p=(e&&e.parameter)||{},action=p.action||"health";let out;
  try{
    if(action==="health")out={ok:true,message:"PMV SURWARI NMMS Backend Running"};
    else if(action==="listQuizzes")out={ok:true,quizzes:listQuizzes_()};
    else if(action==="saveResult")out=saveResult_(JSON.parse(p.result||"{}"));
    else if(action==="addQuiz"){if(p.pin!==ADMIN_PIN)out={ok:false,error:"Invalid Admin PIN"};else out=addQuiz_(JSON.parse(p.quiz||"{}"))}
    else if(action==="deleteQuiz"){if(p.pin!==ADMIN_PIN)out={ok:false,error:"Invalid Admin PIN"};else out=deleteQuiz_(p.id||"")}
    else if(action==="generateQuiz"){if(p.pin!==ADMIN_PIN)out={ok:false,error:"Invalid Admin PIN"};else out=generateQuiz_(p)}
    else out={ok:false,error:"Unknown action"};
  }catch(err){out={ok:false,error:String(err)}}
  const callback=p.callback,body=JSON.stringify(out);
  if(callback&&/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback))
    return ContentService.createTextOutput(callback+"("+body+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  try{
    setupSheets();const b=JSON.parse((e&&e.postData&&e.postData.contents)||"{}");
    if(b.action==="listQuizzes")return json_({ok:true,quizzes:listQuizzes_()});
    if(b.action==="saveResult")return json_(saveResult_(b.result||{}));
    if(b.action==="addQuiz"){if(b.pin!==ADMIN_PIN)return json_({ok:false,error:"Invalid Admin PIN"});return json_(addQuiz_(b.quiz||{}))}
    if(b.action==="deleteQuiz"){if(b.pin!==ADMIN_PIN)return json_({ok:false,error:"Invalid Admin PIN"});return json_(deleteQuiz_(b.id||""))}
    if(b.action==="generateQuiz"){if(b.pin!==ADMIN_PIN)return json_({ok:false,error:"Invalid Admin PIN"});return json_(generateQuiz_(b))}
    return json_({ok:false,error:"Unknown action"});
  }catch(err){return json_({ok:false,error:String(err)})}
}

function generateQuiz_(p){
  const key=PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if(!key)throw new Error("GEMINI_API_KEY सेट नहीं है। Apps Script में setGeminiApiKey() एक बार Run करें।");
  const topic=String(p.topic||"").trim(),subject=String(p.subject||"विज्ञान"),className=String(p.className||"कक्षा 8");
  const count=Math.min(20,Math.max(1,Number(p.count)||10)),difficulty=String(p.difficulty||"मध्यम"),language=String(p.language||"हिंदी"),time=Number(p.time)||10;
  if(!topic)throw new Error("Topic / Chapter खाली है।");
  const prompt=`You are an expert NMMS school teacher in India. Create exactly ${count} high-quality multiple-choice questions for ${className}, subject ${subject}, topic "${topic}", difficulty ${difficulty}. Language: ${language}. Every question must have exactly 4 options, one correct answer, and a short explanation. Avoid duplicate questions. Return ONLY a JSON array, with no markdown and no extra text. Each object must have exactly: question (string), options (array of 4 strings), answer (integer 0-3), explanation (string). Make questions suitable for NMMS preparation and factually correct.`;
  const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(GEMINI_MODEL)+":generateContent";
  const payload={contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.4,maxOutputTokens:12000,responseMimeType:"application/json"}};
  const res=UrlFetchApp.fetch(url,{method:"post",contentType:"application/json",headers:{"x-goog-api-key":key},payload:JSON.stringify(payload),muteHttpExceptions:true});
  const code=res.getResponseCode(),txt=res.getContentText();
  if(code<200||code>=300)throw new Error("Gemini API error "+code+": "+txt.slice(0,500));
  const data=JSON.parse(txt);
  const outText=data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text;
  if(!outText)throw new Error("Gemini ने कोई प्रश्न नहीं लौटाया।");
  let questions;
  try{questions=JSON.parse(outText)}catch(e){const clean=outText.replace(/```json|```/g,"").trim();questions=JSON.parse(clean)}
  if(!Array.isArray(questions)||questions.length<1)throw new Error("AI response में valid questions नहीं मिले।");
  questions=questions.slice(0,count).map(q=>({question:String(q.question||""),options:Array.isArray(q.options)?q.options.slice(0,4).map(String):[],answer:Number(q.answer),explanation:String(q.explanation||"")}));
  questions.forEach(q=>{if(!q.question||q.options.length!==4||q.answer<0||q.answer>3)throw new Error("AI ने गलत question format दिया।")});
  const quiz={id:"ai"+Date.now(),title:"AI Quiz • "+topic,subject,time,questions};
  addQuiz_(quiz);
  return {ok:true,message:"AI Quiz generated and saved",quiz};
}

function listQuizzes_(){
 const sh=SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET),v=sh.getDataRange().getValues();
 return v.slice(1).filter(r=>r[0]).map(r=>({id:String(r[0]),title:String(r[1]),subject:String(r[2]),time:Number(r[3])||10,questions:JSON.parse(String(r[4]||"[]"))}));
}
function addQuiz_(q){
 if(!q||!q.id)throw new Error("Quiz ID missing");
 SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET).appendRow([String(q.id),String(q.title||"नया Quiz"),String(q.subject||""),Number(q.time)||10,JSON.stringify(q.questions||[]),new Date()]);
 return {ok:true,message:"Quiz saved"};
}
function deleteQuiz_(id){
 const sh=SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET),v=sh.getDataRange().getValues();
 for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===String(id)){sh.deleteRow(i+1);return {ok:true,message:"Quiz deleted"}}
 return {ok:false,error:"Quiz not found"};
}
function saveResult_(x){
 SpreadsheetApp.getActive().getSheetByName(RESULT_SHEET).appendRow([new Date(),String(x.quizId||""),String(x.title||""),Number(x.score)||0,Number(x.total)||0,Number(x.pct)||0]);
 return {ok:true,message:"Result saved"};
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}