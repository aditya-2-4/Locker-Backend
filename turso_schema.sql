-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rfid_uid" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Locker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "location_name" TEXT NOT NULL,
    "compartment_count" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "last_seen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Compartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locker_id" TEXT NOT NULL,
    "compartment_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EMPTY',
    CONSTRAINT "Compartment_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "Locker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "donor_user_id" TEXT,
    "compartment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_donor_user_id_fkey" FOREIGN KEY ("donor_user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Book_compartment_id_fkey" FOREIGN KEY ("compartment_id") REFERENCES "Compartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT,
    "locker_id" TEXT NOT NULL,
    "compartment_id" TEXT,
    "type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'RFID',
    CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "Locker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_compartment_id_fkey" FOREIGN KEY ("compartment_id") REFERENCES "Compartment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locker_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceLog_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "Locker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_rfid_uid_key" ON "User"("rfid_uid");

-- CreateIndex
CREATE UNIQUE INDEX "Compartment_locker_id_compartment_number_key" ON "Compartment"("locker_id", "compartment_number");

-- CreateIndex
CREATE UNIQUE INDEX "Book_compartment_id_key" ON "Book"("compartment_id");

