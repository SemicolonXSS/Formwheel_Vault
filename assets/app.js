/* =========================================================
   FIREBASE
========================================================= */

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
  remove,
  push,
  runTransaction
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBreTSe1m0-xlbF4aupnU5isRZCihR25IE",
  authDomain: "formwheel.firebaseapp.com",
  databaseURL: "https://formwheel-default-rtdb.firebaseio.com",
  projectId: "formwheel",
  storageBucket: "formwheel.firebasestorage.app",
  messagingSenderId: "431583088241",
  appId: "1:431583088241:web:74e0e34ea1e3e1170c55d0",
  measurementId: "G-T372YXDF8D"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


/* =========================================================
   LOCAL VAULT
========================================================= */

const SAVE_KEY = "formwheel_vault_save_v1";

const treasureList = [
  {id:"silver",icon:"🪙",name:"은화",rarity:"일반"},
  {id:"emerald",icon:"💚",name:"에메랄드",rarity:"희귀"},
  {id:"sapphire",icon:"💎",name:"사파이어",rarity:"영웅"},
  {id:"crown",icon:"👑",name:"황금 왕관",rarity:"전설"},
  {id:"crystal",icon:"🔮",name:"신비한 수정",rarity:"전설"},
  {id:"ring",icon:"💍",name:"왕의 반지",rarity:"영웅"},
  {id:"idol",icon:"🗿",name:"고대 우상",rarity:"희귀"},
  {id:"star",icon:"🌟",name:"별의 보물",rarity:"신화"}
];

let vault = loadVault();

function defaultVault(){
  return {
    money:0,
    level:1,
    xp:0,
    keys:0,
    defense:1,
    games:0,
    treasures:[],
    totalEarned:0
  };
}

function loadVault(){
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    return {...defaultVault(),...(saved||{})};
  }catch(e){
    return defaultVault();
  }
}

function saveVault(){
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(vault));}catch{console.warn("개인 금고 저장 실패");}
  updateUI();
}

window.resetLocalVault=()=>{
  vault=defaultVault();
  saveVault();
};


/* =========================================================
   SCREEN
========================================================= */

window.showScreen=function(id){
  document.querySelectorAll(".screen")
    .forEach(x=>x.classList.remove("active"));

  document.getElementById(id)?.classList.add("active");

  if(id==="myVaultScreen") updateUI();
};


/* =========================================================
   UI
========================================================= */

function updateUI(){

  document.getElementById("topMoney").textContent =
    vault.money.toLocaleString();

  document.getElementById("homeVaultMoney").textContent =
    vault.money.toLocaleString();

  document.getElementById("homeVaultLevel").textContent =
    "VAULT LEVEL "+vault.level;

  document.getElementById("homeKeys").textContent=vault.keys;
  document.getElementById("homeTreasures").textContent=vault.treasures.length;
  document.getElementById("homeDefense").textContent=vault.defense;
  document.getElementById("homeGames").textContent=vault.games;

  document.getElementById("myVaultMoney").textContent=
    vault.money.toLocaleString();

  document.getElementById("myVaultLevel").textContent=
    "VAULT LEVEL "+vault.level;

  document.getElementById("myKeys").textContent=vault.keys;
  document.getElementById("myDefense").textContent=vault.defense;
  document.getElementById("myTreasures").textContent=vault.treasures.length;
  document.getElementById("myGames").textContent=vault.games;

  document.getElementById("itemKeys").textContent=vault.keys;
  document.getElementById("itemDefense").textContent=vault.defense;

  const need=vault.level*100;
  document.getElementById("xpText").textContent=
    `${vault.xp} / ${need} XP`;

  document.getElementById("xpBar").style.width=
    Math.min(100,vault.xp/need*100)+"%";

  renderTreasures("treasureGrid");
  renderTreasures("homeTreasuresGrid");
}

