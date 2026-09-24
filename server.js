'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Pool}=require('pg');
const PORT=process.env.PORT||3000;
const DATABASE_URL=process.env.DATABASE_URL;
const ADMIN='Mr.Russian',CHANNELS=['general','gaming','casino','memes','announcements'];
if(!DATABASE_URL){console.error('DATABASE_URL is required.');process.exit(1)}
const pool=new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false},max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const th=t=>crypto.createHash('sha256').update(t).digest('hex');
const hashPw=(pw,salt)=>crypto.scryptSync(pw,salt,64).toString('hex');
function setPw(u,pw){u.salt=crypto.randomBytes(16).toString('hex');u.hash=hashPw(pw,u.salt)}
function checkPw(u,pw){try{const a=Buffer.from(hashPw(pw,u.salt),'hex'),b=Buffer.from(u.hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)}catch{return false}}
const hits=new Map();
const limited=(k,max,ms)=>{const n=Date.now(),a=(hits.get(k)||[]).filter(t=>n-t<ms);hits.set(k,a);return a.length>=max};
const hit=k=>{const a=hits.get(k)||[];a.push(Date.now());hits.set(k,a)};
setInterval(()=>{const n=Date.now();for(const[k,a]of hits){const f=a.filter(t=>n-t<3600000);f.length?hits.set(k,f):hits.delete(k)}},600000).unref();

