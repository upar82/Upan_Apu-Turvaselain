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
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({
  createdAt: true,
  lastSeen: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