function renderTreasures(id){

  const el=document.getElementById(id);
  if(!el)return;

  el.innerHTML="";

  treasureList.forEach(t=>{

    const owned=vault.treasures.includes(t.id);

    const div=document.createElement("div");
    div.className="slot";

    div.innerHTML=`
      <div class="slot-icon">${owned?t.icon:"❔"}</div>
      <div class="slot-name">${owned?t.name:"미발견"}</div>
      <div class="slot-rarity">${owned?t.rarity:"???"}</div>
    `;

    el.appendChild(div);
  });
}

updateUI();


/* =========================================================
   ROOM STATE
========================================================= */

let roomCode=null;

/*
  플레이어 ID는 sessionStorage에 저장합니다.
  (탭마다 따로 저장되므로 같은 기기/브라우저에서 탭을 여러 개 열어도
   각각 다른 플레이어로 인식됩니다. 새로고침해도 유지됩니다.)
*/
let playerId=null;
try{
  playerId=sessionStorage.getItem("formwheel_vault_player_id");
}catch(e){}

if(!playerId){
  playerId="p_"+Math.random().toString(36).slice(2,10);
  try{
    sessionStorage.setItem("formwheel_vault_player_id",playerId);
  }catch(e){}
}

let playerName="";
let isHost=false;
let roomListener=null;

function freshGameState(){
  return {
    score:0,
    round:1,
    bank:0,
    keys:0,
    active:true
  };
}

let gameState=freshGameState();


/* =========================================================
   ROOM
========================================================= */

function randomCode(){
  return String(Math.floor(1000+Math.random()*9000));
}

window.createRoom=async function(){

  const name=
    document.getElementById("hostName").value.trim();

  if(!name){
    alert("닉네임을 입력해주세요.");
    return;
  }

  playerName=name.slice(0,12);

  let code=randomCode();

  let roomRef=ref(db,"vaultRooms/"+code);

  while((await get(roomRef)).exists()){
    code=randomCode();
    roomRef=ref(db,"vaultRooms/"+code);
  }

  roomCode=code;
  isHost=true;

  await set(roomRef,{
    status:"lobby",
    round:0,
    host:playerId,
    players:{
      [playerId]:{
        name:playerName,
        score:0,
        bank:0,
        active:true
      }
    }
  });

  enterLobby();
};


window.joinRoom=async function(){

  const name=
    document.getElementById("joinName").value.trim();

  const code=
    document.getElementById("joinCode").value.trim();

  if(!name){
    alert("닉네임을 입력해주세요.");
    return;
  }

  if(!/^\d{4}$/.test(code)){
    alert("4자리 방 코드를 입력해주세요.");
    return;
  }

  const roomRef=ref(db,"vaultRooms/"+code);
  const snap=await get(roomRef);

  if(!snap.exists()){
    alert("존재하지 않는 방입니다.");
    return;
  }

  const data=snap.val();

  if(data.status!=="lobby"){
    alert("이미 게임이 시작된 방입니다.");
    return;
  }

  const players=data.players||{};
  const count=Object.keys(players).length;

  /* 이미 이 ID로 들어와 있는 경우(새로고침 등)는 인원 제한에서 제외 */
  if(count>=6 && !players[playerId]){
    alert("방이 가득 찼습니다.");
    return;
  }

  playerName=name.slice(0,12);
  roomCode=code;
  isHost=(data.host===playerId);

  await update(
    ref(db,`vaultRooms/${code}/players/${playerId}`),
    {
      name:playerName,
      score:0,
      bank:0,
      active:true
    }
  );

  enterLobby();
};


function enterLobby(){
  try{sessionStorage.setItem("formwheel_vault_room",roomCode);}catch{}

  /* 새 방에 들어갈 때마다 게임 상태 초기화 */
  gameState=freshGameState();

  document.getElementById("lobbyCode").textContent=roomCode;

  showScreen("lobbyScreen");

  if(roomListener) roomListener();

  roomListener=onValue(
    ref(db,"vaultRooms/"+roomCode),
    snap=>{
      if(!snap.exists()){
        alert("방이 종료되었습니다.");
        stopListening();
        showScreen("roomScreen");
        return;
      }

      const data=snap.val();

      /* 방장 정보는 로비에서도 바로 반영 */
      window.__vaultHost=data.host;
      isHost=(data.host===playerId);

      renderPlayers(data.players||{});

      if(data.status==="game"){
        loadGame(data);
      }
    }
  );
}

