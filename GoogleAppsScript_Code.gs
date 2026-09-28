/***** PMV SURWARI NMMS 2027 — FREE GOOGLE SHEETS BACKEND *****/
const ADMIN_PIN = "1234"; // Change this later to your own PIN
const QUIZ_SHEET = "Quizzes";
const RESULT_SHEET = "Results";

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let q = ss.getSheetByName(QUIZ_SHEET);
  let r = ss.getSheetByName(RESULT_SHEET);
  if (!q) q = ss.insertSheet(QUIZ_SHEET);
  if (!r) r = ss.insertSheet(RESULT_SHEET);

  if (q.getLastRow() === 0) {
    q.appendRow(["ID","Title","Subject","Time","Questions","Created"]);
  }
  if (r.getLastRow() === 0) {
    r.appendRow(["Date","Quiz ID","Quiz Title","Score","Total","Percentage"]);
  }
}

function doGet(e) {
  setupSheets();
  const p = (e && e.parameter) || {};
  const action = p.action || "health";
  let out;

  try {
    if (action === "health") {
      out = {ok:true, message:"PMV SURWARI NMMS Backend Running"};
    } else if (action === "listQuizzes") {
      out = {ok:true, quizzes:listQuizzes_()};
    } else if (action === "saveResult") {
      out = saveResult_(JSON.parse(p.result || "{}"));
    } else if (action === "addQuiz") {
      if (p.pin !== ADMIN_PIN) out = {ok:false,error:"Invalid Admin PIN"};
      else out = addQuiz_(JSON.parse(p.quiz || "{}"));
    } else if (action === "deleteQuiz") {
      if (p.pin !== ADMIN_PIN) out = {ok:false,error:"Invalid Admin PIN"};
      else out = deleteQuiz_(p.id || "");
    } else {
      out = {ok:false,error:"Unknown action"};
    }
  } catch (err) {
    out = {ok:false,error:String(err)};
  }

  // JSONP allows the portal to work even when opened locally from index.html (file://).
  const callback = p.callback;
  const body = JSON.stringify(out);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Keep POST support for hosted versions and compatibility.
  try {
    setupSheets();
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = body.action;
    if (action === "listQuizzes") return json_({ok:true,quizzes:listQuizzes_()});
    if (action === "saveResult") return json_(saveResult_(body.result || {}));
    if (action === "addQuiz") {
      if (body.pin !== ADMIN_PIN) return json_({ok:false,error:"Invalid Admin PIN"});
      return json_(addQuiz_(body.quiz || {}));
    }
    if (action === "deleteQuiz") {
      if (body.pin !== ADMIN_PIN) return json_({ok:false,error:"Invalid Admin PIN"});
      return json_(deleteQuiz_(body.id || ""));
    }
    return json_({ok:false,error:"Unknown action"});
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function listQuizzes_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET);
  const values = sh.getDataRange().getValues();
  return values.slice(1).filter(r => r[0]).map(r => ({
    id:String(r[0]),
    title:String(r[1]),
    subject:String(r[2]),
    time:Number(r[3]) || 10,
    questions:JSON.parse(String(r[4] || "[]"))
  }));
}

function addQuiz_(q) {
  if (!q || !q.id) throw new Error("Quiz ID missing");
  const sh = SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET);
  sh.appendRow([String(q.id),String(q.title || "नया Quiz"),String(q.subject || ""),Number(q.time)||10,JSON.stringify(q.questions || []),new Date()]);
  return {ok:true,message:"Quiz saved"};
}

function deleteQuiz_(id) {
  const sh = SpreadsheetApp.getActive().getSheetByName(QUIZ_SHEET);
  const values = sh.getDataRange().getValues();
  for (let i=values.length-1;i>=1;i--) {
    if (String(values[i][0]) === String(id)) {
      sh.deleteRow(i+1);
      return {ok:true,message:"Quiz deleted"};
    }
  }
  return {ok:false,error:"Quiz not found"};
}

function saveResult_(x) {
  const sh = SpreadsheetApp.getActive().getSheetByName(RESULT_SHEET);
  sh.appendRow([
    new Date(),
    String(x.quizId || ""),
    String(x.title || ""),
    Number(x.score) || 0,
    Number(x.total) || 0,
    Number(x.pct) || 0
  ]);
  return {ok:true,message:"Result saved"};
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
