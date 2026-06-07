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
      }

  async onSession(session, sessionId, userId) {
          console.log('Session started:', sessionId);
          session.layouts.showTextWall('Photo to Email ready. Press button to take a photo.');
          session.events.onButtonPress(async (buttonEvent) => {
                    try {
                                session.layouts.showTextWall('Taking photo...');
                                const photoResult = await session.camera.requestPhoto();
                                if (!photoResult || !photoResult.data) {
                                              session.layouts.showTextWall('Failed to capture photo. Try again.');
                                              return;
                                }
                                session.layouts.showTextWall('Sending email...');
                                await sgMail.send({
                                              to: RECIPIENT_EMAIL,
                                              from: SENDER_EMAIL,
                                              subject: 'New Photo from Smart Glasses',
                                              text: 'Photo from Mentra smart glasses.',
                                              attachments: [{
                                                              content: photoResult.data,
                                                              filename: 'glasses-photo.jpg',
                                                              type: 'image/jpeg',
                                                              disposition: 'attachment',
                                              }],
                                });
                                console.log('Email sent to', RECIPIENT_EMAIL);
                                session.layouts.showTextWall('Photo sent successfully!');
                                setTimeout(() => {
                                              session.layouts.showTextWall('Ready. Press button to take another photo.');
                                }, 3000);
                    } catch (error) {
                                console.error('Error:', error.message || error);
                                session.layouts.showTextWall('Error: ' + (error.message || 'Unknown error'));
                    }
          });
  }
}

const WEBVIEW_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Photo to Email</title><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#1a1a2e;color:white;text-align:center;padding:2rem}h1{font-size:2rem}p{color:#ccc}</style></head><body><div style="font-size:4rem">📷</div><h1>Photo to Email</h1><p>Press the button on your glasses to take a photo and send it to dina.psoma@gmail.com</p></body></html>';

const app = new PhotoEmailApp();

const sdkFetch = app.fetch.bind(app);

app.fetch = async function(request, env, ctx) {
      const url = new URL(request.url);
      if (url.pathname === '/webview' || url.pathname === '/webview/') {
              return new Response(WEBVIEW_HTML, {
                        status: 200,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
              });
      }
      return sdkFetch(request, env, ctx);
};

app.start();
console.log('Photo Email App started on port', PORT);