function stopListening(){
  if(roomListener){
    roomListener();
    roomListener=null;
  }
  roomCode=null;
  isHost=false;
}


function renderPlayers(players){

  const list=
    document.getElementById("playersList");

  const gameList=
    document.getElementById("gamePlayers");

  const entries=
    Object.entries(players);

  document.getElementById("playerCount")
    .textContent=`${entries.length} / 6`;

  list.innerHTML="";
  gameList.innerHTML="";

  entries.forEach(([id,p])=>{

    const div=document.createElement("div");
    div.className="player";

    div.innerHTML=`
      <span class="player-name">
        ${escapeHtml(p.name)}
        ${id===playerId?" (나)":""}
        ${id===dataHost()?" 👑":""}
      </span>
      <span class="player-score">
        ${Number(p.score||0)} P
      </span>
    `;

    list.appendChild(div);

    const gameDiv=div.cloneNode(true);
    gameList.appendChild(gameDiv);
  });

  document.getElementById("startGameBtn").style.display=
    isHost?"inline-block":"none";
}

function dataHost(){
  return window.__vaultHost||"";
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}


/* =========================================================
   START GAME
========================================================= */

window.startGame=async function(){

  if(!isHost)return;

  const snap=
    await get(ref(db,"vaultRooms/"+roomCode));

  const data=snap.val();

  const players=
    Object.keys(data.players||{});

  if(players.length<2){
    alert("최소 2명이 필요합니다.");
    return;
  }

  await update(
    ref(db,"vaultRooms/"+roomCode),
    {
      status:"game",
      round:1,
      vaults:createVaults()
    }
  );
};


function createVaults(){

  return [
    makeVault(1),
    makeVault(2),
    makeVault(3),
    makeVault(4),
    makeVault(5),
    makeVault(6)
  ];
}

function makeVault(id){

  const r=Math.random();

  let type="coin";

  if(r<.17)type="trap";
  else if(r<.30)type="key";
  else if(r<.42)type="treasure";
  else if(r<.52)type="double";
  else if(r<.59)type="shield";

  return {
    id,
    type,
    openedBy:null,
    value:
      type==="coin" ? rand(15,55):
      type==="trap" ? rand(15,45):
      type==="key" ? 0:
      type==="treasure" ? rand(25,70):
      type==="double" ? rand(30,60):
      0
  };
}

function rand(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}


/* =========================================================
   GAME
========================================================= */

function loadGame(data){

  window.__vaultHost=data.host;

  if(data.host===playerId){
    isHost=true;
  }

  const me=data.players?.[playerId];

  if(!me)return;

  let receiptChanged=false;vault.appliedRewards=vault.appliedRewards||{};
  for(const [key,reward] of Object.entries(me.rewards||{})){
    if(vault.appliedRewards[key])continue;
    vault.keys+=reward.keys||0;vault.defense+=reward.defense||0;
    if(reward.treasure&&!vault.treasures.includes(reward.treasure))vault.treasures.push(reward.treasure);
    vault.appliedRewards[key]=true;receiptChanged=true;
  }
  if(receiptChanged)saveVault();
  gameState.score=Number(me.score||0);
  gameState.bank=Number(me.bank||0);
  gameState.round=Number(data.round||1);
  gameState.keys=vault.keys;

  document.getElementById("gameScore").textContent=
    gameState.score;

  document.getElementById("gameRound").textContent=
    gameState.round;

  document.getElementById("gameKeys").textContent=
    gameState.keys;

  document.getElementById("gameBank").textContent=
    gameState.bank;

  /* Firebase는 배열을 객체로 돌려줄 수 있어서 안전하게 배열로 변환 */
  const vaults=
    Array.isArray(data.vaults)
      ? data.vaults.filter(Boolean)
      : Object.values(data.vaults||{});

  renderPublicVaults(vaults);
  renderPlayers(data.players||{});

  showScreen("gameScreen");
}


