ALTER TABLE "Booking" ADD COLUMN "activeSlotKey" TEXT;
ALTER TABLE "Booking" ADD COLUMN "activeUserSlotKey" TEXT;

UPDATE "Booking"
SET
  "activeSlotKey" = "roomId" || ':' || "date" || ':' || "startTime",
  "activeUserSlotKey" = "userId" || ':' || "date" || ':' || "startTime"
WHERE "status" IN ('BOOKED', 'CHECKED_IN');

DROP INDEX "Booking_roomId_date_startTime_key";
CREATE UNIQUE INDEX "Booking_activeSlotKey_key" ON "Booking"("activeSlotKey");
CREATE UNIQUE INDEX "Booking_activeUserSlotKey_key" ON "Booking"("activeUserSlotKey");
