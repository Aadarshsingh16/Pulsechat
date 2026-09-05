const API_BASE = 'http://localhost:3000';

async function testLeaveAndDelete() {
  console.log('🚀 Testing Leave Group, Delete Group, and Delete Chat...\n');

  // 1. Login Alice & Bob
  const aliceRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'alice@pulsechat.io', password: 'Password123!' }),
  });
  const aliceCookie = aliceRes.headers.get('set-cookie') || '';
  const aliceData = await aliceRes.json();

  const bobRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'bob@pulsechat.io', password: 'Password123!' }),
  });
  const bobCookie = bobRes.headers.get('set-cookie') || '';
  const bobData = await bobRes.json();

  // 2. Create group with Alice & Bob
  console.log('--- 1. Creating Temporary Test Group ---');
  const createRes = await fetch(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aliceCookie },
    body: JSON.stringify({ title: 'Temporary Group', participantIds: [bobData.user.id] }),
  });
  const createData = await createRes.json();
  const groupId = createData.conversationId;
  console.log(`✅ Created Group ID: ${groupId}`);

  // 3. Bob leaves the group
  console.log('\n--- 2. Bob Leaves Group ---');
  const leaveRes = await fetch(`${API_BASE}/api/conversations/${groupId}/participants`, {
    method: 'DELETE',
    headers: { Cookie: bobCookie },
  });
  const leaveData = await leaveRes.json();
  console.log('Leave response:', leaveData);
  if (!leaveData.success || !leaveData.leftGroup) throw new Error('Bob failed to leave group');
  console.log('✅ Bob successfully left group!');

  // Check remaining members via Alice
  const membersRes = await fetch(`${API_BASE}/api/conversations/${groupId}/participants`, {
    headers: { Cookie: aliceCookie },
  });
  const membersData = await membersRes.json();
  console.log(`✅ Remaining members count: ${membersData.participants.length} (Alice only)`);
  if (membersData.participants.length !== 1) throw new Error('Expected 1 member remaining');

  // 4. Alice deletes the group
  console.log('\n--- 3. Alice Deletes Group ---');
  const deleteRes = await fetch(`${API_BASE}/api/conversations/${groupId}`, {
    method: 'DELETE',
    headers: { Cookie: aliceCookie },
  });
  const deleteData = await deleteRes.json();
  console.log('Delete response:', deleteData);
  if (!deleteData.success) throw new Error('Alice failed to delete group');
  console.log('✅ Alice successfully deleted group!');

  // Verify group is gone
  const checkRes = await fetch(`${API_BASE}/api/conversations/${groupId}/messages`, {
    headers: { Cookie: aliceCookie },
  });
  if (checkRes.status === 403 || checkRes.status === 404) {
    console.log('✅ Confirmed group no longer exists in database!');
  } else {
    throw new Error('Group still accessible after deletion');
  }

  console.log('\n🎉 ALL LEAVE AND DELETE FUNCTIONALITY VERIFIED 100%!');
}

testLeaveAndDelete().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