function renderPublicVaults(vaults){

  const el=
    document.getElementById("publicVaults");

  el.innerHTML="";

  vaults.forEach(v=>{

    const opened=!!v.openedBy;

    const div=document.createElement("div");

    div.className=
      "public-vault "+
      (v.type==="double"?"special":"")+
      (opened?" opened":"");

    if(opened){

      div.innerHTML=`
        <span class="badge">OPENED</span>
        <div class="lock">📭</div>
        <h3>이미 열린 금고</h3>
        <small>${v.openedBy===playerId
          ?"내가 연 금고입니다."
          :"다른 플레이어가 먼저 가져갔습니다."}</small>
      `;

    }else{

      div.innerHTML=`
        <span class="badge">VAULT ${v.id}</span>
        <div class="lock">🔐</div>
        <h3>${vaultName(v.type)}</h3>
        <small>${vaultHint(v.type)}</small>

        <div class="actions">
          <button class="btn btn-dark"
            onclick="openPublicVault(${v.id})">
            열기
          </button>
        </div>
      `;
    }

    el.appendChild(div);
  });
}


function vaultName(type){

  return {
    coin:"💰 보물 금고",
    trap:"☠️ 함정 금고",
    key:"🔑 열쇠 금고",
    treasure:"💎 보물 금고",
    double:"🎲 더블 금고",
    shield:"🛡️ 방어 금고"
  }[type]||"🔐 미지의 금고";
}

function vaultHint(type){

  return {
    coin:"안정적인 점수",
    trap:"높은 위험",
    key:"열쇠를 발견할 수도 있습니다",
    treasure:"희귀한 보물",
    double:"성공하면 보상이 커집니다",
    shield:"금고 방어 아이템"
  }[type]||"";
}


/* =========================================================
   OPEN VAULT
========================================================= */

let opening=false;

window.openPublicVault=async function(id){
 if(!roomCode||!gameState.active||opening)return;opening=true;
 const expectedRound=gameState.round,receiptId=crypto.randomUUID(),treasure=treasureList[Math.floor(Math.random()*treasureList.length)],lucky=Math.random()<.5,newVaults=createVaults();
 try{
  const result=await runTransaction(ref(db,`vaultRooms/${roomCode}`),data=>{
   const me=data?.players?.[playerId];if(!me||!me.active||data.status!=="game"||Number(data.round)!==expectedRound)return;
   const arr=Array.isArray(data.vaults)?data.vaults.filter(Boolean):Object.values(data.vaults||{});
   const target=arr.find(v=>Number(v.id)===Number(id));if(!target||target.openedBy)return;
   target.openedBy=playerId;let delta=0,keys=0,defense=0,found="";
   if(target.type==="coin"||target.type==="treasure")delta=Number(target.value)||0;
   if(target.type==="trap")delta=-(Number(target.value)||0);
   if(target.type==="double")delta=(Number(target.value)||0)*(lucky?2:-1);
   if(target.type==="key")keys=1;if(target.type==="shield")defense=1;if(target.type==="treasure")found=treasure.id;
   me.score=(Number(me.score)||0)+delta;me.rewards=me.rewards||{};
   me.rewards[receiptId]={round:expectedRound,vaultId:Number(id),delta,keys,defense,treasure:found};
   if(arr.every(v=>v.openedBy)){data.vaults=newVaults;data.round=expectedRound+1;}else data.vaults=arr;
   return data;
  },{applyLocally:false});
  if(!result.committed)return;
  const data=result.snapshot.val(),reward=data.players[playerId].rewards[receiptId];loadGame(data);
  showEvent("🔐","금고 개방",`${reward.delta>=0?"+":""}${reward.delta} 포인트${reward.keys?" · 열쇠 +1":""}${reward.defense?" · 방어막 +1":""}${reward.treasure?" · 보물 발견":""}${data.round>expectedRound?" · 새 라운드 금고가 생성되었습니다.":""}`);
 }catch(e){console.error(e);alert("금고 저장에 실패했습니다. 다시 연결하면 확정된 보상을 복구합니다.");}finally{opening=false;}
};
async function restoreVaultRoom(){
 let code;try{code=sessionStorage.getItem("formwheel_vault_room");}catch{}if(!code)return;
 try{const snap=await get(ref(db,"vaultRooms/"+code));const data=snap.val();if(!data?.players?.[playerId])return;roomCode=code;playerName=data.players[playerId].name;isHost=data.host===playerId;enterLobby();}catch{console.warn("금고 방 복구 실패");}
}
restoreVaultRoom();

