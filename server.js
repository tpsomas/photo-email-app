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
    console.log('New session:', sessionId, 'user:', userId);

    try {
      await session.display.showTextWall('Photo to Email - Ready');
    } catch(e) { console.log('display err:', e.message); }

    try {
      session.events?.onButtonPress(async (event) => {
        console.log('Button pressed:', event.buttonId);
        await handlePhotoCapture(session);
      });
    } catch(e) { console.log('button err:', e.message); }

    try {
      session.transcription?.on(async (data) => {
        const text = (data.text || '').toLowerCase();
        if (text.includes('take photo') || text.includes('capture')) {
          await handlePhotoCapture(session);
        }
      });
    } catch(e) { console.log('transcript err:', e.message); }
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
      try { await session.display.showTextWall('Ready - press button'); } catch(e) {}
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
