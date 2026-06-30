import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://vaxhuzmrwhctjxaabemj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZheGh1em1yd2hjdGp4YWFiZW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjQxNzIsImV4cCI6MjA5NzY0MDE3Mn0.7gvOLzQzeckg939R6ObcT4ebGqLHfSEKH3X5sYhpC-M";
const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_CATS = {
  drone: { label: "Drone / UAV", attrs: [
    { key: "mtow",    label: "Berat lepas landas maks.", short: "Berat",     unit: "g",     type: "num", better: "low" },
    { key: "payload", label: "Kapasitas payload",        short: "Payload",   unit: "g",     type: "num", better: "high" },
    { key: "flight",  label: "Waktu terbang",            short: "Terbang",   unit: "menit", type: "num", better: "high" },
    { key: "range",   label: "Jangkauan kendali",        short: "Jangkauan", unit: "km",    type: "num", better: "high" },
    { key: "wind",    label: "Resistensi angin",         short: "Angin",     unit: "m/s",   type: "num", better: "high" },
    { key: "ip",      label: "Rating IP",                short: "IP",        unit: "",      type: "txt" },
    { key: "rtk",     label: "RTK terintegrasi",         short: "RTK",       unit: "",      type: "bool" },
  ]},
  total_station: { label: "Total Station", attrs: [
    { key: "ang",    label: "Akurasi sudut",          short: "Akurasi sdt", unit: "\u2033", type: "num", better: "low" },
    { key: "dist",   label: "Akurasi jarak",          short: "Akurasi jrk", unit: "mm",     type: "num", better: "low" },
    { key: "prism",  label: "Jangkauan prisma",       short: "Prisma",      unit: "m",      type: "num", better: "high" },
    { key: "norefl", label: "Jangkauan tanpa prisma", short: "Tanpa prisma",unit: "m",      type: "num", better: "high" },
    { key: "mag",    label: "Perbesaran teropong",    short: "Perbesaran",  unit: "x",      type: "num", better: "high" },
    { key: "weight", label: "Berat instrumen",        short: "Berat",       unit: "g",      type: "num", better: "low" },
  ]},
  gnss: { label: "GNSS Receiver", attrs: [
    { key: "channels", label: "Jumlah kanal",           short: "Kanal",      unit: "",     type: "num", better: "high" },
    { key: "acc_h",    label: "Akurasi horizontal RTK", short: "Akurasi H",  unit: "mm",   type: "num", better: "low" },
    { key: "acc_v",    label: "Akurasi vertikal RTK",   short: "Akurasi V",  unit: "mm",   type: "num", better: "low" },
    { key: "constel",  label: "Konstelasi didukung",    short: "Konstelasi", unit: "",     type: "num", better: "high" },
    { key: "battery",  label: "Daya tahan baterai",     short: "Baterai",    unit: "jam",  type: "num", better: "high" },
    { key: "weight",   label: "Berat receiver",         short: "Berat",      unit: "g",    type: "num", better: "low" },
    { key: "ip",       label: "Rating IP",              short: "IP",         unit: "",     type: "txt" },
  ]},
  autolevel: { label: "Auto Level", attrs: [
    { key: "acc",      label: "Akurasi (km, double run)", short: "Akurasi",   unit: "mm",  type: "num", better: "low" },
    { key: "mag",      label: "Perbesaran teropong",      short: "Perbesaran",unit: "x",   type: "num", better: "high" },
    { key: "minfocus", label: "Jarak fokus minimum",      short: "Fokus min", unit: "m",   type: "num", better: "low" },
    { key: "range",    label: "Jangkauan ukur",           short: "Jangkauan", unit: "m",   type: "num", better: "high" },
    { key: "weight",   label: "Berat instrumen",          short: "Berat",     unit: "g",   type: "num", better: "low" },
  ]},
  lidar: { label: "Payload — LiDAR", attrs: [
    { key: "range",    label: "Jangkauan deteksi", short: "Jangkauan", unit: "m",      type: "num", better: "high" },
    { key: "accuracy", label: "Akurasi sistem",    short: "Akurasi",   unit: "cm",     type: "num", better: "low" },
    { key: "rate",     label: "Kecepatan titik",   short: "Kec. titik",unit: "rb/dtk", type: "num", better: "high" },
    { key: "returns",  label: "Jumlah return",     short: "Return",    unit: "",       type: "num", better: "high" },
    { key: "weight",   label: "Berat unit",        short: "Berat",     unit: "g",      type: "num", better: "low" },
    { key: "camera",   label: "Kamera RGB",        short: "Kamera",    unit: "MP",     type: "num", better: "high" },
  ]},
  camera: { label: "Payload — Kamera", attrs: [
    { key: "res",     label: "Resolusi",        short: "Resolusi", unit: "MP",      type: "num", better: "high" },
    { key: "pixel",   label: "Ukuran piksel",   short: "Piksel",   unit: "µm", type: "num", better: "high" },
    { key: "gsd",     label: "GSD min @100m",   short: "GSD",      unit: "cm",      type: "num", better: "low" },
    { key: "band",    label: "Jumlah band",     short: "Band",     unit: "",        type: "num", better: "high" },
    { key: "weight",  label: "Berat unit",      short: "Berat",    unit: "g",       type: "num", better: "low" },
    { key: "shutter", label: "Shutter mekanis", short: "Shutter",  unit: "",        type: "bool" },
  ]},
};

