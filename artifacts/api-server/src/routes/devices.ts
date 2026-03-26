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

const pairingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => (req.params as { code: string }).code,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Liian monta yhdistämispyyntöä. Odota 10 minuuttia." },
});

function generateDeviceId(): string {
  return randomBytes(16).toString("hex");
}

const PAIR_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ALPHABET_LEN = PAIR_CODE_ALPHABET.length; // 32 — power of two, no bias

function generatePairCode(): string {
  let code = "";
  while (code.length < 12) {
    const batch = randomBytes(32);
    for (const byte of batch) {
      // Reject bytes >= 224 (7*32) so every kept byte maps uniformly to 0..31
      if (byte < 224) {
        code += PAIR_CODE_ALPHABET[byte % ALPHABET_LEN];
        if (code.length === 12) break;
      }
    }
  }
  return code;
}

function generateOtp(): string {
  // Rejection sampling for uniform distribution in [0, 9999]
  let n: number;
  do {
    n = randomBytes(2).readUInt16BE(0); // 0..65535
  } while (n >= 60000); // 60000 = floor(65536/10000)*10000, avoids bias
  return String(n % 10000).padStart(4, "0");
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
    const code = req.params["code"] as string;
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
      pairingOtp: device.pairingOtp ?? null,
      pairingOtpExpires: device.pairingOtpExpires ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Asetuksien haku epäonnistui." });
  }
});

router.put("/devices/:code/settings", settingsLimiter, async (req, res) => {
  try {
    const code = req.params["code"] as string;
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

router.post("/devices/:code/request-pairing", pairingLimiter, async (req, res) => {
  try {
    const code = req.params["code"] as string;

    const rows = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    const device = rows[0];

    if (isCodeExpired(device.lastSeen)) {
      res.status(410).json({ error: "Laitekoodi on vanhentunut." });
      return;
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db
      .update(devicesTable)
      .set({ pairingOtp: otp, pairingOtpExpires: expiresAt })
      .where(eq(devicesTable.pairCode, code));

    res.json({ requested: true, expiresIn: 300 });
  } catch (err) {
    res.status(500).json({ error: "Yhdistämispyynnön lähetys epäonnistui." });
  }
});

router.post("/devices/:code/confirm-pairing", settingsLimiter, async (req, res) => {
  try {
    const code = req.params["code"] as string;
    const otp = (req.body?.otp as string | undefined)?.trim();

    if (!otp || !/^\d{4}$/.test(otp)) {
      res.status(400).json({ error: "OTP puuttuu tai on virheellinen muoto." });
      return;
    }

    const rows = await db
      .select()
      .from(devicesTable)
      .where(eq(devicesTable.pairCode, code));

    if (rows.length === 0) {
      res.status(404).json({ error: "Laitetta ei löydy." });
      return;
    }

    const device = rows[0];

    if (!device.pairingOtp || !device.pairingOtpExpires) {
      res.status(400).json({ error: "Ei aktiivista yhdistämispyyntöä. Pyydä uusi koodi." });
      return;
    }

    if (new Date() > device.pairingOtpExpires) {
      res.status(400).json({ error: "Koodi on vanhentunut. Pyydä uusi koodi." });
      return;
    }

    if (device.pairingOtp !== otp) {
      res.status(400).json({ error: "Väärä koodi. Tarkista koodi ja yritä uudelleen." });
      return;
    }

    // Clear OTP after successful confirmation
    await db
      .update(devicesTable)
      .set({ pairingOtp: null, pairingOtpExpires: null })
      .where(eq(devicesTable.pairCode, code));

    res.json({ confirmed: true });
  } catch (err) {
    res.status(500).json({ error: "Vahvistus epäonnistui." });
  }
});

router.post("/devices/:code/heartbeat", settingsLimiter, async (req, res) => {
  try {
    const code = req.params["code"] as string;

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
    const code = req.params["code"] as string;
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
    const code = req.params["code"] as string;

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
    const code = req.params["code"] as string;
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
    const code = req.params["code"] as string;

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
