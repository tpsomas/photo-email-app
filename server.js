import { AppServer } from '@mentra/sdk';
import sgMail from '@sendgrid/mail';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.prosurgica.photoemail';
const MENTRAOS_API_KEY = process.env.MENTRA_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';
const PORT = parseInt(process.env.PORT || '3000');
const SDK_PORT = PORT + 1;

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

class PhotoEmailApp extends AppServer {
  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: SDK_PORT,
    });
  }

  async onSession(session, sessionId, userId) {
    console.log('Session started:', sessionId, 'User:', userId);

    session.events.onButtonPress(async (buttonEvent) => {
      console.log('Button pressed! Type:', buttonEvent.type);

      try {
        session.layouts.showTextWall('Taking photo...');
        console.log('Requesting photo...');

        const photo = await session.camera.requestPhoto();
        console.log('Photo received! Keys:', Object.keys(photo));
        console.log('mimeType:', photo.mimeType, 'size:', photo.size);

        let base64Data;
        const buf = photo.buffer;
        if (Buffer.isBuffer(buf)) {
          base64Data = buf.toString('base64');
        } else if (buf instanceof Uint8Array) {
          base64Data = Buffer.from(buf).toString('base64');
        } else if (typeof buf === 'string') {
          base64Data = buf;
        } else {
          base64Data = Buffer.from(Object.values(buf)).toString('base64');
        }

        console.log('base64Data length:', base64Data.length);

        const mimeType = photo.mimeType || 'image/jpeg';
        const extension = mimeType.includes('png') ? 'png' : 'jpg';

        session.layouts.showTextWall('Sending email...');

        const msg = {
          to: RECIPIENT_EMAIL,
          from: SENDER_EMAIL,
          subject: 'New Photo from Smart Glasses',
          text: 'A photo was taken with the smart glasses.',
          html: '<p>A photo was taken with the smart glasses. See attachment.</p>',
          attachments: [{
            content: base64Data,
            filename: `photo_${Date.now()}.${extension}`,
            type: mimeType,
            disposition: 'attachment',
          }],
        };

        const [response] = await sgMail.send(msg);
        console.log('Email sent! Status:', response.statusCode);

        session.layouts.showTextWall(`Photo sent to ${RECIPIENT_EMAIL}!`);
        setTimeout(() => session.layouts.showTextWall('Press button to take another photo'), 3000);

      } catch (error) {
        console.error('ERROR:', error.message);
        if (error.response) {
          console.error('SendGrid error:', JSON.stringify(error.response.body));
        }
        session.layouts.showTextWall('Error: ' + error.message);
      }
    });

    session.layouts.showTextWall('Ready! Press button to take a photo.');
  }
}

const app = new PhotoEmailApp();

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/webview') {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Photo to Email</title>
<style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f0f0f0;}
h1{color:#333;}p{color:#555;font-size:18px;}</style></head>
<body><h1>Photo to Email</h1><p>App is running!</p>
<p>Press the button on your glasses to take a photo and send it to ${RECIPIENT_EMAIL}</p>
</body></html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Stream proxy - pass body as stream (no buffering) to avoid timeouts
    const targetUrl = `http://localhost:${SDK_PORT}${url.pathname}${url.search}`;
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      return response;
    } catch (e) {
      console.error('Proxy error:', e.message, url.pathname);
      return new Response('Proxy error: ' + e.message, { status: 502 });
    }
  },
});

console.log(`Webview on ${PORT}, SDK on ${SDK_PORT}`);
app.start();
