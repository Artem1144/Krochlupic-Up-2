/* Krochlupic-Up Firebase Authentication bootstrap.
   Keeps legacy profile.id and local save intact; UID is stored separately.
   Do not treat client-side account metadata as a trusted game score. */
(function(){
  "use strict";
  var gate=document.getElementById("account-gate");
  if(!gate)return;
  var email=document.getElementById("account-email");
  var password=document.getElementById("account-password");
  var status=document.getElementById("account-status");
  var login=document.getElementById("account-login");
  var register=document.getElementById("account-register");
  var logout=document.getElementById("account-logout");
  var auth=null, busy=false;
  function say(message,isError){status.textContent=message;status.style.color=isError?"#ff8585":"#ffd27a";}
  function setBusy(value){busy=value;login.disabled=value;register.disabled=value;}
  function credentials(){
    var e=(email.value||"").trim(); var p=password.value||"";
    if(!e||!/^\S+@\S+\.\S+$/.test(e))throw new Error("Укажи корректный адрес электронной почты.");
    if(p.length<6)throw new Error("Пароль должен содержать минимум 6 символов.");
    if(p.length>128)throw new Error("Слишком длинный пароль.");
    return {email:e,password:p};
  }
  function explainError(err){
    var code=err&&err.code||"";
    var map={"auth/invalid-email":"Некорректный адрес электронной почты.","auth/user-disabled":"Этот аккаунт отключён.","auth/user-not-found":"Аккаунт не найден. Проверь почту или зарегистрируйся.","auth/wrong-password":"Неверный пароль.","auth/invalid-credential":"Неверная почта или пароль.","auth/email-already-in-use":"Эта почта уже зарегистрирована. Попробуй войти.","auth/weak-password":"Пароль слишком простой. Используй минимум 6 символов.","auth/network-request-failed":"Нет соединения. Проверь интернет.","auth/too-many-requests":"Слишком много попыток. Попробуй позже.","auth/operation-not-allowed":"Email/Password не включён в Firebase Authentication."};
    return map[code]||("Ошибка авторизации: "+(err&&err.message?err.message:"неизвестная ошибка"));
  }
  function showGate(show){gate.classList.toggle("hidden",!show);document.body.style.overflow=show?"hidden":"";}
  function writeAccountRecord(user){
    if(!window.db||!user)return Promise.resolve();
    var legacy={};
    try{legacy=JSON.parse(localStorage.getItem("clicker-profile")||"{}");}catch(e){}
    var record={email:user.email||"",nickname:legacy.nickname||"",legacyProfileId:legacy.id||"",createdAt:legacy.createdAt||Date.now(),lastLoginAt:Date.now(),schemaVersion:1};
    // This path is scoped to the signed-in UID by the intended rules.
    return window.db.ref("playerAccounts/"+user.uid).transaction(function(old){
      if(old){old.email=record.email;old.lastLoginAt=record.lastLoginAt;old.schemaVersion=1;return old;}
      return record;
    });
  }
  function onSignedIn(user){
    showGate(false);logout.classList.remove("hidden");
    say("Вход выполнен.",false);
    writeAccountRecord(user).catch(function(err){console.warn("Не удалось сохранить привязку аккаунта:",err);});
    window.dispatchEvent(new CustomEvent("kro-account-ready",{detail:{uid:user.uid,email:user.email||""}}));
  }
  function run(action){
    if(busy)return;
    var c;try{c=credentials();}catch(e){say(e.message,true);return;}
    if(!auth){say("Firebase Auth не настроен. Добавь Web App config (apiKey и appId) в game.js.",true);return;}
    setBusy(true);say("Подключение…",false);
    var task=action==="register"?auth.createUserWithEmailAndPassword(c.email,c.password):auth.signInWithEmailAndPassword(c.email,c.password);
    task.then(function(result){password.value="";return writeAccountRecord(result.user);})
      .then(function(){say(action==="register"?"Аккаунт создан. Вход выполнен.":"Вход выполнен.",false);})
      .catch(function(err){say(explainError(err),true);})
      .finally(function(){setBusy(false);});
  }
  login.addEventListener("click",function(){run("login");});
  register.addEventListener("click",function(){run("register");});
  logout.addEventListener("click",function(){if(auth)auth.signOut().catch(function(e){say(explainError(e),true);});});
  password.addEventListener("keydown",function(e){if(e.key==="Enter")run("login");});
  function boot(){
    if(typeof firebase==="undefined"||!firebase.auth){say("Firebase Auth SDK не загрузился. Проверь интернет.",true);showGate(true);return;}
    if(!firebase.apps||!firebase.apps.length){say("Firebase App ещё не инициализирован.",true);showGate(true);return;}
    var cfg=firebase.app().options||{};
    if(!cfg.apiKey||String(cfg.apiKey).indexOf("PASTE_")===0||!cfg.appId||String(cfg.appId).indexOf("PASTE_")===0){say("Нужен Firebase Web App config: apiKey и appId. Профиль и сохранение не затронуты.",true);showGate(true);return;}
    try{auth=firebase.auth();auth.onAuthStateChanged(function(user){if(user)onSignedIn(user);else{showGate(true);logout.classList.add("hidden");say("Войди или создай аккаунт.",false);}});}
    catch(e){say(explainError(e),true);showGate(true);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
