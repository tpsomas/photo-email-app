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
              console.log('Button pressed:', buttonEvent);

                                         try {
                                                   session.layouts.showTextWall('Taking photo...');

                const photoResult = await session.camera.requestPhoto();
                                                   console.log('Photo captured');

                if (!photoResult || !photoResult.data) {
                            session.layouts.showTextWall('Failed to capture photo. Try again.');
                            return;
                }

                session.layouts.showTextWall('Sending email...');

                const msg = {
                            to: RECIPIENT_EMAIL,
                            from: SENDER_EMAIL,
                            subject: 'New Photo from Smart Glasses',
                            text: 'A new photo was captured from your Mentra smart glasses.',
                            attachments: [
                              {
                                              content: photoResult.data,
                                              filename: 'glasses-photo.jpg',
                                              type: 'image/jpeg',
                                              disposition: 'attachment',
                              },
                                        ],
                };

                await sgMail.send(msg);
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

const app = new PhotoEmailApp();
app.start();
console.log('Photo Email App started on port', PORT);
