import { AppServer } from '@mentra/sdk';
import sgMail from '@sendgrid/mail';

const PACKAGE_NAME = process.env.PACKAGE_NAME || 'com.prosurgica.photoemail';
const MENTRAOS_API_KEY = process.env.MENTRA_API_KEY || '';
const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
const RECIPIENT_EMAIL = 'dina.psoma@gmail.com';
const PORT = parseInt(process.env.PORT || '3000');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

class PhotoEmailApp extends AppServer {
  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
  }

  protected async onSession(session, sessionId, userId) {
    console.log('New session:', sessionId, 'user:', userId);

    // Show a button to take photo
    await session.display.showTextWall('Photo to Email\nReady! Say "Take photo" or use the button.');

    // Listen for button presses
    session.events?.onButtonPress(async (event) => {
      if (event.buttonId === 'take_photo' || event.buttonId === 'capture') {
        await handlePhotoCapture(session);
      }
    });

    // Also listen for voice command "take photo"
    session.transcription?.on(async (data) => {
      const text = data.text?.toLowerCase() || '';
      if (text.includes('take photo') || text.includes('send photo') || text.includes('capture')) {
        await handlePhotoCapture(session);
      }
    });

    // Show button view
    try {
      await session.display.showButtonView?.({
        title: 'Photo to Email',
        buttons: [{ id: 'take_photo', label: '📸 Take Photo & Send' }]
      });
    } catch (e) {
      console.log('Button view not available, using text wall');
    }
  }
}

async function handlePhotoCapture(session) {
  try {
    await session.display.showTextWall('📷 Taking photo...');
    
    const photo = await session.camera.takePhoto();
    console.log('Photo taken, size:', photo?.buffer?.length || photo?.data?.length || 'unknown');
    
    await session.display.showTextWall('📧 Sending email...');

    // Get photo buffer
    let photoBuffer;
    if (photo?.buffer) {
      photoBuffer = photo.buffer;
    } else if (photo?.data) {
      photoBuffer = photo.data;
    } else if (Buffer.isBuffer(photo)) {
      photoBuffer = photo;
    }

    const emailMsg = {
      from: SENDER_EMAIL,
      to: RECIPIENT_EMAIL,
      subject: 'New Photo from Smart Glasses',
      text: 'Photo captured at: ' + new Date().toLocaleString(),
    };

    if (photoBuffer) {
      emailMsg.attachments = [{
        filename: 'photo_' + Date.now() + '.jpg',
        content: photoBuffer.toString('base64'),
        type: 'image/jpeg',
        disposition: 'attachment'
      }];
    }

    await sgMail.send(emailMsg);
    console.log('Email sent to', RECIPIENT_EMAIL);
    
    await session.display.showTextWall('✅ Photo sent to\n' + RECIPIENT_EMAIL);
    
    // Reset after 3 seconds
    setTimeout(async () => {
      try {
        await session.display.showTextWall('📸 Ready\nSay "Take photo" to capture');
      } catch(e) {}
    }, 3000);
    
  } catch (err) {
    console.error('Error in photo capture:', err);
    await session.display.showTextWall('❌ Error: ' + err.message);
  }
}

const app = new PhotoEmailApp();
app.start().then(() => {
  console.log('Photo Email App started on port', PORT);
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
