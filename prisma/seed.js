import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing records if any
  await prisma.transaction.deleteMany();
  await prisma.deviceLog.deleteMany();
  await prisma.book.deleteMany();
  await prisma.compartment.deleteMany();
  await prisma.locker.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const studentPassword = await bcrypt.hash('student123', salt);

  const admin = await prisma.user.create({
    data: {
      name: 'Dr. Sarah Connor (Librarian Admin)',
      email: 'admin@community.edu',
      password_hash: adminPassword,
      rfid_uid: 'E2000019',
      role: 'ADMIN',
    },
  });

  const student1 = await prisma.user.create({
    data: {
      name: 'Jane Doe',
      email: 'jane.doe@student.edu',
      password_hash: studentPassword,
      rfid_uid: 'A1B2C3D4',
      role: 'STUDENT',
    },
  });

  const student2 = await prisma.user.create({
    data: {
      name: 'Alex Smith',
      email: 'alex.smith@student.edu',
      password_hash: studentPassword,
      rfid_uid: 'F4E3D2C1',
      role: 'STUDENT',
    },
  });

  console.log(`👤 Users seeded: ${admin.name}, ${student1.name}, ${student2.name}`);

  // Create Lockers
  const locker1 = await prisma.locker.create({
    data: {
      id: 'locker-01',
      location_name: 'Central Library - Main Courtyard',
      compartment_count: 4,
      status: 'ONLINE',
      last_seen: new Date(),
    },
  });

  const locker2 = await prisma.locker.create({
    data: {
      id: 'locker-02',
      location_name: 'Student Center - Level 1 Lounge',
      compartment_count: 4,
      status: 'ONLINE',
      last_seen: new Date(),
    },
  });

  console.log(`🗄️ Lockers seeded: ${locker1.id}, ${locker2.id}`);

  // Create Compartments for locker-01
  const comp1_1 = await prisma.compartment.create({
    data: { locker_id: locker1.id, compartment_number: 1, status: 'OCCUPIED' },
  });
  const comp1_2 = await prisma.compartment.create({
    data: { locker_id: locker1.id, compartment_number: 2, status: 'OCCUPIED' },
  });
  const comp1_3 = await prisma.compartment.create({
    data: { locker_id: locker1.id, compartment_number: 3, status: 'EMPTY' },
  });
  const comp1_4 = await prisma.compartment.create({
    data: { locker_id: locker1.id, compartment_number: 4, status: 'LOCKED' },
  });

  // Create Compartments for locker-02
  const comp2_1 = await prisma.compartment.create({
    data: { locker_id: locker2.id, compartment_number: 1, status: 'OCCUPIED' },
  });
  const comp2_2 = await prisma.compartment.create({
    data: { locker_id: locker2.id, compartment_number: 2, status: 'EMPTY' },
  });
  const comp2_3 = await prisma.compartment.create({
    data: { locker_id: locker2.id, compartment_number: 3, status: 'EMPTY' },
  });
  const comp2_4 = await prisma.compartment.create({
    data: { locker_id: locker2.id, compartment_number: 4, status: 'EMPTY' },
  });

  // Create Books
  const book1 = await prisma.book.create({
    data: {
      title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      donor_user_id: student1.id,
      compartment_id: comp1_1.id,
      status: 'AVAILABLE',
    },
  });

  const book2 = await prisma.book.create({
    data: {
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      isbn: '978-1449373320',
      donor_user_id: admin.id,
      compartment_id: comp1_2.id,
      status: 'AVAILABLE',
    },
  });

  const book3 = await prisma.book.create({
    data: {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isbn: '978-0061120084',
      donor_user_id: student2.id,
      compartment_id: comp2_1.id,
      status: 'AVAILABLE',
    },
  });

  const book4 = await prisma.book.create({
    data: {
      title: 'The Pragmatic Programmer: Your Journey To Mastery',
      author: 'David Thomas, Andrew Hunt',
      isbn: '978-0135957059',
      donor_user_id: admin.id,
      status: 'BORROWED',
    },
  });

  console.log(`📚 Books seeded: ${book1.title}, ${book2.title}, ${book3.title}, ${book4.title}`);

  // Create Transactions
  await prisma.transaction.create({
    data: {
      user_id: student1.id,
      book_id: book1.id,
      locker_id: locker1.id,
      compartment_id: comp1_1.id,
      type: 'DONATE',
      method: 'RFID',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    },
  });

  await prisma.transaction.create({
    data: {
      user_id: student2.id,
      book_id: book4.id,
      locker_id: locker1.id,
      compartment_id: comp1_3.id,
      type: 'BORROW',
      method: 'RFID',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
    },
  });

  // Device Logs
  await prisma.deviceLog.create({
    data: {
      locker_id: locker1.id,
      event_type: 'RFID_SCAN',
      payload_json: JSON.stringify({ uid: 'A1B2C3D4', user: 'Jane Doe' }),
    },
  });

  await prisma.deviceLog.create({
    data: {
      locker_id: locker1.id,
      event_type: 'SENSOR_TRIGGER',
      payload_json: JSON.stringify({ compartment: 1, state: 'book_detected' }),
    },
  });

  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
