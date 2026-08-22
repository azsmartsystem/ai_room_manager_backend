import { PrismaClient, Role, UserStatus, RoomStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  const saltRounds = 10;
  const defaultPasswordHash = await bcrypt.hash('Password123!', saltRounds);

  // 1. Create Super Admin (Global scope)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@airoommanager.com' },
    update: {},
    create: {
      email: 'admin@airoommanager.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // 2. Create Sample Property
  const property = await prisma.property.upsert({
    where: { code: 'PROP_LAGOS_01' },
    update: {},
    create: {
      name: 'Grand Royal Hotel Lagos',
      code: 'PROP_LAGOS_01',
      address: '14 Victoria Island Boulevard',
      city: 'Lagos',
      country: 'Nigeria',
    },
  });
  console.log(`✅ Sample Property created: ${property.name} (${property.code})`);

  // 3. Create Scoped Staff Users for all roles
  const usersToSeed = [
    {
      email: 'manager@grandroyal.com',
      firstName: 'Folake',
      lastName: 'Adeyemi',
      role: Role.PROPERTY_MANAGER,
    },
    {
      email: 'frontdesk@grandroyal.com',
      firstName: 'Chinedu',
      lastName: 'Okonkwo',
      role: Role.FRONT_DESK,
    },
    {
      email: 'cleaner@grandroyal.com',
      firstName: 'Amina',
      lastName: 'Bello',
      role: Role.HOUSEKEEPING,
    },
    {
      email: 'technician@grandroyal.com',
      firstName: 'Emeka',
      lastName: 'Nwosu',
      role: Role.MAINTENANCE,
    },
    {
      email: 'security@grandroyal.com',
      firstName: 'Tunde',
      lastName: 'Bakare',
      role: Role.SECURITY,
    },
  ];

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: defaultPasswordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: UserStatus.ACTIVE,
        propertyId: property.id,
      },
    });
    console.log(`✅ User seeded: [${u.role}] ${user.email}`);
  }

  // 4. Create Building, Floors & Rooms
  const building = await prisma.building.upsert({
    where: {
      propertyId_name: {
        propertyId: property.id,
        name: 'Main Tower',
      },
    },
    update: {},
    create: {
      name: 'Main Tower',
      propertyId: property.id,
    },
  });

  const floor1 = await prisma.floor.upsert({
    where: {
      buildingId_number: {
        buildingId: building.id,
        number: 1,
      },
    },
    update: {},
    create: {
      number: 1,
      name: 'Executive Suites (Floor 1)',
      buildingId: building.id,
    },
  });

  const floor2 = await prisma.floor.upsert({
    where: {
      buildingId_number: {
        buildingId: building.id,
        number: 2,
      },
    },
    update: {},
    create: {
      number: 2,
      name: 'Deluxe Rooms (Floor 2)',
      buildingId: building.id,
    },
  });

  const roomsToSeed = [
    { number: '101', floorId: floor1.id, status: RoomStatus.VACANT_CLEAN },
    { number: '102', floorId: floor1.id, status: RoomStatus.OCCUPIED_CLEAN },
    { number: '201', floorId: floor2.id, status: RoomStatus.VACANT_DIRTY },
    { number: '202', floorId: floor2.id, status: RoomStatus.MAINTENANCE_REQUIRED },
  ];

  for (const r of roomsToSeed) {
    await prisma.room.upsert({
      where: {
        propertyId_number: {
          propertyId: property.id,
          number: r.number,
        },
      },
      update: {},
      create: {
        number: r.number,
        propertyId: property.id,
        buildingId: building.id,
        floorId: r.floorId,
        status: r.status,
        maxOccupancy: 2,
      },
    });
    console.log(`✅ Room seeded: Room ${r.number} [${r.status}]`);
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
