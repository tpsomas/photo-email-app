const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Dynamically find the correct export
const mentraSdk = require('@mentra/sdk');
console.log('SDK exports:', Object.keys(mentraSdk));

// Try all possible export patterns
const AppClass = mentraSdk.MentraApp 
  || mentraSdk.TpaServer 
  || mentraSdk.App 
  || mentraSdk.default?.MentraApp 
  || mentraSdk.default;

const TpaType = mentraSdk.TpaType || mentraSdk.default?.TpaType || { STANDARD: 'standard' };

console.log('AppClass:', AppClass);
console.log('TpaType:', TpaType);

const app = new AppClass({
  packageName: 'com.prosurgica.photoemail',
  apiKey: process.env.MENTRA_API_KEY,
  port: process.env.PORT || 3000,
  tpaType: TpaType.STANDARD,
  onSession: async (session) => {
    await session.layouts.showButtonView({
      title: 'Photo to Email',
      buttons: [{ id: 'take_photo', label: 'Take Photo & Send' }]
    });
    session.events.onButtonPress(async (event) => {
      if (event.buttonId === 'take_photo') {
        await session.layouts.showTextView({ text: 'Taking photo...' });
        const photo = await session.camera.takePhoto();
        await session.layouts.showTextView({ text: 'Sending email...' });
        await sgMail.send({
          from: process.env.SENDER_EMAIL,
          to: 'dina.psoma@gmail.com',
          subject: 'New Photo from Smart Glasses',
          text: 'Photo taken at: ' + new Date().toLocaleString(),
          attachments: [{ filename: 'photo_' + Date.now() + '.jpg', content: photo.buffer.toString('base64'), type: 'image/jpeg', disposition: 'attachment' }]
        });
        await session.layouts.showTextView({ text: 'Sent!' });
        setTimeout(async () => {
          await session.layouts.showButtonView({ title: 'Photo to Email', buttons: [{ id: 'take_photo', label: 'Take Photo & Send' }] });
        }, 3000);
      }
    });
  }
});

app.start();
