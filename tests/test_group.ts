import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3001';

async function runGroupTest() {
  console.log('🚀 Starting Group Chat Verification Suite...\n');

  // 1. Login as Alice
  const aliceRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'alice@pulsechat.io', password: 'Password123!' }),
  });
  const aliceCookie = aliceRes.headers.get('set-cookie') || '';
  const aliceData = await aliceRes.json();
  const aliceToken = aliceData.socketToken;
  const aliceUser = aliceData.user;
  console.log(`✅ Alice logged in: ${aliceUser.displayName} (${aliceUser.id})`);

  // 2. Login as Bob
  const bobRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'bob@pulsechat.io', password: 'Password123!' }),
  });
  const bobCookie = bobRes.headers.get('set-cookie') || '';
  const bobData = await bobRes.json();
  const bobToken = bobData.socketToken;
  const bobUser = bobData.user;
  console.log(`✅ Bob logged in: ${bobUser.displayName} (${bobUser.id})`);

  // 3. Login as Adarsh
  const adarshRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'adarsh@pulsechat.io', password: 'Password123!' }),
  });
  const adarshData = await adarshRes.json();
  const adarshUser = adarshData.user;
  console.log(`✅ Adarsh logged in: ${adarshUser.displayName} (${adarshUser.id})`);

  // 4. Create a 3-person Group Chat
  console.log('\n--- Creating Group Chat ---');
  const createRes = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: aliceCookie,
    },
    body: JSON.stringify({
      title: 'Product Launch Squad',
      participantIds: [bobUser.id, adarshUser.id],
    }),
  });

  const createData = await createRes.json();
  const groupId = createData.conversationId;
  if (!groupId) {
    throw new Error('Failed to obtain conversationId for group: ' + JSON.stringify(createData));
  }
  console.log(`✅ Group conversation created! ID: ${groupId}`);

  // 5. Connect Alice and Bob to Socket.IO
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
    let connectedCount = 0;
    aliceSocket.on('connect', () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
    bobSocket.on('connect', () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
  });
  console.log('✅ Alice & Bob connected to Socket.IO server');

  // Alice and Bob join conversation room
  aliceSocket.emit('conversation:join', { conversationId: groupId });
  bobSocket.emit('conversation:join', { conversationId: groupId });
  await new Promise((r) => setTimeout(r, 600));

  // 6. Real-time message broadcast test
  console.log('\n--- Real-Time Group Broadcast Test ---');
  const receivedByBobPromise = new Promise((resolve) => {
    bobSocket.on('message:new', (msg: any) => {
      if (msg.conversationId === groupId && msg.content === 'Welcome team to the Product Launch Squad!') {
        resolve(msg);
      }
    });
  });

  const tempId = 'temp-grp-' + Date.now();
  aliceSocket.emit('message:send', {
    clientTempId: tempId,
    conversationId: groupId,
    type: 'TEXT',
    content: 'Welcome team to the Product Launch Squad!',
  });

  const receivedMsg: any = await Promise.race([
    receivedByBobPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for group message')), 5000)),
  ]);
  console.log(`✅ Bob successfully received group broadcast from Alice: "${receivedMsg.content}"`);

  // 7. Check Bob's conversation list via API
  console.log('\n--- Checking Bob Conversations Feed ---');
  const bobConvRes = await fetch(`${API_BASE}/api/conversations`, {
    headers: { Cookie: bobCookie },
  });
  const bobConvData = await bobConvRes.json();
  const myGroupInBob = bobConvData.conversations.find((c: any) => c.id === groupId);
  if (!myGroupInBob) throw new Error('Group not found in Bob conversations');
  if (!myGroupInBob.isGroup) throw new Error('Expected isGroup to be true');
  if (myGroupInBob.title !== 'Product Launch Squad') throw new Error('Incorrect group title');
  console.log(`✅ Bob sees group: "${myGroupInBob.title}", isGroup: ${myGroupInBob.isGroup}, unreadCount: ${myGroupInBob.unreadCount}`);

  aliceSocket.disconnect();
  bobSocket.disconnect();
  console.log('\n🎉 ALL GROUP CONVERSATION CHECKS PASSED WITH 100% SUCCESS!');
}

runGroupTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
