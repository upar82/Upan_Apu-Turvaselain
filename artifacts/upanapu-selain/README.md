# Upa'n Apu Selain

Turvallinen virtuaalinen nettiselain vanhemmille ja aloitteleville tietokoneen käyttäjille.
Kehitetty Upa'n Apu -brändillä (upanapu.com).

---

## Ominaisuudet

- Yksinkertainen, selkeä käyttöliittymä isoilla painikkeilla
- Opastus-tila: selittää jokaisen painikkeen suomeksi
- Kotisivu-asetus (oletus: google.fi)
- Tekstikoon valinta (normaali / suuri / erittäin suuri)
- Toimii Windows, macOS ja Linux -käyttöjärjestelmissä

---

## Nopea käynnistys (macOS tai Windows)

Helpoin tapa käyttää ja kehittää:

```bash
# 1. Siirry tähän kansioon
cd artifacts/upanapu-selain

# 2. Asenna riippuvuudet
npm install

# 3. Käynnistä ohjelma
npm run dev
```

> **Huom macOS Apple Silicon (M1/M2/M3):** Jos kohtaat virheitä, kokeile ensin `npm install`.
> Se ohittaa pnpm-työtilan asetukset ja toimii kaikilla alustoilla.

---

## Asennuspakettien rakentaminen

### macOS (.dmg)

```bash
cd artifacts/upanapu-selain
npm run dist:mac
```

Tulos: `dist/packages/Upa'n Apu Selain-1.0.0-universal.dmg`

### Windows (.exe)

```bash
cd artifacts/upanapu-selain
npm run dist:win
```

Tulos: `dist/packages/Upa'n Apu Selain Setup 1.0.0.exe`

> **Windows-paketti macOS:ltä:** Vaatii Winen asennuksen (`brew install --cask wine-stable`).
> Helpompi on rakentaa Windows-paketti Windows-koneella.

---

## Kuvake (icon)

Lisää kuvake-tiedostot `resources/`-kansioon ennen pakettien rakentamista:

| Tiedosto | Käyttöjärjestelmä | Koko |
|---|---|---|
| `resources/icon.icns` | macOS | 512×512px tai suurempi |
| `resources/icon.ico` | Windows | 256×256px |
| `resources/icon.png` | Linux | 512×512px |

**Kuvakkeen luominen macOS:llä `.icns`-muotoon:**
```bash
mkdir resources/icon.iconset
# Kopioi PNG-tiedostot oikeilla nimillä (icon_512x512.png jne.)
iconutil -c icns resources/icon.iconset -o resources/icon.icns
```

---

## Rakenne

```
artifacts/upanapu-selain/
├── src/
│   ├── main/           # Electron pääprosessi (Node.js)
│   │   ├── index.ts    # Ikkunan hallinta, IPC-käsittelijät
│   │   └── settings-store.ts  # Asetusten tallennus
│   ├── preload/        # Electron preload-skripti (IPC silta)
│   │   └── index.ts
│   └── renderer/       # React-käyttöliittymä
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/
│           │   ├── NavBar.tsx       # Navigaatiopalkki
│           │   └── SettingsPage.tsx # Asetukset
│           └── types.ts
├── resources/          # Kuvake-tiedostot
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

---

## Yhteystiedot

Upa'n Apu — Antti Keränen
- 📧 upa@upanapu.com
- 📞 040 3257025
- 🌐 upanapu.com
- 📍 Valtakatu 18, Valkeakoski
