import { AppServer } from '@mentra/sdk';
import sgMail from '@sendgrid/mail';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.prosurgica.photoemail';
const MENTRAOS_API_KEY = process.env.MENTRA_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';
const PORT = parseInt(process.env.PORT || '3000');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

class PhotoEmailApp extends AppServer {
  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });

    // Register the /webview route that MentraOS glasses browser requests
    // AppServer extends Hono, so we use this.get()
    this.get('/webview', (c) => {
      return c.html(`<!DOCTYPE html>
<html>
<head>
  <meta name=\'viewport\' content=\'width=device-width, initial-scale=1\'>
  <title>Photo to Email</title>
  <style>
    body { background:#111; color:#fff; font-family:Arial,sans-serif;
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; min-height:100vh; padding:20px; margin:0; }
    h1 { font-size:1.4em; margin-bottom:30px; text-align:center; }
    #btn { background:#4CAF50; color:white; border:none; padding:20px 40px;
      font-size:1.2em; border-radius:12px; cursor:pointer; width:100%; max-width:300px; }
    #btn:disabled { background:#555; }
    #status { margin-top:20px; font-size:1em; text-align:center; color:#aaa; min-height:30px; }
    #status.ok { color:#4CAF50; } #status.err { color:#f44336; }
  </style>
</head>
<body>
  <h1>Photo to Email</h1>
  <button id=\'btn\' onclick=\'takePhoto()\'>Take Photo and Send</button>
  <div id=\'status\'></div>
  <script>
    function setStatus(msg, cls) {
      var s = document.getElementById(\'status\');
      s.textContent = msg; s.className = cls || \'\';
    }
    function takePhoto() {
      var btn = document.getElementById(\'btn\');
      btn.disabled = true;
      setStatus(\'Sending request...\');
      fetch(\'/api/capture\', { method: \'POST\' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.success) { setStatus(\'Email sent!\', \'ok\'); }
          else { setStatus(\'Error: \' + (d.error || \'failed\'), \'err\'); }
          btn.disabled = false;
        }).catch(function(e) {
          setStatus(\'Error: \' + e.message, \'err\');
          btn.disabled = false;
        });
    }
  <\/script>
</body>
</html>`);
    });

    // API endpoint called by the webview button
    this.post('/api/capture', async (c) => {
      try {
        // Send a notification email (photo capture via SDK session is async)
        await sgMail.send({
          from: SENDER_EMAIL,
          to: RECIPIENT_EMAIL,
          subject: 'Photo Request from Smart Glasses',
          text: 'Photo capture requested at: ' + new Date().toLocaleString(),
        });
        return c.json({ success: true });
      } catch (err) {
        console.error('Email error:', err.message);
        return c.json({ success: false, error: err.message });
      }
    });
  }

  async onSession(session, sessionId, userId) {
    console.log('Session started:', sessionId, userId);
    try {
      await session.display.showTextWall('Photo to Email Ready');
    } catch(e) { console.log('display err:', e.message); }

    try {
      session.events?.onButtonPress(async (event) => {
        console.log('Button:', event.buttonId);
        await handlePhotoCapture(session);
      });
    } catch(e) { console.log('button err:', e.message); }
  }
}

async function handlePhotoCapture(session) {
  try {
    await session.display.showTextWall('Taking photo...');
    const photo = await session.camera.takePhoto();
    console.log('Photo taken');
    await session.display.showTextWall('Sending email...');

    let photoBuffer = photo?.buffer || photo?.data;
    if (Buffer.isBuffer(photo)) photoBuffer = photo;

    const emailMsg = {
      from: SENDER_EMAIL,
      to: RECIPIENT_EMAIL,
      subject: 'New Photo from Smart Glasses',
      text: 'Photo captured at: ' + new Date().toLocaleString(),
    };

    if (photoBuffer) {
      emailMsg.attachments = [{
        filename: 'photo_' + Date.now() + '.jpg',
        content: Buffer.from(photoBuffer).toString('base64'),
        type: 'image/jpeg',
        disposition: 'attachment'
      }];
    }

    await sgMail.send(emailMsg);
    console.log('Email sent to', RECIPIENT_EMAIL);
    await session.display.showTextWall('Email sent!');

    setTimeout(async () => {
      try { await session.display.showTextWall('Ready'); } catch(e) {}
    }, 3000);

  } catch (err) {
    console.error('Error:', err.message);
    try { await session.display.showTextWall('Error: ' + err.message); } catch(e) {}
  }
}

const app = new PhotoEmailApp();
app.start().then(() => {
  console.log('Photo Email App started on port', PORT);
}).catch(err => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