const SEED_PRODUCTS = [
  { id: "chc-x500", cat: "drone", brand: "CHC", model: "BB4 UAV X500", utama: true,  specs: { mtow: 5200, payload: 1500, flight: 55, range: 8, wind: 12, ip: "IP55", rtk: true } },
  { id: "dji-m400", cat: "drone", brand: "DJI", model: "Matrice 400",  utama: false, specs: { mtow: 6000, payload: 2000, flight: 59, range: 20, wind: 12, ip: "IP55", rtk: true } },
  { id: "dji-m350", cat: "drone", brand: "DJI", model: "Matrice 350 RTK", utama: false, specs: { mtow: 6300, payload: 1300, flight: 55, range: 20, wind: 12, ip: "IP55", rtk: true } },
  { id: "dji-m300", cat: "drone", brand: "DJI", model: "Matrice 300 RTK", utama: false, specs: { mtow: 6300, payload: 1170, flight: 55, range: 15, wind: 15, ip: "IP45", rtk: true } },

  { id: "chc-cts112",  cat: "total_station", brand: "CHC",    model: "CTS-112R4", utama: true,  specs: { ang: 2, dist: 2,   prism: 5000, norefl: 800,  mag: 30, weight: 5400 } },
  { id: "leica-ts07",  cat: "total_station", brand: "Leica",  model: "TS07",      utama: false, specs: { ang: 1, dist: 1.5, prism: 3500, norefl: 1000, mag: 30, weight: 5100 } },
  { id: "topcon-gm52", cat: "total_station", brand: "Topcon", model: "GM-52",     utama: false, specs: { ang: 2, dist: 2,   prism: 6000, norefl: 1000, mag: 30, weight: 5200 } },
  { id: "sokkia-ix505",cat: "total_station", brand: "Sokkia", model: "iX-505",    utama: false, specs: { ang: 5, dist: 2,   prism: 6000, norefl: 800,  mag: 30, weight: 5300 } },
  { id: "south-n7",    cat: "total_station", brand: "South",  model: "N7",        utama: false, specs: { ang: 2, dist: 2,   prism: 5000, norefl: 600,  mag: 30, weight: 5500 } },

  { id: "chc-i93",      cat: "gnss", brand: "CHC",     model: "i93 IMU-RTK",   utama: true,  specs: { channels: 1408, acc_h: 8,  acc_v: 15, constel: 7, battery: 16, weight: 940,  ip: "IP67" } },
  { id: "trimble-r12i", cat: "gnss", brand: "Trimble", model: "R12i",          utama: false, specs: { channels: 672,  acc_h: 8,  acc_v: 15, constel: 6, battery: 6,  weight: 1120, ip: "IP67" } },
  { id: "leica-gs18",   cat: "gnss", brand: "Leica",   model: "GS18 T",        utama: false, specs: { channels: 555,  acc_h: 8,  acc_v: 15, constel: 5, battery: 8,  weight: 830,  ip: "IP68" } },
  { id: "topcon-hiper", cat: "gnss", brand: "Topcon",  model: "Hiper VR",      utama: false, specs: { channels: 226,  acc_h: 10, acc_v: 15, constel: 5, battery: 7,  weight: 1010, ip: "IP67" } },
  { id: "south-g1",     cat: "gnss", brand: "South",   model: "Galaxy G1 Plus",utama: false, specs: { channels: 1598, acc_h: 8,  acc_v: 15, constel: 7, battery: 12, weight: 970,  ip: "IP68" } },

  { id: "sokkia-b40a", cat: "autolevel", brand: "Sokkia", model: "B40A",   utama: false, specs: { acc: 2.0, mag: 24, minfocus: 0.2, range: 100, weight: 1500 } },
  { id: "leica-na532", cat: "autolevel", brand: "Leica",  model: "NA532",  utama: false, specs: { acc: 1.8, mag: 32, minfocus: 0.3, range: 120, weight: 1600 } },
  { id: "topcon-atb4a",cat: "autolevel", brand: "Topcon", model: "AT-B4A", utama: false, specs: { acc: 2.0, mag: 24, minfocus: 0.2, range: 100, weight: 1500 } },
  { id: "nikon-ax2s",  cat: "autolevel", brand: "Nikon",  model: "AX-2S",  utama: false, specs: { acc: 2.5, mag: 20, minfocus: 0.5, range: 90,  weight: 1300 } },

  { id: "chc-aa6",   cat: "lidar", brand: "CHC",   model: "AlphaAir 6 (AA6)",  utama: true,  specs: { range: 200, accuracy: 3,   rate: 240, returns: 3, weight: 1100, camera: 26 } },
  { id: "chc-aa10",  cat: "lidar", brand: "CHC",   model: "AlphaAir 10 (AA10)",utama: true,  specs: { range: 450, accuracy: 2,   rate: 320, returns: 5, weight: 1280, camera: 26 } },
  { id: "dji-l2",    cat: "lidar", brand: "DJI",   model: "Zenmuse L2",        utama: false, specs: { range: 250, accuracy: 4,   rate: 240, returns: 5, weight: 905,  camera: 20 } },
  { id: "riegl-vux", cat: "lidar", brand: "RIEGL", model: "miniVUX-3UAV",      utama: false, specs: { range: 300, accuracy: 1.5, rate: 300, returns: 5, weight: 1600, camera: 26 } },

  { id: "phaseone-ixm", cat: "camera", brand: "Phase One", model: "iXM-100",    utama: false, specs: { res: 100, pixel: 3.76, gsd: 1.0, band: 1, weight: 630, shutter: true } },
  { id: "sony-a7r5",    cat: "camera", brand: "Sony",      model: "a7R V",      utama: false, specs: { res: 61,  pixel: 3.76, gsd: 1.3, band: 1, weight: 723, shutter: true } },
  { id: "dji-p1",       cat: "camera", brand: "DJI",       model: "Zenmuse P1", utama: false, specs: { res: 45,  pixel: 4.4,  gsd: 1.5, band: 1, weight: 800, shutter: true } },
  { id: "micasense",    cat: "camera", brand: "Micasense", model: "RedEdge-P",  utama: false, specs: { res: 1.6, pixel: 3.45, gsd: 2.0, band: 6, weight: 230, shutter: false } },
];

