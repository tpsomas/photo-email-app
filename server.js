import { AppServer } from '@mentra/sdk';
import sgMail from '@sendgrid/mail';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.prosurgica.photoemail';
const MENTRAOS_API_KEY = process.env.MENTRA_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';
const PORT = parseInt(process.env.PORT || '3000');
const SDK_PORT = PORT + 1;

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const WEBVIEW_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Photo to Email</title></head><body style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:white;text-align:center;padding:2rem"><div style="font-size:5rem">📷</div><h1>Photo to Email</h1><p style="color:#ccc">Press the button on your glasses to take a photo and send it to dina.psoma@gmail.com</p></body></html>';

class PhotoEmailApp extends AppServer {
        constructor() {
                  super({ packageName: PACKAGE_NAME, apiKey: MENTRAOS_API_KEY, port: SDK_PORT });
        }
        async onSession(session, sessionId, userId) {
                  console.log('Session:', sessionId);
                  session.layouts.showTextWall('Photo to Email ready. Press button to take a photo.');
                  session.events.onButtonPress(async () => {
                              try {
                                            session.layouts.showTextWall('Taking photo...');
                                            const photo = await session.camera.requestPhoto();
                                            if (!photo || !photo.data) { session.layouts.showTextWall('Photo failed. Try again.'); return; }
                                            session.layouts.showTextWall('Sending email...');
                                            await sgMail.send({ to: RECIPIENT_EMAIL, from: SENDER_EMAIL, subject: 'New Photo from Smart Glasses', text: 'Photo from Mentra smart glasses.', attachments: [{ content: photo.data, filename: 'photo.jpg', type: 'image/jpeg', disposition: 'attachment' }] });
                                            console.log('Email sent to', RECIPIENT_EMAIL);
                                            session.layouts.showTextWall('Photo sent successfully!');
                                            setTimeout(() => session.layouts.showTextWall('Ready. Press button for another photo.'), 3000);
                              } catch (err) {
                                            console.error('Error:', err.message || err);
                                            session.layouts.showTextWall('Error: ' + (err.message || 'Unknown error'));
                              }
                  });
        }
}

const app = new PhotoEmailApp();
app.start();

Bun.serve({
        port: PORT,
        async fetch(req) {
                  const url = new URL(req.url);
                  if (url.pathname === '/webview' || url.pathname === '/webview/') {
                              return new Response(WEBVIEW_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                  }
                  const target = 'http://localhost:' + SDK_PORT + url.pathname + url.search;
                  return fetch(target, { method: req.method, headers: req.headers, body: req.body });
        }
});

console.log('App running. Webview port:', PORT, 'SDK port:', SDK_PORT);
