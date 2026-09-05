import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with demo users and initial conversation...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Users
  const alice = await prisma.user.upsert({
    where: { email: 'alice@pulsechat.io' },
    update: {},
    create: {
      email: 'alice@pulsechat.io',
      username: 'alice',
      displayName: 'Alice Cooper',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@pulsechat.io' },
    update: {},
    create: {
      email: 'bob@pulsechat.io',
      username: 'bob',
      displayName: 'Bob Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      passwordHash,
    },
  });

  const adarsh = await prisma.user.upsert({
    where: { email: 'adarsh@pulsechat.io' },
    update: {},
    create: {
      email: 'adarsh@pulsechat.io',
      username: 'adarsh',
      displayName: 'Adarsh Singh',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      passwordHash,
    },
  });

  console.log('Created demo users:', { alice: alice.email, bob: bob.email, adarsh: adarsh.email });

  // 2. Check or Create 1-on-1 Conversation between Alice and Bob
  const existingConv = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: alice.id } } },
        { participants: { some: { userId: bob.id } } },
      ],
    },
  });

  let conversationId = existingConv?.id;

  if (!conversationId) {
    const newConv = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: alice.id },
            { userId: bob.id },
          ],
        },
      },
    });
    conversationId = newConv.id;
    console.log('Created conversation between Alice and Bob:', conversationId);

    // 3. Seed starter messages with deliberate timestamps for pagination testing
    const baseDate = new Date(Date.now() - 3600 * 1000 * 24); // 1 day ago
    const messagesData = [
      { senderId: alice.id, content: 'Hey Bob! Welcome to PulseChat 👋', type: 'TEXT', offsetMins: 1 },
      { senderId: bob.id, content: 'Hey Alice! Wow, this warm editorial UI looks incredible.', type: 'TEXT', offsetMins: 3 },
      { senderId: alice.id, content: 'Everything runs on Next.js 15, Prisma, and Socket.IO real-time delivery.', type: 'TEXT', offsetMins: 5 },
      { senderId: bob.id, content: 'Does it support optimistic sending and image moderation?', type: 'TEXT', offsetMins: 7 },
      { senderId: alice.id, content: 'Yes! Client-generated temp IDs, deterministic cursors, and server-side NSFW checks.', type: 'TEXT', offsetMins: 9 },
      { senderId: bob.id, type: 'STICKER', content: 'party-popper', offsetMins: 12 },
      { senderId: alice.id, content: 'Awesome! Testing real-time delivery receipts now.', type: 'TEXT', offsetMins: 15 },
    ];

    for (let i = 0; i < messagesData.length; i++) {
      const msg = messagesData[i];
      const createdAt = new Date(baseDate.getTime() + msg.offsetMins * 60000);
      await prisma.message.create({
        data: {
          clientTempId: `seed-msg-${i + 1}`,
          conversationId,
          senderId: msg.senderId,
          type: msg.type,
          content: msg.content,
          status: 'READ',
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
    console.log('Seeded starter messages successfully!');
  } else {
    console.log('Conversation already exists:', conversationId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
