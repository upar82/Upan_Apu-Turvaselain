# Upa'n Apu Selain

Turvallinen virtuaalinen nettiselain vanhemmille ja aloitteleville tietokoneen käyttäjille.
Kehitetty Upa'n Apu -brändillä (upanapu.com).

---

## Ominaisuudet

- Yksinkertainen, selkeä käyttöliittymä isoilla painikkeilla
- Opastus-tila: selittää jokaisen painikkeen suomeksi
- Tutori (🎓) varoittaa epäturvallisista tai maksusivuista
- Toimii Windows, macOS ja Linux -käyttöjärjestelmissä

---

## Windows .exe -asennus — latausohjeet

Windows-asennuspaketti rakennetaan automaattisesti GitHub Actionsin avulla
aina kun koodi päivitetään GitHubiin.

**Näin lataat asennuspaketin:**

1. Avaa projektin GitHub-sivu
2. Napsauta yläosan **Actions**-välilehteä
3. Valitse viimeisin onnistunut **Build Windows** -ajo (vihreä ruksi ✅)
4. Selaa alas kohtaan **Artifacts**
5. Lataa **Upan-Apu-Selain-Windows** -paketti
6. Pura zip-tiedosto ja käynnistä jokin seuraavista:
   - **`Upa'n Apu Selain Setup 1.0.0.exe`** — täysi asennusohjelma (suositellaan)
   - **`Upa'n Apu Selain 1.0.0.exe`** — portable, ei asennusta tarvita

> **Huom:** Windows saattaa kysyä vahvistuksen tuntemattomalle ohjelmalle — valitse
> "Lisätiedot" → "Suorita silti". Tämä johtuu siitä, että ohjelmaa ei ole vielä
> allekirjoitettu kaupallisella sertifikaatilla.

---

## Kehitysympäristö — nopea käynnistys

```bash
# 1. Siirry tähän kansioon
cd artifacts/upanapu-selain

# 2. Asenna riippuvuudet (pnpm-työtilassa)
pnpm install

# 3. Käynnistä ohjelma kehitystilassa
pnpm run dev
```

---

## Asennuspakettien rakentaminen paikallisesti

### Windows (.exe) — GitHub Actions (suositellaan)

Työnne hakemistosta `.github/workflows/build-windows.yml` hoitaa rakentamisen
automaattisesti Windows-ympäristössä. Katso lataamisohjeet yllä.

### Windows (.exe) — Windows-koneella suoraan

```bash
cd artifacts/upanapu-selain
pnpm run dist:win
```

Tulos: `dist/packages/Upa'n Apu Selain Setup 1.0.0.exe`  
ja: `dist/packages/Upa'n Apu Selain 1.0.0.exe` (portable)

### macOS (.dmg)

```bash
cd artifacts/upanapu-selain
pnpm run dist:mac
```

Tulos: `dist/packages/Upa'n Apu Selain-1.0.0-universal.dmg`

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
│           │   ├── NavBar.tsx        # Navigaatiopalkki + tutori
│           │   └── WelcomeScreen.tsx # Ensikäynnistyksen tervetuloruutu
│           └── types.ts
├── resources/          # Kuvake-tiedostot (icon.ico, icon.png)
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
