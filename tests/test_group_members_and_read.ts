import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3001';

async function runTest() {
  console.log('🚀 Starting Group Members & Read/Unread Audit...\n');

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
  console.log(`✅ Alice: ${aliceUser.displayName} (${aliceUser.id})`);

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
  console.log(`✅ Bob: ${bobUser.displayName} (${bobUser.id})`);

  // 3. Login as Adarsh
  const adarshRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'adarsh@pulsechat.io', password: 'Password123!' }),
  });
  const adarshData = await adarshRes.json();
  const adarshUser = adarshData.user;
  console.log(`✅ Adarsh: ${adarshUser.displayName} (${adarshUser.id})`);

  // 4. Alice creates a group chat with Bob
  console.log('\n--- 1. Creating Group Chat (Alice + Bob) ---');
  const createRes = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: aliceCookie,
    },
    body: JSON.stringify({
      title: 'DevOps & Architecture',
      participantIds: [bobUser.id],
    }),
  });

  const createData = await createRes.json();
  const groupId = createData.conversationId;
  console.log(`✅ Group Created! ID: ${groupId}`);

  // 5. Fetch members via GET /api/conversations/[id]/participants
  console.log('\n--- 2. Fetching Group Members ---');
  const membersRes = await fetch(`${API_BASE}/api/conversations/${groupId}/participants`, {
    headers: { Cookie: aliceCookie },
  });
  const membersData = await membersRes.json();
  console.log(`✅ Members Count: ${membersData.participants.length}`);
  console.log(`   Members: ${membersData.participants.map((p: any) => p.displayName).join(', ')}`);
  if (membersData.participants.length !== 2) throw new Error('Expected 2 members initially');

  // 6. Alice adds Adarsh via POST /api/conversations/[id]/participants
  console.log('\n--- 3. Adding New Member (Adarsh) to Group ---');
  const addRes = await fetch(`${API_BASE}/api/conversations/${groupId}/participants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: aliceCookie,
    },
    body: JSON.stringify({ userIds: [adarshUser.id] }),
  });
  const addData = await addRes.json();
  console.log(`✅ Updated Members Count: ${addData.participants.length}`);
  console.log(`   Updated Members: ${addData.participants.map((p: any) => p.displayName).join(', ')}`);
  if (addData.participants.length !== 3) throw new Error('Expected 3 members after adding Adarsh');

  // 7. Connect Alice and Bob to Socket.IO and join group room
  console.log('\n--- 4. Socket.IO Real-Time Read/Seen State Test ---');
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

  aliceSocket.emit('conversation:join', { conversationId: groupId });
  bobSocket.emit('conversation:join', { conversationId: groupId });
  await new Promise((r) => setTimeout(r, 600));

  // 8. Alice sends message
  const msgReceivedPromise = new Promise((resolve) => {
    bobSocket.on('message:new', (msg: any) => {
      if (msg.conversationId === groupId) resolve(msg);
    });
  });

  aliceSocket.emit('message:send', {
    clientTempId: 'temp-read-' + Date.now(),
    conversationId: groupId,
    type: 'TEXT',
    content: 'Review the architecture diagram for deploy!',
  });

  const sentMsg: any = await msgReceivedPromise;
  console.log(`✅ Message broadcast received by Bob: "${sentMsg.content}"`);

  // 9. Bob views/reads message -> emits message:mark_read
  console.log('\n--- 5. Bob Marks Message as Read ---');
  const readStatusPromise = new Promise((resolve) => {
    aliceSocket.on('message:status_update', (statusData: any) => {
      if (statusData.conversationId === groupId && statusData.status === 'READ') {
        resolve(statusData);
      }
    });
  });

  bobSocket.emit('message:mark_read', {
    conversationId: groupId,
    messageId: sentMsg.id,
  });

  const statusUpdate: any = await Promise.race([
    readStatusPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for read status update')), 5000)),
  ]);

  console.log(`✅ Alice received read receipt: status=${statusUpdate.status}, by userId=${statusUpdate.userId}`);
  if (statusUpdate.userId !== bobUser.id) throw new Error('Expected Bob to be the reader');

  aliceSocket.disconnect();
  bobSocket.disconnect();

  console.log('\n🎉 ALL GROUP MEMBERS & REAL-TIME READ AUDIT CHECKS PASSED WITH 100% SUCCESS!');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
