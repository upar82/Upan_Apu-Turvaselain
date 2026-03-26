import { pgTable, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const devicesTable = pgTable("devices", {
  deviceId: text("device_id").primaryKey(),
  pairCode: text("pair_code").notNull().unique(),
  settings: jsonb("settings").notNull().default({}),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  currentUrl: text("current_url"),
  visitHistory: jsonb("visit_history").notNull().default([]),
  pendingMessage: text("pending_message"),
  pairingOtp: text("pairing_otp"),
  pairingOtpExpires: timestamp("pairing_otp_expires"),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  createdAt: true,
  lastSeen: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
