import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db, devicesTable } from "@workspace/db";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Liian monta pyyntöä, odota hetki." },
});

router.use(limiter);

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

router.post("/devices/register", async (req, res) => {
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

router.get("/devices/:code/settings", async (req, res) => {
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
    });
  } catch (err) {
    res.status(500).json({ error: "Asetuksien haku epäonnistui." });
  }
});

router.put("/devices/:code/settings", async (req, res) => {
  try {
    const { code } = req.params;
    const newSettings = req.body?.settings;

    if (!newSettings || typeof newSettings !== "object") {
      res.status(400).json({ error: "Virheelliset asetukset." });
      return;
    }

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

router.post("/devices/:code/heartbeat", async (req, res) => {
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

export default router;
