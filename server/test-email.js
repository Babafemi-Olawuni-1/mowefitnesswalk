import 'dotenv/config';
import { sendRegistrationConfirmation } from './src/services/mailer.service.js';

async function test() {
  const result = await sendRegistrationConfirmation({
    participant: {
      email: 'babafemiolawuni@gmail.com',
      full_name: 'Test User',
      participant_id: 'TEST123',
      registered_at: new Date().toISOString(),
    },
    verifyUrl: 'https://your-app.com/verify/TEST123',
    passBuffer: null,
    eventName: 'Mowe-Ibafo X Community Fitness Walk 2026',
  });

  console.log('Result:', result);
  process.exit(result.ok ? 0 : 1);
}

test();