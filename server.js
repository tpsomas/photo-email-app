const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PORT = process.env.PORT || 3000;
const MENTRA_API_KEY = process.env.MENTRA_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';

const expressApp = express();
expressApp.use(express.json({ limit: '20mb' }));

// Health check
expressApp.get('/', (req, res) => {
  res.send('Photo Email App is running!');
});

// Webview route - served to the glasses browser
expressApp.get('/webview', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Photo to Email</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #111;
      color: #fff;
      font-family: Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    h1 { font-size: 1.4em; margin-bottom: 30px; text-align: center; }
    #btn {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 20px 40px;
      font-size: 1.2em;
      border-radius: 12px;
      cursor: pointer;
      width: 100%;
      max-width: 300px;
    }
    #btn:disabled { background: #555; cursor: not-allowed; }
    #status { margin-top: 20px; font-size: 1em; text-align: center; min-height: 30px; color: #aaa; }
    #status.ok { color: #4CAF50; }
    #status.err { color: #f44336; }
  </style>
</head>
<body>
  <h1>Photo to Email</h1>
  <button id="btn" onclick="takePhoto()">Take Photo & Send</button>
  <div id="status"></div>
  <script>
    function setStatus(msg, cls) {
      var s = document.getElementById('status');
      s.textContent = msg;
      s.className = cls || '';
    }
    function takePhoto() {
      var btn = document.getElementById('btn');
      btn.disabled = true;
      setStatus('Taking photo...');
      if (window.MentraOS) {
        window.MentraOS.camera.takePhoto().then(function(photoData) {
          setStatus('Sending email...');
          return fetch('/send-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: photoData, timestamp: new Date().toISOString() })
          });
        }).then(function(res) { return res.json(); }).then(function(data) {
          if (data.success) {
            setStatus('Email sent successfully!', 'ok');
          } else {
            setStatus('Error: ' + (data.error || 'Unknown error'), 'err');
          }
          btn.disabled = false;
        }).catch(function(err) {
          setStatus('Error: ' + err.message, 'err');
          btn.disabled = false;
        });
      } else {
        // Fallback: take photo via server-side session
        fetch('/take-photo-session', { method: 'POST' })
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.success) {
              setStatus('Email sent!', 'ok');
            } else {
              setStatus('Error: ' + (d.error || 'fail'), 'err');
            }
            btn.disabled = false;
          }).catch(function(e) {
            setStatus('Error: ' + e.message, 'err');
            btn.disabled = false;
          });
      }
    }
  </script>
</body>
</html>`);
});

// Endpoint to receive photo data and send email
expressApp.post('/send-photo', async (req, res) => {
  try {
    const { photo, timestamp } = req.body;
    if (!photo) return res.json({ success: false, error: 'No photo data' });

    // photo may be base64 string or data URL
    let base64 = photo;
    if (photo.includes(',')) base64 = photo.split(',')[1];

    await sgMail.send({
      from: SENDER_EMAIL,
      to: RECIPIENT_EMAIL,
      subject: 'New Photo from Smart Glasses',
      text: 'Photo taken at: ' + (timestamp || new Date().toISOString()),
      attachments: [{
        filename: 'photo_' + Date.now() + '.jpg',
        content: base64,
        type: 'image/jpeg',
        disposition: 'attachment'
      }]
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Send email error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// Session-based photo capture via MentraOS SDK WebSocket
const sessions = {};

expressApp.post('/take-photo-session', async (req, res) => {
  const sessionIds = Object.keys(sessions);
  if (sessionIds.length === 0) return res.json({ success: false, error: 'No active glasses session' });
  const session = sessions[sessionIds[0]];
  try {
    // Request camera capture through WebSocket
    session.ws.send(JSON.stringify({ type: 'take_photo' }));
    res.json({ success: true, message: 'Photo request sent to glasses' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// WebSocket server for MentraOS glasses connection
const server = http.createServer(expressApp);
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const sessionId = Date.now().toString();
  console.log('Glasses connected, session:', sessionId);
  sessions[sessionId] = { ws, sessionId };

  // Send initial UI to glasses
  ws.send(JSON.stringify({
    type: 'layout',
    view: 'button',
    title: 'Photo to Email',
    buttons: [{ id: 'take_photo', label: 'Take Photo & Send' }]
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('Message from glasses:', msg.type);

      if (msg.type === 'button_press' && msg.buttonId === 'take_photo') {
        ws.send(JSON.stringify({ type: 'status', text: 'Sending email...' }));

        if (msg.photoData) {
          let base64 = msg.photoData;
          if (base64.includes(',')) base64 = base64.split(',')[1];

          await sgMail.send({
            from: SENDER_EMAIL,
            to: RECIPIENT_EMAIL,
            subject: 'New Photo from Smart Glasses',
            text: 'Photo captured at: ' + new Date().toLocaleString(),
            attachments: [{
              filename: 'photo_' + Date.now() + '.jpg',
              content: base64,
              type: 'image/jpeg',
              disposition: 'attachment'
            }]
          });

          ws.send(JSON.stringify({ type: 'status', text: 'Email sent!' }));
        } else {
          // No photo data in message — send email without attachment
          await sgMail.send({
            from: SENDER_EMAIL,
            to: RECIPIENT_EMAIL,
            subject: 'Photo Request from Smart Glasses',
            text: 'Photo requested at: ' + new Date().toLocaleString() + '\n\n(Photo data not available in this session)'
          });
          ws.send(JSON.stringify({ type: 'status', text: 'Email sent!' }));
        }
      }

      if (msg.type === 'photo_data' && msg.data) {
        let base64 = msg.data;
        if (base64.includes(',')) base64 = base64.split(',')[1];

        await sgMail.send({
          from: SENDER_EMAIL,
          to: RECIPIENT_EMAIL,
          subject: 'New Photo from Smart Glasses',
          text: 'Photo captured at: ' + new Date().toLocaleString(),
          attachments: [{
            filename: 'photo_' + Date.now() + '.jpg',
            content: base64,
            type: 'image/jpeg',
            disposition: 'attachment'
          }]
        });
        ws.send(JSON.stringify({ type: 'status', text: 'Email sent!' }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message);
      ws.send(JSON.stringify({ type: 'error', text: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('Session closed:', sessionId);
    delete sessions[sessionId];
  });
});

server.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