const COMPAT = [
  { drone: "chc-x500", payload: "chc-aa6",  status: "ok",      note: "Mounting native skyport CHC. Plug-and-play." },
  { drone: "chc-x500", payload: "chc-aa10", status: "ok",      note: "Didukung penuh, dalam batas payload 1500 g." },
  { drone: "chc-x500", payload: "dji-l2",   status: "no",      note: "Antarmuka gimbal DSDK tidak kompatibel dgn skyport CHC." },
  { drone: "chc-x500", payload: "dji-p1",   status: "no",      note: "Mount DJI E-Port tidak tersedia pada X500." },
  { drone: "dji-m400", payload: "dji-l2",   status: "ok",      note: "Mounting DJI E-Port. Native." },
  { drone: "dji-m400", payload: "dji-p1",   status: "ok",      note: "Mounting DJI E-Port. Native." },
  { drone: "dji-m400", payload: "chc-aa6",  status: "adapter", note: "Perlu bracket adapter pihak ketiga; sumber daya terpisah." },
  { drone: "dji-m350", payload: "dji-l2",   status: "ok",      note: "Mounting DJI Skyport native." },
  { drone: "dji-m350", payload: "dji-p1",   status: "ok",      note: "Mounting DJI Skyport native." },
  { drone: "dji-m350", payload: "chc-aa6",  status: "adapter", note: "Perlu bracket adapter; cek batas payload 1300 g." },
  { drone: "dji-m300", payload: "dji-l2",   status: "ok",      note: "Mounting DJI Skyport native." },
  { drone: "dji-m300", payload: "dji-p1",   status: "ok",      note: "Mounting DJI Skyport native." },
];

async function run() {
  console.log("Migrating Categories...");
  const catEntries = Object.keys(SEED_CATS).map(key => ({
    id: key,
    label: SEED_CATS[key].label,
    attrs: SEED_CATS[key].attrs
  }));
  for (const c of catEntries) {
    const { error } = await supabase.from("categories").upsert(c);
    if (error) console.error("Cat error:", error);
  }

  console.log("Migrating Products...");
  for (const p of SEED_PRODUCTS) {
    const { error } = await supabase.from("products").upsert(p);
    if (error) console.error("Prod error:", error);
  }

  console.log("Migrating Compatibilities...");
  for (const c of COMPAT) {
    const { error } = await supabase.from("compatibilities").upsert({
      drone: c.drone,
      payload: c.payload,
      status: c.status,
      note: c.note
    });
    if (error) console.error("Compat error:", error);
  }

  console.log("Done migrating data to Supabase!");
}

run();
