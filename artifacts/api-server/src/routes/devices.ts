import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db, devicesTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { z } from "zod";

const deviceSettingsSchema = z.object({
  homeUrl: z.string().url().optional(),
  tutorMode: z.boolean().optional(),
  blockPayments: z.boolean().optional(),
  fontSize: z.enum(["normal", "large", "xlarge"]).optional(),
}).strict();

const router: IRouter = Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Liian monta rekisteröintipyyntöä, yritä tunnin kuluttua." },
});

const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Liian monta pyyntöä, odota hetki." },
});

function generateDeviceId(): string {
  return randomBytes(16).toString("hex");
}

function generatePairCode(): string {
  const digits = randomBytes(3).readUIntBE(0, 3) % 1000000;
  return digits.toString().padStart(6, "0");
}

function isCodeExpired(lastSeen: Date): boolean {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - lastSeen.getTime() > thirtyDays;
}

router.post("/devices/register", registerLimiter, async (req, res) => {
  try {
    const deviceId = generateDeviceId();
    let pairCode: string;
    let attempts = 0;

    while (true) {
      pairCode = generatePairCode();
      const existing = await db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.pairCode, pairCode));
      if (existing.length === 0) break;
      if (++attempts > 10) {
        res.status(503).json({ error: "Yritä uudelleen myöhemmin." });
        return;
      }
    }

    const initialSettings = req.body?.settings ?? {};

    await db.insert(devicesTable).values({
      deviceId,
      pairCode: pairCode!,
      settings: initialSettings,
      active: true,
    });

    res.status(201).json({ deviceId, pairCode: pairCode! });
  } catch (err) {
    res.status(500).json({ error: "Rekisteröinti epäonnistui." });
  }
});

router.get("/devices/:code/settings", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const rows = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy tällä koodilla." });
      return;
    }

    const device = rows[0];

    if (isCodeExpired(device.lastSeen)) {
      res.status(410).json({ error: "Laitekoodi on vanhentunut." });
      return;
    }

    res.json({
      deviceId: device.deviceId,
      settings: device.settings,
      lastSeen: device.lastSeen,
      currentUrl: device.currentUrl ?? null,
      visitHistory: device.visitHistory ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: "Asetuksien haku epäonnistui." });
  }
});

router.put("/devices/:code/settings", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const rawSettings = req.body?.settings;

    const parsed = deviceSettingsSchema.safeParse(rawSettings);
    if (!parsed.success) {
      res.status(400).json({ error: "Virheelliset asetukset.", details: parsed.error.flatten() });
      return;
    }
    const newSettings = parsed.data;

    const rows = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy tällä koodilla." });
      return;
    }

    const device = rows[0];

    if (isCodeExpired(device.lastSeen)) {
      res.status(410).json({ error: "Laitekoodi on vanhentunut." });
      return;
    }

    await db
      .update(devicesTable)
      .set({ settings: newSettings })
      .where(eq(devicesTable.pairCode, code));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Asetuksien tallennus epäonnistui." });
  }
});

router.post("/devices/:code/heartbeat", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    const result = await db
      .update(devicesTable)
      .set({ lastSeen: sql`NOW()` })
      .where(eq(devicesTable.pairCode, code))
      .returning({ deviceId: devicesTable.deviceId });

    if (result.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Heartbeat epäonnistui." });
  }
});

router.post("/devices/:code/navigate", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const url = req.body?.url as string | undefined;
    const title = req.body?.title as string | undefined;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL puuttuu." });
      return;
    }

    const rows = await db
      .select({ visitHistory: devicesTable.visitHistory })
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    const existing = (rows[0].visitHistory as Array<{ url: string; title?: string; ts: string }>) ?? [];
    const entry = { url, title: title ?? null, ts: new Date().toISOString() };
    const updated = [entry, ...existing].slice(0, 20);

    await db
      .update(devicesTable)
      .set({ currentUrl: url, visitHistory: updated })
      .where(eq(devicesTable.pairCode, code));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Navigointiraportti epäonnistui." });
  }
});

router.get("/devices/:code/message", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    const rows = await db
      .select({ pendingMessage: devicesTable.pendingMessage })
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    res.json({ message: rows[0].pendingMessage ?? null });
  } catch (err) {
    res.status(500).json({ error: "Viestin haku epäonnistui." });
  }
});

router.put("/devices/:code/message", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;
    const message = req.body?.message as string | null | undefined;

    if (message !== null && message !== undefined && typeof message !== "string") {
      res.status(400).json({ error: "Viesti pitää olla teksti tai null." });
      return;
    }

    if (typeof message === "string" && message.length > 500) {
      res.status(400).json({ error: "Viesti on liian pitkä (max 500 merkkiä)." });
      return;
    }

    const rows = await db
      .select({ deviceId: devicesTable.deviceId })
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    await db
      .update(devicesTable)
      .set({ pendingMessage: message ?? null })
      .where(eq(devicesTable.pairCode, code));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Viestin tallennus epäonnistui." });
  }
});

router.delete("/devices/:code/message", settingsLimiter, async (req, res) => {
  try {
    const { code } = req.params;

    const result = await db
      .update(devicesTable)
      .set({ pendingMessage: null })
      .where(eq(devicesTable.pairCode, code))
      .returning({ deviceId: devicesTable.deviceId });

    if (result.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Viestin tyhjennys epäonnistui." });
  }
});

export default router;
