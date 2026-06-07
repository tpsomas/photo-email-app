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
                      console.log('Session started:', sessionId, 'user:', userId);
                      session.layouts.showTextWall('Photo to Email ready. Press button to take a photo.');
                      session.events.onButtonPress(async () => {
                                    console.log('Button pressed! Taking photo...');
                                    try {
                                                    session.layouts.showTextWall('Taking photo...');
                                                    const photo = await session.camera.requestPhoto();
                                                    console.log('Photo result type:', typeof photo, 'keys:', photo ? Object.keys(photo) : 'null');
                                                    if (!photo) {
                                                                      console.log('No photo returned');
                                                                      session.layouts.showTextWall('No photo returned. Try again.');
                                                                      return;
                                                    }
                                                    const photoData = photo.data || photo;
                                                    console.log('photoData type:', typeof photoData, 'isBuffer:', Buffer.isBuffer(photoData));
                                                    let base64Data;
                                                    if (typeof photoData === 'string') {
                                                                      base64Data = photoData;
                                                    } else if (Buffer.isBuffer(photoData)) {
                                                                      base64Data = photoData.toString('base64');
                                                    } else if (photoData instanceof Uint8Array) {
                                                                      base64Data = Buffer.from(photoData).toString('base64');
                                                    } else {
                                                                      base64Data = Buffer.from(photoData).toString('base64');
                                                    }
                                                    console.log('base64Data length:', base64Data.length, 'first 50 chars:', base64Data.substring(0, 50));
                                                    session.layouts.showTextWall('Sending email...');
                                                    const mimeType = (photo.mimeType || photo.mime_type || photo.type || 'image/jpeg');
                                                    const ext = mimeType.includes('png') ? 'png' : 'jpg';
                                                    await sgMail.send({
                                                                      to: RECIPIENT_EMAIL,
                                                                      from: SENDER_EMAIL,
                                                                      subject: 'New Photo from Smart Glasses',
                                                                      text: 'A photo was captured from your Mentra smart glasses.',
                                                                      attachments: [{
                                                                                          content: base64Data,
                                                                                          filename: 'glasses-photo.' + ext,
                                                                                          type: mimeType,
                                                                                          disposition: 'attachment',
                                                                      }],
                                                    });
                                                    console.log('Email sent successfully to', RECIPIENT_EMAIL);
                                                    session.layouts.showTextWall('Photo sent to ' + RECIPIENT_EMAIL + '!');
                                                    setTimeout(() => session.layouts.showTextWall('Ready. Press button for another photo.'), 4000);
                                    } catch (err) {
                                                    console.error('ERROR taking photo or sending email:', err);
                                                    console.error('Error message:', err.message);
                                                    console.error('Error code:', err.code);
                                                    if (err.response) console.error('SendGrid response:', JSON.stringify(err.response.body));
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