function showEvent(icon,title,result){

  document.getElementById("eventIcon").textContent=icon;
  document.getElementById("eventTitle").textContent=title;
  document.getElementById("eventResult").textContent=result;

  document.getElementById("eventModal")
    .classList.add("show");
}

window.closeEvent=function(){

  document.getElementById("eventModal")
    .classList.remove("show");
};


/* =========================================================
   ESCAPE
========================================================= */

window.escapeGame=async function(){

  if(!roomCode || !gameState.active)return;

  const score=Math.max(0,gameState.score);

  vault.money+=score;
  vault.totalEarned+=score;
  vault.games++;

  vault.xp+=Math.max(10,score);

  while(vault.xp>=vault.level*100){
    vault.xp-=vault.level*100;
    vault.level++;
  }

  saveVault();

  const code=roomCode;

  /* 탈출하면 방 구독을 끊어서 홈 화면에서 게임 화면으로 끌려가지 않게 함 */
  gameState.active=false;
  stopListening();

  try{
    await update(
      ref(db,`vaultRooms/${code}/players/${playerId}`),
      {
        score:0,
        bank:score,
        active:false
      }
    );
  }catch(e){
    console.error(e);
  }

  showEvent(
    "🚪",
    "탈출 성공",
    `${score} 포인트를 나의 금고에 보관했습니다!`
  );

  setTimeout(()=>{
    closeEvent();
    showScreen("homeScreen");
  },1200);
};


/* =========================================================
   UPGRADE
========================================================= */

window.upgradeVault=function(){

  const cost=vault.level*250;

  if(vault.money<cost){
    alert(`금고 업그레이드에는 ${cost}점이 필요합니다.`);
    return;
  }

  vault.money-=cost;
  vault.level++;
  vault.defense++;

  saveVault();

  alert(
    `🔐 금고 레벨이 ${vault.level}로 상승했습니다!`
  );
};


/* =========================================================
   ROOM UTILS
========================================================= */

window.copyRoomCode=function(){

  if(!roomCode)return;

  navigator.clipboard?.writeText(roomCode);

  alert("방 코드가 복사되었습니다.");
};


window.leaveRoom=async function(){

  const code=roomCode;

  /* 먼저 구독을 끊어야 방이 삭제될 때 "방이 종료되었습니다" 알림이 안 뜸 */
  stopListening();

  if(code){
    try{
      await remove(
        ref(db,
          `vaultRooms/${code}/players/${playerId}`
        )
      );
    }catch(e){}
  }

  showScreen("roomScreen");
};


/* =========================================================
   CONFIRM
========================================================= */

function confirmAction(title,text,action){

  document.getElementById("confirmTitle").textContent=title;
  document.getElementById("confirmText").textContent=text;

  const btn=
    document.getElementById("confirmButton");

  btn.onclick=()=>{
    closeConfirm();
    action();
  };

  document.getElementById("confirmModal")
    .classList.add("show");
}

window.closeConfirm=function(){
  document.getElementById("confirmModal")
    .classList.remove("show");
};


/* =========================================================
   TAB VISIBILITY
========================================================= */

document.addEventListener("visibilitychange",()=>{
  if(!document.hidden){
    updateUI();
  }
});