async function init(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
    username_key TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 1000,
    admin BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen BIGINT NOT NULL DEFAULT 0,
    forced BOOLEAN NOT NULL DEFAULT FALSE,
    salt TEXT,
    hash TEXT
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions(
    token_hash TEXT PRIMARY KEY,
    username_key TEXT NOT NULL REFERENCES users(username_key) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages(
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS chat_messages_channel_idx ON chat_messages(channel,id)`);
  await pool.query(`DELETE FROM sessions WHERE expires_at < $1`,[Date.now()]);
  const r=await pool.query('SELECT * FROM users WHERE username_key=$1',[ADMIN.toLowerCase()]);
  let admin=r.rows[0];
  if(!admin){
    admin={username_key:ADMIN.toLowerCase(),username:ADMIN,balance:100000,admin:true,last_seen:0,forced:false};
    if(process.env.ADMIN_PASSWORD&&process.env.ADMIN_PASSWORD.length>=8){admin.salt=crypto.randomBytes(16).toString('hex');admin.hash=hashPw(process.env.ADMIN_PASSWORD,admin.salt)}
    await pool.query(`INSERT INTO users(username_key,username,balance,admin,last_seen,forced,salt,hash) VALUES($1,$2,$3,true,0,false,$4,$5)`,[admin.username_key,admin.username,100000,admin.salt||null,admin.hash||null]);
  } else if(process.env.ADMIN_PASSWORD&&process.env.ADMIN_PASSWORD.length>=8 && !checkPw(admin,process.env.ADMIN_PASSWORD)){
    const salt=crypto.randomBytes(16).toString('hex'),hash=hashPw(process.env.ADMIN_PASSWORD,salt);
    await pool.query('UPDATE users SET salt=$1,hash=$2,admin=true WHERE username_key=$3',[salt,hash,ADMIN.toLowerCase()]);
    await pool.query('DELETE FROM sessions WHERE username_key=$1',[ADMIN.toLowerCase()]);
  }
  if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<8)console.warn('ADMIN_PASSWORD is missing or shorter than 8 characters. Admin login is disabled until you set it.');
}

async function getUser(name){const k=String(name||'').toLowerCase();const r=await pool.query('SELECT * FROM users WHERE username_key=$1',[k]);return r.rows[0]||null}
const pub=u=>({username:u.username,balance:Number(u.balance),admin:!!u.admin});
const ipOf=req=>{const x=(req.headers['x-forwarded-for']||'').split(',').map(v=>v.trim()).filter(Boolean);return x.length?x[x.length-1]:(req.socket.remoteAddress||'?')};
function readBody(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c;if(s.length>20000){no(new Error('Request too large'));req.destroy()}});req.on('end',()=>{try{ok(s?JSON.parse(s):{})}catch(e){no(new Error('Bad request'))}});req.on('error',no)})}
async function auth(req){const h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';if(!t)return null;const r=await pool.query('SELECT s.*,u.* FROM sessions s JOIN users u ON u.username_key=s.username_key WHERE s.token_hash=$1 AND s.expires_at>$2',[th(t),Date.now()]);if(!r.rows[0])return null;const u=r.rows[0];await pool.query('UPDATE users SET last_seen=$1 WHERE username_key=$2',[Date.now(),u.username_key]);return{u,t}}
async function newSession(u){const t=crypto.randomBytes(24).toString('hex');await pool.query('INSERT INTO sessions(token_hash,username_key,expires_at) VALUES($1,$2,$3)',[th(t),u.username_key,Date.now()+14*864e5]);return t}
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj))};
const fail=(res,code,msg)=>send(res,code,{error:msg});

async function main(req,res){
  const url=new URL(req.url,'http://x'),p=url.pathname,proto=req.headers['x-forwarded-proto'];
  if(proto==='http'&&p!=='/healthz'){res.writeHead(301,{Location:'https://'+req.headers.host+req.url});return res.end()}
  if(proto==='https')res.setHeader('Strict-Transport-Security','max-age=63072000; includeSubDomains');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
  try{
    if(req.method==='GET'&&(p==='/'||p==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(fs.readFileSync(path.join(__dirname,'public','index.html')))}
    if(p==='/healthz')return send(res,200,{ok:true});
    if(!p.startsWith('/api/'))return fail(res,404,'Not found');
    const route=req.method+' '+p;
    if(route==='GET /api/leaderboard'){
      const r=await pool.query('SELECT username,balance FROM users WHERE admin=false ORDER BY balance DESC LIMIT 10');
      return send(res,200,{top:r.rows.map(u=>({name:u.username,coins:Number(u.balance)}))});
    }
    if(route==='POST /api/signup'){
      const ip=ipOf(req);if(limited('s'+ip,5,3600000))return fail(res,429,'Too many sign-ups from this network. Try again later.');
      const b=await readBody(req),name=String(b.username||'').trim(),pw=String(b.password||'');
      if(!/^[A-Za-z0-9._-]{3,20}$/.test(name))return fail(res,400,'Username must be 3-20 characters: letters, numbers, . _ -');
      if(pw.length<6||pw.length>100)return fail(res,400,'Password must be at least 6 characters.');
      if(/^(__proto__|constructor|prototype|tostring|valueof)$/i.test(name)||await getUser(name))return fail(res,409,'That username is already taken.');
      const salt=crypto.randomBytes(16).toString('hex'),hash=hashPw(pw,salt),key=name.toLowerCase();
      try{await pool.query('INSERT INTO users(username_key,username,balance,admin,last_seen,forced,salt,hash) VALUES($1,$2,1000,false,$3,false,$4,$5)',[key,name,Date.now(),salt,hash])}catch(e){if(e.code==='23505')return fail(res,409,'That username is already taken.');throw e}
      const u=await getUser(name);hit('s'+ip);return send(res,200,{token:await newSession(u),user:pub(u)});
    }
    if(route==='POST /api/login'){
      const ip=ipOf(req),b=await readBody(req),pw=String(b.password||'').slice(0,100),key=String(b.username||'').trim().toLowerCase().slice(0,40);
      if(limited('l'+ip,40,600000)||limited('la'+key,8,900000))return fail(res,429,'Too many failed attempts. Wait 15 minutes and try again.');
      const u=await getUser(key),ok=u?checkPw(u,pw):false;
      if(!ok){hit('l'+ip);hit('la'+key);return fail(res,401,'Incorrect username or password.')}
      await pool.query('UPDATE users SET last_seen=$1 WHERE username_key=$2',[Date.now(),u.username_key]);return send(res,200,{token:await newSession(u),user:pub(u)});
    }
    const a=await auth(req);if(!a)return fail(res,401,'Please sign in.');
    const u=a.u;
    if(route==='GET /api/me')return send(res,200,{user:pub(u)});
    if(route==='POST /api/logout'){await pool.query('DELETE FROM sessions WHERE token_hash=$1',[th(a.t)]);return send(res,200,{ok:true})}
    if(route==='POST /api/balance'){
      const b=await readBody(req);
      if(u.forced){await pool.query('UPDATE users SET forced=false WHERE username_key=$1',[u.username_key]);return send(res,200,{balance:Number(u.balance),forced:true})}
      const n=Math.floor(Number(b.balance));if(!Number.isFinite(n)||n<0||n>1e12)return fail(res,400,'Invalid balance.');
      await pool.query('UPDATE users SET balance=$1 WHERE username_key=$2',[n,u.username_key]);return send(res,200,{balance:n});
    }
    if(route==='GET /api/chat'){
      const after=Number(url.searchParams.get('after'))||0;
      const r=after===0?await pool.query('SELECT id,channel,username,message,text,created_at FROM (SELECT id,channel,username,message,message AS text,created_at FROM chat_messages ORDER BY id DESC LIMIT 50) x ORDER BY id'):await pool.query('SELECT id,channel,username,message,created_at FROM chat_messages WHERE id>$1 ORDER BY id',[after]);
      const out=r.rows.map(m=>({id:Number(m.id),channel:m.channel,user:m.username,text:m.message,t:Number(m.created_at)}));
      const on=await pool.query('SELECT username FROM users WHERE last_seen>$1 ORDER BY username',[Date.now()-45000]);
      return send(res,200,{messages:out,online:on.rows.map(x=>x.username)});
    }
    if(route==='POST /api/chat'){
      const b=await readBody(req),channel=String(b.channel||''),text=String(b.text||'').trim().slice(0,500);
      if(!CHANNELS.includes(channel))return fail(res,400,'Unknown channel.');if(!text)return fail(res,400,'Message is empty.');
      if(channel==='announcements'&&!u.admin)return fail(res,403,'Only the admin can post in #announcements.');
      if(limited('c'+u.username,3,3000))return fail(res,429,'Slow down a little.');hit('c'+u.username);
      const now=Date.now(),r=await pool.query('INSERT INTO chat_messages(channel,username,message,created_at) VALUES($1,$2,$3,$4) RETURNING id',[channel,u.username,text,now]);
      await pool.query(`DELETE FROM chat_messages WHERE id IN (SELECT id FROM chat_messages WHERE channel=$1 ORDER BY id DESC OFFSET 200)`,[channel]);
      return send(res,200,{message:{id:Number(r.rows[0].id),channel,user:u.username,text,t:now}});
    }
    if(route.includes('/api/admin/')){
      if(!u.admin)return fail(res,403,'Admins only.');
      if(route==='GET /api/admin/users'){const r=await pool.query('SELECT username,balance FROM users WHERE admin=false ORDER BY username');return send(res,200,{users:r.rows.map(x=>({username:x.username,balance:Number(x.balance)}))})}
      if(route==='POST /api/admin/balance'){
        const b=await readBody(req),t=await getUser(b.username),n=Math.floor(Number(b.balance));
        if(!t||t.admin)return fail(res,404,'That player does not exist.');if(!Number.isFinite(n)||n<0||n>1e12)return fail(res,400,'Invalid balance.');
        await pool.query('UPDATE users SET balance=$1,forced=true WHERE username_key=$2',[n,t.username_key]);return send(res,200,{ok:true});
      }
    }
    return fail(res,404,'Not found');
  }catch(e){console.error(e);if(!res.headersSent)fail(res,500,'Server error')}
}

(async()=>{try{await init();const server=http.createServer((req,res)=>main(req,res));server.listen(PORT,()=>console.log('Casino running on port '+PORT));process.on('SIGTERM',async()=>{await pool.end();process.exit(0)});process.on('SIGINT',async()=>{await pool.end();process.exit(0)})}catch(e){console.error('Database startup failed:',e);process.exit(1)}})();
