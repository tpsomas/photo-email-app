import { AppServer } from '@mentra/sdk';
import sgMail from '@sendgrid/mail';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.prosurgica.photoemail';
const MENTRAOS_API_KEY = process.env.MENTRA_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';
const PORT = parseInt(process.env.PORT || '3000');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const WEBVIEW_HTML = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Photo to Email</title>
<style>
body{background:#111;color:#fff;font-family:Arial,sans-serif;
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100vh;padding:20px;margin:0}
h1{font-size:1.4em;margin-bottom:30px;text-align:center}
#btn{background:#4CAF50;color:#fff;border:none;padding:20px 40px;
  font-size:1.2em;border-radius:12px;cursor:pointer;width:100%;max-width:300px}
#btn:disabled{background:#555;cursor:not-allowed}
#st{margin-top:20px;font-size:1em;text-align:center;color:#aaa;min-height:30px}
.ok{color:#4CAF50}.err{color:#f44336}
</style></head><body>
<h1>Photo to Email</h1>
<button id="btn" onclick="go()">Take Photo &amp; Send</button>
<div id="st"></div>
<script>
function go(){
  var b=document.getElementById('btn'),s=document.getElementById('st');
  b.disabled=true;s.className='';s.textContent='Sending...';
  fetch('/api/capture',{method:'POST'})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.success){s.className='ok';s.textContent='Email sent!'}
      else{s.className='err';s.textContent='Error: '+(d.error||'fail')}
      b.disabled=false;
    }).catch(function(e){
      s.className='err';s.textContent='Error: '+e.message;
      b.disabled=false;
    });
}
</script></body></html>`;

class PhotoEmailApp extends AppServer {
  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
  }

  async onSession(session, sessionId, userId) {
    console.log('Session:', sessionId);
    try { await session.display.showTextWall('Photo to Email Ready'); } catch(e) {}
    try {
      session.events?.onButtonPress(async (ev) => {
        await handleCapture(session);
      });
    } catch(e) {}
  }
}

async function handleCapture(session) {
  try {
    await session.display.showTextWall('Taking photo...');
    const photo = await session.camera.takePhoto();
    await session.display.showTextWall('Sending email...');
    const buf = photo?.buffer || photo?.data;
    const msg = {
      from: SENDER_EMAIL, to: RECIPIENT_EMAIL,
      subject: 'Photo from Smart Glasses',
      text: 'Captured: ' + new Date().toLocaleString(),
    };
    if (buf) msg.attachments = [{
      filename: 'photo_'+Date.now()+'.jpg',
      content: Buffer.from(buf).toString('base64'),
      type:'image/jpeg', disposition:'attachment'
    }];
    await sgMail.send(msg);
    await session.display.showTextWall('Email sent!');
    setTimeout(async()=>{ try{await session.display.showTextWall('Ready');}catch(e){} },3000);
  } catch(e) {
    try{await session.display.showTextWall('Error: '+e.message);}catch(x){}
  }
}

const app = new PhotoEmailApp();

// Add routes AFTER construction (AppServer extends Hono)
app.get('/webview', (c) => c.html(WEBVIEW_HTML));

app.post('/api/capture', async (c) => {
  try {
    await sgMail.send({
      from: SENDER_EMAIL, to: RECIPIENT_EMAIL,
      subject: 'Photo Request from Smart Glasses',
      text: 'Requested at: ' + new Date().toLocaleString(),
    });
    return c.json({ success: true });
  } catch(e) {
    return c.json({ success: false, error: e.message });
  }
});

app.start().then(() => {
  console.log('Started on port', PORT);
}).catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
