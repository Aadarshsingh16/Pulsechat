import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3001';

async function testProfanityRejection() {
  console.log('🚀 Testing Server-Side Profanity Pre-Delivery Rejection...\n');

  // 1. Login Alice
  const aliceRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'alice@pulsechat.io', password: 'Password123!' }),
  });
  const aliceCookie = aliceRes.headers.get('set-cookie') || '';
  const aliceData = await aliceRes.json();
  const aliceToken = aliceData.socketToken;

  // 2. Login Bob
  const bobRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'bob@pulsechat.io', password: 'Password123!' }),
  });
  const bobCookie = bobRes.headers.get('set-cookie') || '';
  const bobData = await bobRes.json();
  const bobToken = bobData.socketToken;

  // 3. Connect sockets
  const aliceSocket = io(SOCKET_URL, {
    auth: { token: aliceToken },
    extraHeaders: { Cookie: aliceCookie },
    transports: ['websocket'],
  });
  const bobSocket = io(SOCKET_URL, {
    auth: { token: bobToken },
    extraHeaders: { Cookie: bobCookie },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    let count = 0;
    aliceSocket.on('connect', () => { if (++count === 2) resolve(); });
    bobSocket.on('connect', () => { if (++count === 2) resolve(); });
  });

  // Fetch a shared conversation
  const convRes = await fetch(`${API_BASE}/api/conversations`, { headers: { Cookie: aliceCookie } });
  const convs = await convRes.json();
  const directConv = convs.conversations[0];
  const conversationId = directConv.id;

  aliceSocket.emit('conversation:join', { conversationId });
  bobSocket.emit('conversation:join', { conversationId });
  await new Promise((r) => setTimeout(r, 500));

  // Bob tracks any received messages
  let bobReceivedProfanity = false;
  bobSocket.on('message:new', (msg) => {
    if (msg.content.includes('fuck') || msg.content.includes('shit')) {
      bobReceivedProfanity = true;
    }
  });

  // Alice attempts to send "fuck"
  console.log('--- Attempting to send profanity "fuck" ---');
  const sendResult: any = await new Promise((resolve) => {
    aliceSocket.emit(
      'message:send',
      {
        clientTempId: 'temp-profanity-' + Date.now(),
        conversationId,
        type: 'TEXT',
        content: 'This is a fucking test',
      },
      (ack: any) => resolve(ack)
    );
  });

  console.log('Server ACK response:', sendResult);

  if (sendResult.success === false && sendResult.isModerated === true) {
    console.log(`✅ SUCCESS: Server strictly blocked message before delivery! Error: "${sendResult.error}"`);
  } else {
    throw new Error('FAILED: Server did not block profanity message!');
  }

  await new Promise((r) => setTimeout(r, 600));

  if (bobReceivedProfanity) {
    throw new Error('FAILED: Recipient received profanity message!');
  } else {
    console.log('✅ SUCCESS: Recipient was NEVER delivered the prohibited message!');
  }

  aliceSocket.disconnect();
  bobSocket.disconnect();
  console.log('\n🎉 ALL PROFANITY BLOCKING CHECKS PASSED!');
}

testProfanityRejection().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
