import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowRightLeft, Link2, Check, X, AlertTriangle, Star, Gauge, ChevronDown, Plus,
  Trophy, Settings, Trash2, Lightbulb, ThumbsUp, Upload, Edit3, Edit2, LogOut, FileText, ExternalLink
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import LOGO from "./assets/logo.png";
const SERIES = ["#6366F1", "#38BDF8", "#34D399", "#F472B6", "#FBBF24"];

/* ============================================================================
   SURVEYCOMPARE — Jaya Survey Indonesia
   Banding ≤5 produk · skor + radar · kategori & produk dapat ditambah manual
   · rekomendasi bahasa awam. DATA CONTOH — ganti dgn datasheet asli.
   Peta Supabase: categories→cats · attributes→cat.attrs · products→prods
   ========================================================================== */

const fmt = (n) => (typeof n === "number" ? n.toLocaleString("id-ID") : n);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 36);
const nameOf = (p) => `${p.brand} ${p.model.split("(")[0].trim()}`;

function computeScores(prods, attrs) {
  const num = attrs.filter((a) => a.type === "num");
  const range = {};
  num.forEach((a) => {
    const vals = prods.map((p) => p.specs[a.key]).filter((v) => typeof v === "number");
    range[a.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  });
  return prods.map((p) => {
    let sum = 0, cnt = 0; const dims = {};
    num.forEach((a) => {
      const { min, max } = range[a.key]; const v = p.specs[a.key];
      let s = (typeof v !== "number") ? 0 : max === min ? 100
        : a.better === "high" ? ((v - min) / (max - min)) * 100 : ((max - v) / (max - min)) * 100;
      dims[a.key] = Math.round(s); sum += s; cnt++;
    });
    return { ...p, score: Math.round(sum / (cnt || 1)), dims };
  });
}

/* --------------------------- REKOMENDASI AWAM ---------------------------- */
function Recommendation({ scored, ranked, attrs }) {
  const num = attrs.filter((a) => a.type === "num");
  const top = ranked[0], second = ranked[1];
  const strengths = num.filter((a) => top.dims[a.key] === 100).map((a) => a.label).slice(0, 4);
  const trades = [];
  num.forEach((a) => {
    const vals = scored.map((p) => p.specs[a.key]);
    if (new Set(vals).size === 1) return;
    const bv = a.better === "low" ? Math.min(...vals) : Math.max(...vals);
    const w = scored.filter((p) => p.specs[a.key] === bv);
    if (w.length === 1 && w[0].id !== top.id) trades.push({ label: a.label.toLowerCase(), who: nameOf(w[0]) });
  });
  const gap = top.score - (second ? second.score : 0);
  const chc = scored.find((p) => p.utama);
  const chcRank = chc ? ranked.findIndex((p) => p.id === chc.id) + 1 : 0;

  return (
    <div className="reco">
      <div className="reco-h"><ThumbsUp size={15} /> Rekomendasi & ringkasan</div>
      <div className="reco-body">
        <div className="reco-pick" style={{ alignItems: "center" }}>
          <span className="reco-medal" style={{ borderRadius: 8 }}><Trophy size={20} /></span>
          {top.image && <img src={top.image} alt={top.model} style={{ width: 140, height: 90, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", padding: 4, background: "white" }} />}
          <div style={{ flex: 1 }}>
            <div className="reco-pick-name" style={{ fontSize: 20 }}>{nameOf(top)}</div>
            <div className="reco-pick-sub" style={{ fontSize: 13, marginTop: 4 }}>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>Skor tertinggi: {top.score}/100</span>
              {top.utama && <span style={{ color: "var(--red)", marginLeft: 8 }}>★ Brand Utama Jaya</span>}
            </div>
          </div>
        </div>

        <p className="reco-explain">
          <Lightbulb size={13} /> <b>Arti skor:</b> angka 0–100 menunjukkan seberapa unggul sebuah produk
          dibanding yang lain <i>dalam perbandingan ini</i>. Nilai 100 berarti terbaik di kelompok ini untuk
          aspek tersebut — bukan nilai mutlak. Makin tinggi skornya, makin lengkap keunggulannya.
        </p>

        {strengths.length > 0 && (
          <div className="reco-line">
            <b>Kenapa unggul:</b> {nameOf(top)} memimpin pada {strengths.join(", ")}.
          </div>
        )}

        {gap <= 6 && second && (
          <div className="reco-line warn">
            Persaingan ketat — selisih dengan {nameOf(second)} hanya {gap} poin. Lihat kebutuhan spesifik Anda sebelum memutuskan.
          </div>
        )}

        {trades.slice(0, 2).length > 0 && (
          <div className="reco-line">
            <b>Pertimbangan lain:</b>{" "}
            {trades.slice(0, 2).map((t, i) => (
              <span key={i}>{i > 0 ? "; " : ""}kalau {t.label} paling penting bagi Anda, <b>{t.who}</b> lebih unggul</span>
            ))}.
          </div>
        )}

        {chc && chcRank > 1 && (
          <div className="reco-line note">
            <Star size={12} /> Catatan ketersediaan: {nameOf(chc)} (brand utama Jaya, dukungan & stok paling siap) berada di peringkat {chcRank}.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ BANDINGKAN ------------------------------- */
function CompareMode({ theme, cats, prods }) {
  const catKeys = Object.keys(cats);
  
  if (catKeys.length === 0) {
    return (
      <div className="empty" style={{ padding: 40, textAlign: "center", color: "var(--mut)" }}>
        Belum ada data kategori alat ukur. <br/>
        Silakan minta Admin untuk menambahkan kategori terlebih dahulu melalui tab Kelola.
      </div>
    );
  }

  const [initCat, initIds] = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    let c = params.get("cat");
    let idsStr = params.get("ids");
    if (!c || !catKeys.includes(c)) c = catKeys[0];
    const availableProds = prods.filter((p) => p.cat === c);
    let i = idsStr ? idsStr.split(",") : [];
    i = i.filter(id => availableProds.some(p => p.id === id));
    if (i.length < 2) i = availableProds.slice(0, 3).map(p => p.id);
    return [c, i];
  }, [catKeys, prods]);

  const [cat, setCat] = useState(initCat);
  const [ids, setIds] = useState(initIds);
  const list = prods.filter((p) => p.cat === cat);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("cat", cat);
    params.set("ids", ids.join(","));
    window.history.replaceState(null, "", "?" + params.toString());
  }, [cat, ids]);

  const onCat = (c) => { setCat(c); setIds(prods.filter((p) => p.cat === c).slice(0, 3).map((p) => p.id)); };
  const remove = (id) => ids.length > 2 && setIds(ids.filter((x) => x !== id));
  const add = (id) => id && ids.length < 5 && !ids.includes(id) && setIds([...ids, id]);

  const attrs = cats[cat].attrs;
  const selected = ids.map((id) => prods.find((p) => p.id === id)).filter(Boolean);
  const series = theme === "dark"
    ? ["#6366F1", "#38BDF8", "#34D399", "#F472B6", "#FBBF24"]
    : ["#4F46E5", "#0284C7", "#059669", "#DB2777", "#D97706"];
  const colorOf = (id) => series[ids.indexOf(id) % series.length];
  const available = list.filter((p) => !ids.includes(p.id));

  const enough = selected.length >= 2;
  const scored = useMemo(() => (enough ? computeScores(selected, attrs) : []), [ids, cat, prods]);
  const ranked = [...scored].sort((a, b) => b.score - a.score);

  const radarData = attrs.filter((a) => a.type === "num").map((a) => {
    const o = { axis: a.short }; scored.forEach((p) => (o[p.id] = p.dims[a.key])); return o;
  });

  const captureRef = useRef(null);

  const downloadPNG = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { scale: 2 });
    const link = document.createElement("a");
    link.download = `bandingan-${cat}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = async () => {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`bandingan-${cat}.pdf`);
  };

  const isPrintMode = new URLSearchParams(window.location.search).get("print") === "true";

  const copyLink = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("print", "true");
    const shareUrl = window.location.origin + window.location.pathname + "?" + params.toString();
    navigator.clipboard.writeText(shareUrl);
    alert("Tautan statis hasil perbandingan berhasil disalin!");
  };

  return (
    <div>
      {!isPrintMode && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 14 }}>
          <div className="cat-row" style={{ marginBottom: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {catKeys.map((k) => (
              <button key={k} className={`chip ${cat === k ? "chip-on" : ""}`} onClick={() => onCat(k)}>{cats[k].label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-action" onClick={copyLink}>Salin Link</button>
            <button className="btn-action" onClick={downloadPNG}>Unduh PNG</button>
            <button className="btn-action" onClick={downloadPDF}>Unduh PDF</button>
          </div>
        </div>
      )}

      <div ref={captureRef} style={{ background: "var(--paper)", padding: isPrintMode ? "20px" : "10px" }}>
        <label className="lbl">Produk dibandingkan ({ids.length}/5)</label>
      <div className="slot-row">
        {selected.map((p) => (
          <span className="slot" key={p.id} style={{ borderColor: colorOf(p.id), display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textAlign: "center" }}>
            <i className="dot" style={{ background: colorOf(p.id) }} />
            {p.image && <img src={p.image} alt={p.model} style={{ height: 40, width: "auto", objectFit: "contain", borderRadius: 4 }} />}
            <div>
              <b>{p.brand}</b> {p.model.split("(")[0].trim()}
              {p.utama && <Star size={11} strokeWidth={2.5} className="slot-star" />}
            </div>
            {ids.length > 2 && <button className="slot-x" onClick={() => remove(p.id)}><X size={13} /></button>}
          </span>
        ))}
        {ids.length < 5 && available.length > 0 && (
          <div className="picker add">
            <Plus size={14} className="add-ic" />
            <select value="" onChange={(e) => add(e.target.value)}>
              <option value="">Tambah produk</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}{p.utama ? "  ★" : ""}</option>)}
            </select>
            <ChevronDown size={16} className="picker-ic" />
          </div>
        )}
      </div>

      {!enough ? (
        <div className="empty">Kategori ini perlu minimal 2 produk untuk dibandingkan. Tambahkan produk di tab <b>Kelola</b>.</div>
      ) : (
        <>
          <div className="panel">
            <div className="panel-h"><Trophy size={14} /> Skor keseluruhan</div>
            {ranked.map((p, i) => (
              <div className={`scrow ${i === 0 ? "lead" : ""}`} key={p.id}>
                <span className="rank">{i + 1}</span>
                <span className="sc-label">{p.brand} {p.model.split("(")[0].trim()}{p.utama && <Star size={10} strokeWidth={3} className="ut" />}</span>
                <span className="sc-track"><i style={{ width: `${p.score}%`, background: colorOf(p.id) }} /></span>
                <span className="sc-num" style={{ color: colorOf(p.id) }}>{p.score}</span>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-h"><Gauge size={14} /> Profil performa (radar)</div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--ink)", fontWeight: 600 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {scored.map((p) => (
                    <Radar key={p.id} name={nameOf(p)} dataKey={p.id}
                      stroke={colorOf(p.id)} fill={colorOf(p.id)} fillOpacity={0.12} strokeWidth={2} />
                  ))}
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="hint">Tiap sumbu dinormalisasi 0–100 relatif terhadap produk yang dibandingkan. Makin luas, makin unggul menyeluruh.</div>
          </div>

          <div className="panel">
            <div className="panel-h"><ArrowRightLeft size={14} /> Spesifikasi detail</div>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr><th className="th-attr">Atribut</th>
                    {selected.map((p) => (
                      <th key={p.id}><i className="dot" style={{ background: colorOf(p.id) }} />{p.brand}<br/><span className="th-mod">{p.model.split("(")[0].trim()}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attrs.map((at) => {
                    let bestVal = null, vary = false;
                    if (at.type === "num") {
                      const vals = scored.map((p) => p.specs[at.key]);
                      bestVal = at.better === "low" ? Math.min(...vals) : Math.max(...vals);
                      vary = new Set(vals).size > 1;
                    }
                    return (
                      <tr key={at.key}>
                        <td className="td-attr">{at.label}{at.unit ? ` (${at.unit})` : ""}</td>
                        {scored.map((p) => {
                          const v = p.specs[at.key];
                          const isBest = at.type === "num" ? (vary && v === bestVal) : at.type === "bool" ? v === true : false;
                          const show = at.type === "bool" ? (v ? "Ya" : "Tidak") : (v == null || v === "" ? "—" : fmt(v));
                          return <td key={p.id} className={`td-val ${isBest ? "best" : ""}`}>{show}</td>;
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="td-attr">Catatan Tambahan<br/><span style={{fontSize: 10, color: "var(--mut)"}}>(Aftersales, Warranty, dll)</span></td>
                    {scored.map((p) => (
                      <td key={`note-${p.id}`} className="td-val" style={{ whiteSpace: "pre-wrap", fontSize: 11, textAlign: "left", verticalAlign: "top" }}>
                        {p.note || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="td-attr"><FileText size={12} style={{marginRight: 4, verticalAlign: "middle"}} />Datasheet PDF</td>
                    {scored.map((p) => (
                      <td key={`ds-${p.id}`} className="td-val">
                        {p.datasheet_url ? (
                          <a
                            href={p.datasheet_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "5px 12px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#4f46e5",
                              background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
                              textDecoration: "none",
                              transition: "all 0.2s ease",
                              border: "1px solid #c7d2fe",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, #e0e7ff, #c7d2fe)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(79,70,229,0.15)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #eef2ff, #e0e7ff)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                          >
                            <FileText size={12} /> Lihat Datasheet <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span style={{ color: "var(--mut)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Recommendation scored={scored} ranked={ranked} attrs={attrs} />
        </>
      )}
      </div>
    </div>
  );
}

/* ----------------------------- KOMPATIBILITAS ---------------------------- */
function CompatMode({ prods, compat }) {
  const drones = prods.filter((p) => p.cat === "drone");
  const payloads = prods.filter((p) => p.cat === "lidar" || p.cat === "camera");
  const [d, setD] = useState(drones[0]?.id || "");
  const [l, setL] = useState(payloads[0]?.id || "");
  const result = useMemo(() => compat.find((c) => c.drone === d && c.payload === l), [d, l, compat]);
  const drone = prods.find((p) => p.id === d);
  const payload = prods.find((p) => p.id === l);
  const meta = {
    ok:      { ic: <Check size={20} />,         txt: "Kompatibel",      cls: "ok" },
    adapter: { ic: <AlertTriangle size={20} />, txt: "Perlu adapter",   cls: "adapter" },
    no:      { ic: <X size={20} />,             txt: "Tidak kompatibel",cls: "no" },
  };
  return (
    <div>
      <div className="vs-head">
        <div className="vs-col"><label className="lbl">Drone</label>
          <div className="picker"><select value={d} onChange={(e) => setD(e.target.value)}>
            {drones.map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}{p.utama ? "  ★" : ""}</option>)}
          </select><ChevronDown size={16} className="picker-ic" /></div></div>
        <div className="vs-x"><Link2 size={18} /></div>
        <div className="vs-col"><label className="lbl">Payload (LiDAR / Kamera)</label>
          <div className="picker"><select value={l} onChange={(e) => setL(e.target.value)}>
            {payloads.map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}{p.utama ? "  ★" : ""}</option>)}
          </select><ChevronDown size={16} className="picker-ic" /></div></div>
      </div>
      {drone && payload && result ? (
        <div className={`result ${meta[result.status].cls}`}>
          <div className="result-badge">{meta[result.status].ic}<span>{meta[result.status].txt}</span></div>
          <div className="result-pair">{drone.brand} {drone.model} <span className="amp">+</span> {payload.brand} {payload.model}</div>
          <p className="result-note">{result.note}</p>
        </div>
      ) : <div className="empty">Pasangan ini belum diinput ke matriks kompatibilitas.</div>}
    </div>
  );
}

function CompatForm({ prods, onAdd }) {
  const drones = prods.filter((p) => p.cat === "drone");
  const payloads = prods.filter((p) => p.cat === "lidar" || p.cat === "camera");
  const [d, setD] = useState("");
  const [l, setL] = useState("");
  const [status, setStatus] = useState("ok");
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!d || !l) return;
    onAdd({ drone: d, payload: l, status, note });
    setD(""); setL(""); setStatus("ok"); setNote("");
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20, padding: 16, background: "var(--card)", border: "1px solid var(--line)" }}>
      <h4 style={{ marginBottom: 12, fontSize: 13 }}>Tambah Entri Baru</h4>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Drone</label>
          <select className="inp" style={{ width: "100%" }} value={d} onChange={(e) => setD(e.target.value)} required>
            <option value="">-- Pilih Drone --</option>
            {drones.map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Payload</label>
          <select className="inp" style={{ width: "100%" }} value={l} onChange={(e) => setL(e.target.value)} required>
            <option value="">-- Pilih Payload --</option>
            {payloads.map((p) => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Status</label>
          <select className="inp" style={{ width: "100%" }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ok">Kompatibel</option>
            <option value="adapter">Perlu Adapter</option>
            <option value="no">Tidak Kompatibel</option>
          </select>
        </div>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label className="lbl">Catatan</label>
          <input type="text" className="inp" style={{ width: "100%" }} placeholder="Contoh: Perlu PSDK adapter" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="submit" className="btn" style={{ padding: "9px 16px" }}><Plus size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> Tambah</button>
        </div>
      </div>
    </form>
  );
}

/* -------------------------------- KELOLA --------------------------------- */
function ManageMode({ cats, setCats, prods, setProds, compat, setCompat }) {
  const [catLabel, setCatLabel] = useState("");
  const [rows, setRows] = useState([{ label: "", unit: "", type: "num", better: "high" }]);
  const [catMsg, setCatMsg] = useState("");

  // Users state
  const [appUsers, setAppUsers] = useState([]);
  const [uName, setUMame] = useState("");
  const [uPwd, setUPwd] = useState("");
  const [uRole, setURole] = useState("user");
  const [uMsg, setUMsg] = useState("");

  const [editUserId, setEditUserId] = useState(null);
  const [editUserPwd, setEditUserPwd] = useState("");

  const [editProdId, setEditProdId] = useState(null);

  const [editCompatId, setEditCompatId] = useState(null);
  const [editCompatStatus, setEditCompatStatus] = useState("ok");
  const [editCompatNote, setEditCompatNote] = useState("");

  // Sub-tab selection state
  const [subTab, setSubTab] = useState("users");

  // Filter & Sort states for products list
  const [filterCat, setFilterCat] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [sortKey, setSortKey] = useState("brand");
  const [sortAsc, setSortAsc] = useState(true);

  // Filter & Sort states for compatibility list
  const [compatFilterDroneBrand, setCompatFilterDroneBrand] = useState("");
  const [compatFilterPayloadBrand, setCompatFilterPayloadBrand] = useState("");
  const [compatSortKey, setCompatSortKey] = useState("drone");
  const [compatSortAsc, setCompatSortAsc] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase.from("app_users").select("*");
      if (data) setAppUsers(data);
    }
    loadUsers();
  }, []);

  const saveUser = async () => {
    if (!uName.trim() || !uPwd.trim()) { setUMsg("Username dan password wajib diisi"); return; }
    try {
      const { data, error } = await supabase.from("app_users").insert({ username: uName.trim(), password: uPwd.trim(), role: uRole }).select();
      if (error) throw error;
      if (data) setAppUsers([...appUsers, ...data]);
      setUMame(""); setUPwd(""); setURole("user");
      setUMsg("User berhasil ditambahkan!");
    } catch (err) {
      setUMsg("Gagal menambah user: " + err.message);
    }
  };

  const delUser = async (id) => {
    await supabase.from("app_users").delete().eq("id", id);
    setAppUsers(appUsers.filter(u => u.id !== id));
  };

  const delProd = async (id) => {
    await supabase.from("products").delete().eq("id", id);
    setProds(prods.filter(p => p.id !== id));
  };


  const addRow = () => setRows([...rows, { label: "", unit: "", type: "num", better: "high" }]);
  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const delRow = (i) => rows.length > 1 && setRows(rows.filter((_, j) => j !== i));

  const saveCat = async () => {
    const valid = rows.filter((r) => r.label.trim());
    if (!catLabel.trim() || valid.length === 0) { setCatMsg("Isi nama kategori dan minimal satu atribut."); return; }
    const id = slug(catLabel) || `cat-${Date.now()}`;
    if (cats[id]) { setCatMsg("Kategori dengan nama itu sudah ada."); return; }
    const attrs = valid.map((r) => ({
      key: slug(r.label) || `a-${Math.random().toString(36).slice(2, 6)}`,
      label: r.label.trim(), short: r.label.trim().slice(0, 11),
      unit: r.unit.trim(), type: r.type, better: r.type === "num" ? r.better : undefined,
    }));
    try {
      await supabase.from("categories").upsert({ id, label: catLabel.trim(), attrs });
      setCats({ ...cats, [id]: { label: catLabel.trim(), attrs } });
      setCatLabel(""); setRows([{ label: "", unit: "", type: "num", better: "high" }]);
      setCatMsg(`Kategori "${catLabel.trim()}" ditambahkan.`);
    } catch (err) {
      setCatMsg("Gagal menyimpan ke database.");
    }
  };

  // Produk
  const catKeys = Object.keys(cats);
  const [pCat, setPCat] = useState(catKeys[0]);
  const [brand, setBrand] = useState(""); const [model, setModel] = useState("");
  const [image, setImage] = useState("");
  const [note, setNote] = useState("");
  const [utama, setUtama] = useState(false);
  const [specs, setSpecs] = useState({});
  const [datasheetUrl, setDatasheetUrl] = useState("");
  const datasheetFileRef = useRef(null);
  const [pMsg, setPMsg] = useState("");
  const pAttrs = cats[pCat]?.attrs || [];
  const setSpec = (k, v) => setSpecs({ ...specs, [k]: v });

  // Collect unique brands for dropdown lists
  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    prods.forEach((p) => {
      if (p.brand) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [prods]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleCompatSort = (key) => {
    if (compatSortKey === key) {
      setCompatSortAsc(!compatSortAsc);
    } else {
      setCompatSortKey(key);
      setCompatSortAsc(true);
    }
  };

  const filteredAndSortedProds = useMemo(() => {
    let res = [...prods];
    if (filterCat) {
      res = res.filter((p) => p.cat === filterCat);
    }
    if (filterBrand) {
      res = res.filter((p) => p.brand?.trim() === filterBrand);
    }
    res.sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortKey === "brand") {
        valA = a.brand || "";
        valB = b.brand || "";
      } else if (sortKey === "model") {
        valA = a.model || "";
        valB = b.model || "";
      } else if (sortKey === "cat") {
        valA = cats[a.cat]?.label || "";
        valB = cats[b.cat]?.label || "";
      }
      const cmp = valA.localeCompare(valB, "id", { sensitivity: "base" });
      return sortAsc ? cmp : -cmp;
    });
    return res;
  }, [prods, filterCat, filterBrand, sortKey, sortAsc, cats]);

  const filteredAndSortedCompat = useMemo(() => {
    let res = [...compat];
    res = res.filter((c) => {
      const dr = prods.find((p) => p.id === c.drone);
      const pl = prods.find((p) => p.id === c.payload);
      if (compatFilterDroneBrand && dr?.brand?.trim() !== compatFilterDroneBrand) {
        return false;
      }
      if (compatFilterPayloadBrand && pl?.brand?.trim() !== compatFilterPayloadBrand) {
        return false;
      }
      return true;
    });

    res.sort((a, b) => {
      let valA = "";
      let valB = "";
      const drA = prods.find((p) => p.id === a.drone);
      const drB = prods.find((p) => p.id === b.drone);
      const plA = prods.find((p) => p.id === a.payload);
      const plB = prods.find((p) => p.id === b.payload);

      if (compatSortKey === "drone") {
        valA = drA ? `${drA.brand} ${drA.model}` : a.drone || "";
        valB = drB ? `${drB.brand} ${drB.model}` : b.drone || "";
      } else if (compatSortKey === "payload") {
        valA = plA ? `${plA.brand} ${plA.model}` : a.payload || "";
        valB = plB ? `${plB.brand} ${plB.model}` : b.payload || "";
      } else if (compatSortKey === "status") {
        valA = a.status || "";
        valB = b.status || "";
      }

      const cmp = valA.localeCompare(valB, "id", { sensitivity: "base" });
      return compatSortAsc ? cmp : -cmp;
    });
    return res;
  }, [compat, prods, compatFilterDroneBrand, compatFilterPayloadBrand, compatSortKey, compatSortAsc]);

  const saveProd = async () => {
    if (!brand.trim() || !model.trim()) { setPMsg("Isi brand dan model."); return; }
    const built = {};
    pAttrs.forEach((a) => {
      const raw = specs[a.key];
      built[a.key] = a.type === "num" ? (raw === "" || raw == null ? null : Number(raw))
        : a.type === "bool" ? !!raw : (raw || "");
    });
    const id = editProdId || `${slug(brand)}-${slug(model)}-${Math.random().toString(36).slice(2, 5)}`;
    const newProd = { id, cat: pCat, brand: brand.trim(), model: model.trim(), utama, image: image.trim(), note: note.trim(), specs: built, datasheet_url: datasheetUrl || null };
    try {
      await supabase.from("products").upsert(newProd);
      if (editProdId) {
        setProds(prods.map(p => p.id === editProdId ? newProd : p));
        setPMsg(`Produk "${brand.trim()} ${model.trim()}" berhasil diupdate.`);
        setEditProdId(null);
      } else {
        setProds([...prods, newProd]);
        setPMsg(`Produk "${brand.trim()} ${model.trim()}" ditambahkan.`);
      }
      setBrand(""); setModel(""); setImage(""); setNote(""); setUtama(false); setSpecs({}); setDatasheetUrl(""); datasheetFileRef.current = null;
    } catch (err) {
      setPMsg("Gagal menyimpan produk ke database.");
    }
  };

  const [importJson, setImportJson] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [pdfPreview, setPdfPreview] = useState(null); // { thumb, name, pages }

  const handleImport = () => {
    try {
      const data = JSON.parse(importJson);
      if (!Array.isArray(data)) throw new Error("Format JSON harus berupa Array []");
      
      let added = 0;
      const newProds = [];
      data.forEach(p => {
        if (p.brand && p.model && p.cat && p.specs) {
          const id = `${slug(p.brand)}-${slug(p.model)}-${Math.random().toString(36).slice(2, 5)}`;
          newProds.push({ ...p, id });
          added++;
        }
      });
      setProds([...prods, ...newProds]);
      setImportMsg(`Berhasil mengimpor ${added} produk.`);
      setImportJson("");
    } catch (e) {
      setImportMsg("Gagal: " + e.message);
    }
  };

  return (
    <div>
      <div className="note-bar"><AlertTriangle size={13} /> Panel Administrasi: Anda masuk sebagai Admin. Semua perubahan yang dilakukan di sini akan tersimpan ke database.</div>

      {/* Sub tabs navigation */}
      <div className="tabs sub-tabs" style={{ display: "flex", marginBottom: 20, width: "fit-content", flexWrap: "wrap" }}>
        <button className={subTab === "users" ? "on" : ""} onClick={() => setSubTab("users")}><Settings size={14} /> Pengguna</button>
        <button className={subTab === "cats" ? "on" : ""} onClick={() => setSubTab("cats")}><Plus size={14} /> Kategori</button>
        <button className={subTab === "prods" ? "on" : ""} onClick={() => setSubTab("prods")}><Plus size={14} /> Tambah Produk</button>
        <button className={subTab === "list" ? "on" : ""} onClick={() => setSubTab("list")}><Settings size={14} /> Daftar Produk</button>
        <button className={subTab === "compat" ? "on" : ""} onClick={() => setSubTab("compat")}><Link2 size={14} /> Kompatibilitas</button>
      </div>

      {/* Kelola Pengguna */}
      {subTab === "users" && (
        <div className="panel">
          <div className="panel-h"><Settings size={14} /> Kelola Pengguna (Akses Login)</div>
          <div className="form">
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table className="cmp-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--card)", textAlign: "left", borderBottom: "2px solid var(--line)" }}>
                    <th style={{ padding: "6px 8px" }}>Username</th>
                    <th style={{ padding: "6px 8px" }}>Password (Hint)</th>
                    <th style={{ padding: "6px 8px" }}>Role</th>
                    <th style={{ padding: "6px 8px", width: 60 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {appUsers.filter(u => u.username !== "jayasurveying0" && u.username !== "jayasurveying0@gmail.com").map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{u.username}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--mut)" }}>
                        {editUserId === u.id ? (
                          <input className="inp" style={{padding: "4px 8px", fontSize: 11}} value={editUserPwd} onChange={e => setEditUserPwd(e.target.value)} placeholder="Password Baru" />
                        ) : (
                          u.password
                        )}
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <span className="chip" style={{ padding: "3px 6px", fontSize: 10 }}>{u.role.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        {editUserId === u.id ? (
                          <button className="icon-btn" style={{color: "var(--ink)", display: "inline-block", marginRight: 4}} title="Simpan" onClick={async () => {
                            if (!editUserPwd.trim()) return;
                            await supabase.from("app_users").update({ password: editUserPwd.trim() }).eq("id", u.id);
                            setAppUsers(appUsers.map(x => x.id === u.id ? { ...x, password: editUserPwd.trim() } : x));
                            setEditUserId(null); setEditUserPwd("");
                          }}><Check size={13} /></button>
                        ) : (
                          <button className="icon-btn" style={{display: "inline-block", marginRight: 4}} title="Edit Password" onClick={() => { setEditUserId(u.id); setEditUserPwd(""); }}><Edit2 size={13} /></button>
                        )}
                        <button className="icon-btn" style={{display: "inline-block"}} title="Hapus" onClick={() => delUser(u.id)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  {appUsers.filter(u => u.username !== "jayasurveying0" && u.username !== "jayasurveying0@gmail.com").length === 0 && <tr><td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "var(--mut)" }}>Belum ada pengguna terdaftar.</td></tr>}
                </tbody>
              </table>
            </div>

            <label className="lbl">Tambah Pengguna Baru</label>
            <div className="grid2">
              <input className="inp" value={uName} onChange={e => setUMame(e.target.value)} placeholder="Username" />
              <input className="inp" type="password" value={uPwd} onChange={e => setUPwd(e.target.value)} placeholder="Password" />
            </div>
            <div className="grid2 mt" style={{ alignItems: "center" }}>
              <select className="inp" value={uRole} onChange={e => setURole(e.target.value)}>
                <option value="user">USER (Hanya Lihat & Bandingkan)</option>
                <option value="admin">ADMIN (Kelola Data & Pengguna)</option>
              </select>
              <div className="form-foot" style={{ marginTop: 0 }}>
                <button className="btn" onClick={saveUser}>Tambah User</button>
                {uMsg && <span className="msg">{uMsg}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tambah kategori */}
      {subTab === "cats" && (
        <>
          <div className="panel">
            <div className="panel-h"><Plus size={14} /> Tambah kategori</div>
            <div className="form">
              <label className="lbl">Nama kategori</label>
              <input className="inp" value={catLabel} onChange={(e) => setCatLabel(e.target.value)} placeholder="mis. Echo Sounder, Theodolite, GPR…" />
              <label className="lbl mt">Atribut pembanding</label>
              <div className="attr-head"><span>Nama atribut</span><span>Satuan</span><span>Tipe</span><span>Lebih baik</span><span></span></div>
              {rows.map((r, i) => (
                <div className="attr-row" key={i}>
                  <input className="inp" value={r.label} onChange={(e) => setRow(i, "label", e.target.value)} placeholder="mis. Akurasi" />
                  <input className="inp" value={r.unit} onChange={(e) => setRow(i, "unit", e.target.value)} placeholder="mm" />
                  <select className="inp" value={r.type} onChange={(e) => setRow(i, "type", e.target.value)}>
                    <option value="num">Angka</option><option value="txt">Teks</option><option value="bool">Ya/Tidak</option>
                  </select>
                  <select className="inp" value={r.better} disabled={r.type !== "num"} onChange={(e) => setRow(i, "better", e.target.value)}>
                    <option value="high">Tinggi</option><option value="low">Rendah</option>
                  </select>
                  <button className="icon-btn" onClick={() => delRow(i)}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-ghost" onClick={addRow}><Plus size={13} /> Tambah atribut</button>
              <div className="form-foot">
                <button className="btn" onClick={saveCat}>Simpan kategori</button>
                {catMsg && <span className="msg"><Check size={13} /> {catMsg}</span>}
              </div>
            </div>
          </div>

          {/* Daftar Kategori */}
          <div className="panel">
            <div className="panel-h"><Settings size={14} /> Kategori & jumlah produk</div>
            <div className="cat-list">
              {catKeys.map((k) => (
                <div className="cat-item" key={k}>
                  <span className="cat-name">{cats[k].label}</span>
                  <span className="cat-meta">{cats[k].attrs.length} atribut · {prods.filter((p) => p.cat === k).length} produk</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tambah/Edit produk */}
      {subTab === "prods" && (
        <>
          <div className="panel" id="product-form-panel">
            <div className="panel-h">{editProdId ? <Edit2 size={14} /> : <Plus size={14} />} {editProdId ? "Edit produk" : "Tambah produk"}</div>
            <div className="form">
              <div className="grid2">
                <div><label className="lbl">Kategori</label>
                  <select className="inp" value={pCat} onChange={(e) => { setPCat(e.target.value); setSpecs({}); }}>
                    {catKeys.map((k) => <option key={k} value={k}>{cats[k].label}</option>)}
                  </select>
                </div>
                <div className="chk-wrap"><label className="chk"><input type="checkbox" checked={utama} onChange={(e) => setUtama(e.target.checked)} /> Brand utama (prioritas Jaya)</label></div>
              </div>
              <div className="grid2 mt">
                <div><label className="lbl">Brand</label><input className="inp" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="mis. CHC" /></div>
                <div><label className="lbl">Model</label><input className="inp" value={model} onChange={(e) => setModel(e.target.value)} placeholder="mis. X700" /></div>
              </div>
              <div className="mt">
                <label className="lbl">URL Gambar (Opsional)</label><input className="inp" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." style={{width: "100%"}} />
              </div>
              <div className="mt">
                <label className="lbl">Catatan Tambahan (Aftersales, Warranty, dll)</label>
                <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Informasi nilai tambah produk..." style={{width: "100%", resize: "vertical", minHeight: 60}} />
              </div>
              {datasheetUrl && (
                <div className="mt" style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 8,
                  background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
                  border: "1px solid #bbf7d0",
                  animation: "pdfSlideIn 0.3s ease forwards",
                }}>
                  <FileText size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#15803d" }}>📄 Datasheet PDF terlampir</div>
                    <a href={datasheetUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#4f46e5", wordBreak: "break-all" }}>{datasheetUrl.split("/").pop()}</a>
                  </div>
                  <button onClick={() => { setDatasheetUrl(""); datasheetFileRef.current = null; }} style={{
                    background: "none", border: "none", cursor: "pointer", color: "var(--mut)", padding: 2,
                  }}><X size={14} /></button>
                </div>
              )}
              <label className="lbl mt">Spesifikasi ({cats[pCat]?.label})</label>
              <div className="spec-grid">
                {pAttrs.map((a) => (
                  <div className="spec-f" key={a.key}>
                    <span className="spec-l">{a.label}{a.unit ? ` (${a.unit})` : ""}</span>
                    {a.type === "bool"
                      ? <label className="chk sm"><input type="checkbox" checked={!!specs[a.key]} onChange={(e) => setSpec(a.key, e.target.checked)} /> Ya</label>
                      : <input className="inp" type={a.type === "num" ? "number" : "text"} value={specs[a.key] ?? ""} onChange={(e) => setSpec(a.key, e.target.value)} />}
                  </div>
                ))}
              </div>
              <div className="form-foot">
                <button className="btn" onClick={saveProd}>{editProdId ? "Update produk" : "Simpan produk"}</button>
                {editProdId && <button className="btn-ghost" onClick={() => {
                  setEditProdId(null); setBrand(""); setModel(""); setImage(""); setNote(""); setUtama(false); setSpecs({}); setDatasheetUrl(""); datasheetFileRef.current = null;
                }}>Batal Edit</button>}
                {pMsg && <span className="msg"><Check size={13} /> {pMsg}</span>}
              </div>
            </div>
          </div>

          {/* Upload Produk / File */}
          <div className="panel">
            <div className="panel-h"><Upload size={14} /> Upload Produk / File (PDF/CSV/PNG etc)</div>
            <div className="form">
              <label className="lbl">Pilih file produk / datasheet</label>
              <input type="file" accept=".json,.csv,.xlsx,.xls,.pdf" className="inp" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                const ext = file.name.split(".").pop().toLowerCase();

                if (ext === "json") {
                  reader.onload = async (ev) => {
                    try {
                      const data = JSON.parse(ev.target.result);
                      if (!Array.isArray(data)) throw new Error("Format JSON harus berupa Array []");
                      let added = 0;
                      const newProds = [];
                      data.forEach(p => {
                        if (p.brand && p.model && p.cat && p.specs) {
                          const id = `${slug(p.brand)}-${slug(p.model)}-${Math.random().toString(36).slice(2, 5)}`;
                          newProds.push({ ...p, id });
                          added++;
                        }
                      });
                      await supabase.from("products").insert(newProds);
                      setProds([...prods, ...newProds]);
                      setImportMsg(`Berhasil mengimpor ${added} produk dari ${file.name}.`);
                    } catch (err) {
                      setImportMsg("Gagal: " + err.message);
                    }
                  };
                  reader.readAsText(file);
                } else if (ext === "csv" || ext === "xlsx" || ext === "xls") {
                  reader.onload = async (ev) => {
                    try {
                      const wb = XLSX.read(ev.target.result, { type: "array" });
                      const ws = wb.Sheets[wb.SheetNames[0]];
                      const rows = XLSX.utils.sheet_to_json(ws);
                      let added = 0;
                      const newProds = [];
                      rows.forEach(row => {
                        if (row.brand && row.model && row.cat) {
                          const specKeys = Object.keys(row).filter(k => !["brand","model","cat","utama"].includes(k));
                          const specs = {};
                          specKeys.forEach(k => {
                            const v = row[k];
                            specs[k] = typeof v === "string" && v.toLowerCase() === "ya" ? true
                                   : typeof v === "string" && v.toLowerCase() === "tidak" ? false
                                   : isNaN(Number(v)) ? v : Number(v);
                          });
                          const id = `${slug(row.brand)}-${slug(row.model)}-${Math.random().toString(36).slice(2, 5)}`;
                          newProds.push({ id, cat: row.cat, brand: row.brand, model: row.model, utama: !!row.utama, specs });
                          added++;
                        }
                      });
                      await supabase.from("products").insert(newProds);
                      setProds([...prods, ...newProds]);
                      setImportMsg(`Berhasil mengimpor ${added} produk dari ${file.name}.`);
                    } catch (err) {
                      setImportMsg("Gagal memproses file: " + err.message);
                    }
                  };
                  reader.readAsArrayBuffer(file);
                } else if (ext === "pdf") {
                  reader.onload = async (ev) => {
                    try {
                      setImportMsg("Sedang mengidentifikasi dokumen PDF...");
                      setPdfPreview(null);
                      const pdfjsLib = window['pdfjs-dist/build/pdf'];
                      if (!pdfjsLib) {
                        throw new Error("Library PDF.js tidak terdeteksi. Silakan segarkan halaman.");
                      }
                      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                      
                      const loadingTask = pdfjsLib.getDocument({ data: ev.target.result });
                      const pdf = await loadingTask.promise;
                      let fullText = "";
                      
                      // Render first page as thumbnail
                      try {
                        const thumbPage = await pdf.getPage(1);
                        const scale = 1.2;
                        const viewport = thumbPage.getViewport({ scale });
                        const canvas = document.createElement("canvas");
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext("2d");
                        await thumbPage.render({ canvasContext: ctx, viewport }).promise;
                        setPdfPreview({ thumb: canvas.toDataURL("image/png"), name: file.name, pages: pdf.numPages });
                      } catch (_) { /* thumbnail optional */ }
                      for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += pageText + "\n";
                      }
                      
                      if (!fullText.trim()) {
                        throw new Error("Teks tidak dapat diekstrak dari PDF. Pastikan dokumen bukan berupa scan gambar murni.");
                      }
                      
                      let detectedCat = "";
                      const textLower = fullText.toLowerCase();
                      
                      if (textLower.includes("drone") || textLower.includes("uav") || textLower.includes("multirotor") || textLower.includes("copter")) {
                        detectedCat = "drone";
                      } else if (textLower.includes("total station") || textLower.includes("theodolite") || textLower.includes("reflectorless")) {
                        detectedCat = "total_station";
                      } else if (textLower.includes("auto level") || textLower.includes("autolevel") || textLower.includes("waterpass")) {
                        detectedCat = "autolevel";
                      } else if (textLower.includes("lidar") || textLower.includes("laser scanner") || textLower.includes("point cloud") || textLower.includes("zenmuse l") || textLower.includes("point rate") || textLower.includes("scanning") || textLower.includes("repetitive scan") || textLower.includes("returns")) {
                        detectedCat = "lidar";
                      } else if (textLower.includes("gnss") || textLower.includes("imu-rtk") || textLower.includes("rtk receiver") || textLower.includes("constellation")) {
                        detectedCat = "gnss";
                      } else if (textLower.includes("camera") || textLower.includes("kamera") || textLower.includes("sensor size") || textLower.includes("megapixel")) {
                        detectedCat = "camera";
                      }
                      
                      let detectedBrand = "";
                      const brands = ["DJI", "CHC", "Leica", "Trimble", "Topcon", "Sokkia", "South", "Nikon", "Phase One", "Sony", "Micasense"];
                      for (const b of brands) {
                        const bRegex = new RegExp("\\b" + b.replace(/\s+/g, "\\s+") + "\\b", "i");
                        if (bRegex.test(fullText)) {
                          detectedBrand = b;
                          break;
                        }
                      }
                      
                      let detectedModel = "";
                      if (detectedBrand) {
                        const brandEscaped = detectedBrand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const modelRegex = new RegExp(brandEscaped + "\\s+([a-zA-Z0-9\\s\\-\\(\\)]+)", "i");
                        const match = fullText.match(modelRegex);
                        if (match && match[1]) {
                          const parts = match[1].split(/\n|\r/);
                          detectedModel = parts[0].trim().split(/\s{2,}/)[0].slice(0, 30);
                        }
                      }
                      
                      if (!detectedCat) {
                        detectedCat = Object.keys(cats)[0];
                      }
                      
                      const detectedSpecs = {};
                      const getNumberNear = (keywordRegex, suffixRegex = null, contextChars = 85) => {
                        const matchIndex = fullText.search(keywordRegex);
                        if (matchIndex === -1) return null;
                        
                        const start = Math.max(0, matchIndex - 30);
                        const end = Math.min(fullText.length, matchIndex + contextChars);
                        const context = fullText.slice(start, end);
                        
                        if (suffixRegex) {
                          const suffixMatch = context.match(suffixRegex);
                          if (suffixMatch) {
                            const val = parseFloat(suffixMatch[1].replace(/,/g, ''));
                            if (!isNaN(val)) return val;
                          }
                        }
                        
                        const numRegex = /(\d+(?:\.\d+)?)/g;
                        let m;
                        const numbers = [];
                        while ((m = numRegex.exec(context)) !== null) {
                          const val = parseFloat(m[1]);
                          if (!isNaN(val)) numbers.push(val);
                        }
                        return numbers.length > 0 ? numbers[0] : null;
                      };
                      
                      const targetAttrs = cats[detectedCat]?.attrs || [];
                      targetAttrs.forEach(attr => {
                        if (attr.type === "num") {
                          let val = null;
                          if (detectedCat === "drone" && attr.key === "mtow") {
                            val = getNumberNear(/mtow|takeoff|take-off|lepas\s+landas/i, /(\d+(?:\.\d+)?)\s*kg/i);
                            if (val && val < 50) val = val * 1000;
                            if (!val) val = getNumberNear(/mtow|takeoff|take-off|lepas\s+landas/i);
                          } else if (detectedCat === "drone" && attr.key === "payload") {
                            val = getNumberNear(/payload|kapasitas|beban/i, /(\d+(?:\.\d+)?)\s*kg/i);
                            if (val && val < 50) val = val * 1000;
                            if (!val) val = getNumberNear(/payload|kapasitas|beban/i);
                          } else if (detectedCat === "drone" && attr.key === "flight") {
                            val = getNumberNear(/flight\s+time|waktu\s+terbang|terbang|durasi/i);
                          } else if (detectedCat === "drone" && attr.key === "range") {
                            val = getNumberNear(/control\s+range|transmission|jangkauan|transmisi/i);
                          } else if (detectedCat === "drone" && attr.key === "wind") {
                            val = getNumberNear(/wind|angin|hembusan/i);
                          } else if (detectedCat === "total_station" && attr.key === "ang") {
                            val = getNumberNear(/ang|accuracy|akurasi|sudut/i, /(\d+(?:\.\d+)?)(?:"|”|\s*sec|sdt)/i);
                            if (!val) val = getNumberNear(/ang|accuracy|akurasi|sudut/i);
                          } else if (detectedCat === "total_station" && attr.key === "dist") {
                            val = getNumberNear(/dist|jarak|prism/i, /(\d+(?:\.\d+)?)\s*mm/i);
                            if (!val) val = getNumberNear(/dist|jarak|prism/i);
                          } else if (detectedCat === "total_station" && attr.key === "prism") {
                            val = getNumberNear(/prism|prisma/i, /(\d+(?:\.\d+)?)\s*m/i);
                            if (!val) val = getNumberNear(/prism|prisma/i);
                          } else if (detectedCat === "total_station" && attr.key === "norefl") {
                            val = getNumberNear(/reflectorless|non-prism|tanpa\s+prisma/i, /(\d+(?:\.\d+)?)\s*m/i);
                            if (!val) val = getNumberNear(/reflectorless|non-prism|tanpa\s+prisma/i);
                          } else if (detectedCat === "total_station" && attr.key === "mag") {
                            val = getNumberNear(/magnification|perbesaran/i, /(\d+)\s*x/i);
                            if (!val) val = getNumberNear(/magnification|perbesaran/i);
                          } else if (detectedCat === "total_station" && attr.key === "weight") {
                            val = getNumberNear(/weight|berat/i, /(\d+(?:\.\d+)?)\s*kg/i);
                            if (val && val < 50) val = val * 1000;
                            if (!val) val = getNumberNear(/weight|berat/i);
                          } else if (detectedCat === "gnss" && attr.key === "channels") {
                            val = getNumberNear(/channel|kanal|saluran/i);
                          } else if (detectedCat === "gnss" && attr.key === "acc_h") {
                            val = getNumberNear(/horizontal|presisi\s+h|h-accuracy/i, /(\d+(?:\.\d+)?)\s*mm/i);
                            if (!val) val = getNumberNear(/horizontal|presisi\s+h|h-accuracy/i);
                          } else if (detectedCat === "gnss" && attr.key === "acc_v") {
                            val = getNumberNear(/vertical|presisi\s+v|v-accuracy/i, /(\d+(?:\.\d+)?)\s*mm/i);
                            if (!val) val = getNumberNear(/vertical|presisi\s+v|v-accuracy/i);
                          } else if (detectedCat === "gnss" && attr.key === "constel") {
                            let count = 0;
                            ["gps", "glonass", "galileo", "beidou", "qzss", "sbas"].forEach(c => {
                              if (textLower.includes(c)) count++;
                            });
                            val = count || 4;
                          } else if (detectedCat === "gnss" && attr.key === "battery") {
                            val = getNumberNear(/battery|baterai|operasi/i, /(\d+(?:\.\d+)?)\s*h/i);
                            if (!val) val = getNumberNear(/battery|baterai|operasi/i);
                          } else if (detectedCat === "gnss" && attr.key === "weight") {
                            val = getNumberNear(/weight|berat/i, /(\d+(?:\.\d+)?)\s*g/i);
                            if (val && val < 5) val = val * 1000;
                            if (!val) val = getNumberNear(/weight|berat/i);
                          } else if (detectedCat === "autolevel" && attr.key === "acc") {
                            val = getNumberNear(/acc|akurasi|double\s+run/i, /(\d+(?:\.\d+)?)\s*mm/i);
                            if (!val) val = getNumberNear(/acc|akurasi|double\s+run/i);
                          } else if (detectedCat === "autolevel" && attr.key === "mag") {
                            val = getNumberNear(/magnification|perbesaran/i, /(\d+)\s*x/i);
                            if (!val) val = getNumberNear(/magnification|perbesaran/i);
                          } else if (detectedCat === "autolevel" && attr.key === "minfocus") {
                            val = getNumberNear(/min\s+focus|jarak\s+fokus/i, /(\d+(?:\.\d+)?)\s*m/i);
                            if (!val) val = getNumberNear(/min\s+focus|jarak\s+fokus/i);
                          } else if (detectedCat === "autolevel" && attr.key === "range") {
                            val = getNumberNear(/range|jangkauan/i, /(\d+(?:\.\d+)?)\s*m/i);
                            if (!val) val = getNumberNear(/range|jangkauan/i);
                          } else if (detectedCat === "autolevel" && attr.key === "weight") {
                            val = getNumberNear(/weight|berat/i, /(\d+(?:\.\d+)?)\s*kg/i);
                            if (val && val < 50) val = val * 1000;
                            if (!val) val = getNumberNear(/weight|berat/i);
                          } else if (detectedCat === "lidar" && attr.key === "range") {
                            val = getNumberNear(/range|jangkauan|deteksi/i, /(\d+(?:\.\d+)?)\s*m/i);
                            if (!val) val = getNumberNear(/range|jangkauan|deteksi/i);
                          } else if (detectedCat === "lidar" && attr.key === "accuracy") {
                            val = getNumberNear(/accuracy|akurasi/i, /(\d+(?:\.\d+)?)\s*cm/i);
                            if (!val) val = getNumberNear(/accuracy|akurasi/i);
                          } else if (detectedCat === "lidar" && attr.key === "rate") {
                            val = getNumberNear(/rate|kecepatan|point|titik/i, /(\d+(?:\.\d+)?)\s*k/i);
                            if (!val) val = getNumberNear(/rate|kecepatan|point|titik/i);
                          } else if (detectedCat === "lidar" && attr.key === "returns") {
                            val = getNumberNear(/return|pantulan|echo/i);
                          } else if (detectedCat === "lidar" && attr.key === "weight") {
                            val = getNumberNear(/weight|berat/i, /(\d+(?:\.\d+)?)\s*g/i);
                            if (val && val < 5) val = val * 1000;
                            if (!val) val = getNumberNear(/weight|berat/i);
                          } else if (detectedCat === "lidar" && attr.key === "camera") {
                            val = getNumberNear(/camera|kamera|rgb/i, /(\d+(?:\.\d+)?)\s*mp/i);
                            if (!val) val = getNumberNear(/camera|kamera|rgb/i);
                          } else if (detectedCat === "camera" && attr.key === "res") {
                            val = getNumberNear(/resolution|resolusi|pixel|sensor/i, /(\d+(?:\.\d+)?)\s*mp/i);
                            if (!val) val = getNumberNear(/resolution|resolusi|pixel|sensor/i);
                          } else if (detectedCat === "camera" && attr.key === "pixel") {
                            val = getNumberNear(/pixel\s+size|ukuran\s+piksel/i, /(\d+(?:\.\d+)?)\s*(?:um|µm)/i);
                            if (!val) val = getNumberNear(/pixel\s+size|ukuran\s+piksel/i);
                          } else if (detectedCat === "camera" && attr.key === "gsd") {
                            val = getNumberNear(/gsd/i, /(\d+(?:\.\d+)?)\s*cm/i);
                            if (!val) val = getNumberNear(/gsd/i);
                          } else if (detectedCat === "camera" && attr.key === "band") {
                            val = getNumberNear(/band|channel/i);
                          } else if (detectedCat === "camera" && attr.key === "weight") {
                            val = getNumberNear(/weight|berat/i, /(\d+(?:\.\d+)?)\s*g/i);
                            if (val && val < 5) val = val * 1000;
                            if (!val) val = getNumberNear(/weight|berat/i);
                          }
                          
                          if (val !== null && !isNaN(val)) {
                            detectedSpecs[attr.key] = val;
                          }
                        } else if (attr.type === "bool") {
                          let val = false;
                          if (detectedCat === "drone" && attr.key === "rtk") {
                            val = textLower.includes("rtk") || textLower.includes("real-time kinematic");
                          } else if (detectedCat === "camera" && attr.key === "shutter") {
                            val = textLower.includes("shutter") && (textLower.includes("mechanical") || textLower.includes("mekanis") || textLower.includes("global"));
                          }
                          detectedSpecs[attr.key] = val;
                        } else if (attr.type === "txt") {
                          let val = "";
                          if (attr.key === "ip") {
                            const ipMatch = fullText.match(/IP\s*([0-9]{2})/i);
                            if (ipMatch) val = "IP" + ipMatch[1];
                          }
                          if (val) {
                            detectedSpecs[attr.key] = val;
                          }
                        }
                      });
                      // Build final specs matching the category schema
                      const builtSpecs = {};
                      targetAttrs.forEach((a) => {
                        const raw = detectedSpecs[a.key];
                        builtSpecs[a.key] = a.type === "num" ? (raw === "" || raw == null ? null : Number(raw))
                          : a.type === "bool" ? !!raw : (raw || "");
                      });
                      
                      const finalBrand = (detectedBrand || "").trim();
                      const finalModel = (detectedModel || "").trim();
                      
                      if (!finalBrand || !finalModel) {
                        // Not enough info to auto-save — fill form for manual completion
                        setPCat(detectedCat);
                        setBrand(finalBrand);
                        setModel(finalModel);
                        setSpecs(detectedSpecs);
                        setSubTab("prods");
                        setImportMsg(`⚠️ PDF diidentifikasi tapi Brand/Model tidak cukup jelas. Silakan lengkapi form dan simpan manual.`);
                      } else {
                        // Auto-save product to Supabase
                        const id = `${slug(finalBrand)}-${slug(finalModel)}-${Math.random().toString(36).slice(2, 5)}`;
                        
                        // Upload PDF to Supabase Storage
                        let pdfUrl = null;
                        try {
                          const storagePath = `datasheets/${id}.pdf`;
                          const { error: uploadErr } = await supabase.storage.from("datasheets").upload(storagePath, file, {
                            contentType: "application/pdf",
                            upsert: true,
                          });
                          if (!uploadErr) {
                            const { data: urlData } = supabase.storage.from("datasheets").getPublicUrl(storagePath);
                            pdfUrl = urlData?.publicUrl || null;
                          }
                        } catch (_) { /* storage upload optional */ }
                        
                        const newProd = { id, cat: detectedCat, brand: finalBrand, model: finalModel, utama: false, specs: builtSpecs, datasheet_url: pdfUrl };
                        await supabase.from("products").upsert(newProd);
                        setProds(prev => [...prev, newProd]);
                        
                        // Also fill form for review/edit
                        setPCat(detectedCat);
                        setBrand(finalBrand);
                        setModel(finalModel);
                        setSpecs(detectedSpecs);
                        setDatasheetUrl(pdfUrl || "");
                        datasheetFileRef.current = file;
                        setSubTab("prods");
                        setImportMsg(`✅ Produk "${finalBrand} ${finalModel}" berhasil diupload & disimpan ke database! Kategori: ${cats[detectedCat]?.label || detectedCat}. ${pdfUrl ? "📄 PDF tersimpan." : ""} Form terisi untuk review.`);
                      }
                    } catch (err) {
                      setImportMsg("Gagal mengidentifikasi PDF: " + err.message);
                    }
                  };
                  reader.readAsArrayBuffer(file);
                } else {
                  setImportMsg("Gagal: Format file tidak didukung. Gunakan .json, .csv, .xlsx, atau .pdf.");
                }
                e.target.value = "";
              }} />
              <p className="note-sm" style={{ fontSize: 11, color: "var(--mut)", marginTop: 6 }}>
                Upload Produk / File (PDF/CSV/PNG etc)
              </p>

              {/* PDF Preview Card with Animation */}
              {pdfPreview && (
                <div style={{
                  marginTop: 16,
                  border: "1.5px solid var(--line)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
                  animation: "pdfSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                  boxShadow: "0 2px 12px rgba(99, 102, 241, 0.08)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    flexShrink: 0,
                    width: 80,
                    height: 100,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    background: "white",
                    animation: "pdfThumbPulse 2s ease-in-out infinite",
                  }}>
                    <img src={pdfPreview.thumb} alt="PDF preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      📄 {pdfPreview.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 4 }}>
                      {pdfPreview.pages} halaman · PDF berhasil diproses
                    </div>
                    <div style={{
                      marginTop: 8,
                      height: 4,
                      borderRadius: 2,
                      background: "#e2e8f0",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        borderRadius: 2,
                        background: "linear-gradient(90deg, #6366f1, #38bdf8)",
                        animation: "pdfProgressBar 1s ease-out forwards",
                      }} />
                    </div>
                  </div>
                  <button onClick={() => setPdfPreview(null)} style={{
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--mut)",
                    padding: 4,
                    borderRadius: 6,
                    transition: "color 0.2s",
                  }}
                    onMouseEnter={e => e.target.style.color = "var(--red)"}
                    onMouseLeave={e => e.target.style.color = "var(--mut)"}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {importMsg && <span className="msg" style={{ color: importMsg.includes("Gagal") ? "var(--red)" : "#1f7a3d", display: "block", marginTop: 8 }}>{importMsg}</span>}
            </div>
          </div>
        </>
      )}

      {/* Daftar Produk (Hapus & Filter) */}
      {subTab === "list" && (
        <div className="panel">
          <div className="panel-h"><Settings size={14} /> Daftar Produk Tersimpan</div>
          <div className="form">
            {/* Filter controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Filter Kategori</label>
                <select className="inp" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="">Semua Kategori</option>
                  {catKeys.map(k => <option key={k} value={k}>{cats[k]?.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Filter Brand</label>
                <select className="inp" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
                  <option value="">Semua Brand</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="cmp-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--card)", textAlign: "left", borderBottom: "2px solid var(--line)" }}>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("brand")}>
                      Brand {sortKey === "brand" ? (sortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("model")}>
                      Model {sortKey === "model" ? (sortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("cat")}>
                      Kategori {sortKey === "cat" ? (sortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px", width: 60 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedProds.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{p.brand}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--mono)" }}>{p.model}</td>
                      <td style={{ padding: "6px 8px", color: "var(--mut)" }}>{cats[p.cat]?.label}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <button className="icon-btn" style={{display: "inline-block", marginRight: 4}} title="Edit Produk" onClick={() => {
                          setSubTab("prods");
                          setEditProdId(p.id); setPCat(p.cat); setBrand(p.brand); setModel(p.model);
                          setImage(p.image || ""); setNote(p.note || ""); setUtama(p.utama || false); setSpecs(p.specs || {}); setDatasheetUrl(p.datasheet_url || "");
                          setTimeout(() => {
                            document.getElementById('product-form-panel')?.scrollIntoView({ behavior: 'smooth' });
                          }, 50);
                        }}><Edit2 size={13} /></button>
                        <button className="icon-btn" style={{display: "inline-block"}} title="Hapus Produk" onClick={() => delProd(p.id)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSortedProds.length === 0 && <tr><td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "var(--mut)" }}>Belum ada produk.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Kelola Kompatibilitas */}
      {subTab === "compat" && (
        <div className="panel">
          <div className="panel-h"><Link2 size={14} /> Kelola Kompatibilitas</div>
          <div className="form">
            {/* Filter controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Filter Brand Drone</label>
                <select className="inp" value={compatFilterDroneBrand} onChange={e => setCompatFilterDroneBrand(e.target.value)}>
                  <option value="">Semua Brand</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Filter Brand Payload</label>
                <select className="inp" value={compatFilterPayloadBrand} onChange={e => setCompatFilterPayloadBrand(e.target.value)}>
                  <option value="">Semua Brand</option>
                  {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {/* Tabel daftar */}
            <label className="lbl">Daftar pasangan kompatibilitas</label>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table className="cmp-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--card)", textAlign: "left", borderBottom: "2px solid var(--line)" }}>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleCompatSort("drone")}>
                      Drone {compatSortKey === "drone" ? (compatSortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleCompatSort("payload")}>
                      Payload {compatSortKey === "payload" ? (compatSortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px", cursor: "pointer", userSelect: "none" }} onClick={() => toggleCompatSort("status")}>
                      Status {compatSortKey === "status" ? (compatSortAsc ? " ▲" : " ▼") : ""}
                    </th>
                    <th style={{ padding: "6px 8px" }}>Catatan</th>
                    <th style={{ padding: "6px 8px", width: 60 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedCompat.map((c, i) => {
                    const dr = prods.find(p => p.id === c.drone);
                    const pl = prods.find(p => p.id === c.payload);
                    const statusColors = { ok: "#1f7a3d", adapter: "#b45309", no: "var(--red)" };
                    const statusLabels = { ok: "Kompatibel", adapter: "Perlu Adapter", no: "Tidak Kompatibel" };
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "6px 8px" }}>{dr ? `${dr.brand} ${dr.model}` : c.drone}</td>
                        <td style={{ padding: "6px 8px" }}>{pl ? `${pl.brand} ${pl.model}` : c.payload}</td>
                        <td style={{ padding: "6px 8px" }}>
                          {editCompatId === c.id ? (
                            <select className="inp" style={{padding: "4px"}} value={editCompatStatus} onChange={(e) => setEditCompatStatus(e.target.value)}>
                              <option value="ok">Kompatibel</option>
                              <option value="adapter">Perlu Adapter</option>
                              <option value="no">Tidak Kompatibel</option>
                            </select>
                          ) : (
                            <span style={{ color: statusColors[c.status] || "var(--ink)", fontWeight: 600 }}>{statusLabels[c.status] || c.status}</span>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--mut)" }}>
                          {editCompatId === c.id ? (
                            <input className="inp" style={{padding: "4px"}} value={editCompatNote} onChange={(e) => setEditCompatNote(e.target.value)} />
                          ) : (
                            c.note
                          )}
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {editCompatId === c.id ? (
                            <button className="icon-btn" style={{color: "var(--ink)", display: "inline-block", marginRight: 4}} title="Simpan" onClick={async () => {
                              await supabase.from("compatibilities").update({ status: editCompatStatus, note: editCompatNote }).eq("id", c.id);
                              setCompat(compat.map(x => x.id === c.id ? { ...x, status: editCompatStatus, note: editCompatNote } : x));
                              setEditCompatId(null);
                            }}><Check size={13} /></button>
                          ) : (
                            <button className="icon-btn" style={{display: "inline-block", marginRight: 4}} title="Edit" onClick={() => {
                              setEditCompatId(c.id); setEditCompatStatus(c.status); setEditCompatNote(c.note || "");
                            }}><Edit2 size={13} /></button>
                          )}
                          <button className="icon-btn" style={{display: "inline-block"}} title="Hapus" onClick={async () => {
                            const item = compat[i];
                            if (item.id) await supabase.from("compatibilities").delete().match({ id: item.id });
                            setCompat(compat.filter((_, j) => j !== i));
                          }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAndSortedCompat.length === 0 && <tr><td colSpan={5} style={{ padding: "12px 8px", textAlign: "center", color: "var(--mut)" }}>Belum ada data kompatibilitas.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Form tambah kompatibilitas */}
            <CompatForm prods={prods} onAdd={async (entry) => {
              const newEntry = { ...entry, id: `cmp-${Date.now()}` };
              await supabase.from("compatibilities").insert(newEntry);
              setCompat([...compat, newEntry]);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- APP ----------------------------------- */
import { supabase } from "./supabase";

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // Very basic plain-text password check against app_users table for demo purposes
      const { data, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("username", username)
        .eq("password", pwd)
        .single();

      if (error || !data) {
        setErr("Username atau Password salah");
      } else {
        onLogin(data);
      }
    } catch (err) {
      setErr("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap" style={{ padding: 40, textAlign: "center", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@500;700&display=swap');
        .wrap{
          --ink:#FFFFFF; --paper:#000000; --card:#121212; --line:#262626;
          --red:#D81E2C; --red-d:#A8131F; --red-bg:rgba(216, 30, 44, 0.15); --mut:#A3A3A3;
          --hover:#1A1A1A;
          --mono:'JetBrains Mono',ui-monospace,Menlo,monospace; --disp:'Plus Jakarta Sans',system-ui,sans-serif;
        }
        .wrap.light{
          --ink:#0F172A; --paper:#F8FAFC; --card:#FFFFFF; --line:#E2E8F0;
          --red:#D81E2C; --red-d:#A8131F; --red-bg:rgba(216, 30, 44, 0.08); --mut:#64748B;
          --hover:#F1F5F9;
        }
        .wrap *{box-sizing:border-box;margin:0}
        .wrap{
          font-family:var(--disp);
          color:var(--ink);
          background:var(--paper);
          border:1px solid var(--line);
          max-width:840px;
          border-top:5px solid var(--red);
          margin:40px auto;
          border-radius:16px;
          box-shadow: 0 10px 30px rgba(216, 30, 44, 0.3);
          overflow:hidden;
        }
        .inp{
          font-family:var(--disp);
          font-size:13px;
          font-weight:500;
          padding:9px 12px;
          border:1px solid var(--line);
          background:var(--paper);
          color:var(--ink);
          border-radius:8px;
          outline:none;
          transition:all 0.2s ease;
        }
        .inp:focus{
          border-color:var(--red);
          box-shadow: 0 0 0 3px rgba(216, 30, 44, 0.2);
        }
        .btn{
          font-family:var(--mono);
          font-size:13px;
          font-weight:700;
          letter-spacing:.5px;
          background:var(--red);
          color:#fff;
          border:none;
          padding:9px 18px;
          cursor:pointer;
          border-radius:8px;
          transition:all 0.2s ease;
        }
        .btn:hover{
          background:var(--red-d);
          transform:translateY(-1px);
        }
        .btn:disabled{
          opacity:0.6;
          cursor:not-allowed;
          transform:none;
        }
        .btn-action{
          font-family:var(--disp);
          font-size:11px;
          font-weight:600;
          background:var(--card);
          border:1px solid var(--line);
          color:var(--ink);
          padding:6px 12px;
          cursor:pointer;
          border-radius:6px;
          transition:all 0.2s;
        }
        .btn-action:hover{
          background:var(--red);
          color:#fff;
          border-color:var(--red);
        }
      `}</style>
      <h2 style={{ marginBottom: 10 }}>Login Akses</h2>
      <p style={{ fontSize: 13, color: "var(--mut)", marginBottom: 20 }}>Silakan masuk menggunakan akun yang telah didaftarkan oleh Admin.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="inp" style={{ width: 240 }} placeholder="Username" required />
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} className="inp" style={{ width: 240 }} placeholder="Password" required />
        <button type="submit" className="btn" style={{ width: 240 }} disabled={loading}>
          {loading ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
      {err && <div style={{ color: "var(--red)", marginTop: 15, fontSize: 13, fontWeight: 600 }}>{err}</div>}
    </div>
  );
}

export default function App() {
  const isPrintMode = new URLSearchParams(window.location.search).get("print") === "true";
  const [user, setUser] = useState(isPrintMode ? { role: 'user' } : null);
  const [cats, setCats] = useState({});
  const [prods, setProds] = useState([]);
  const [compat, setCompat] = useState([]);
  const [tab, setTab] = useState("compare");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [catsRes, prodsRes, compatRes] = await Promise.all([
          supabase.from("categories").select("*"),
          supabase.from("products").select("*"),
          supabase.from("compatibilities").select("*")
        ]);
        
        // Load directly from Supabase
        if (catsRes.data && catsRes.data.length > 0) {
          const catsObj = {};
          catsRes.data.forEach(c => { catsObj[c.id] = { label: c.label, attrs: c.attrs }; });
          setCats(catsObj);
        }
        
        if (prodsRes.data && prodsRes.data.length > 0) {
          setProds(prodsRes.data);
        }
        if (compatRes.data && compatRes.data.length > 0) {
          setCompat(compatRes.data);
        }
      } catch (err) {
        console.error("Error loading data from Supabase", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (!user) {
    return <LoginScreen onLogin={(u) => setUser(u)} />;
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="wrap light">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=JetBrains+Mono:wght@500;700&display=swap');
        .wrap{
          --ink:#FFFFFF; --paper:#000000; --card:#121212; --line:#262626;
          --red:#D81E2C; --red-d:#A8131F; --red-bg:rgba(216, 30, 44, 0.15); --mut:#A3A3A3;
          --hover:#1A1A1A; --header-bg:#FFFFFF;
          --best-bg:rgba(255, 255, 255, 0.08); --best-color:#FFFFFF; --best-border:#FFFFFF;
          --mono:'JetBrains Mono',ui-monospace,Menlo,monospace; --disp:'Plus Jakarta Sans',system-ui,sans-serif;
        }
        .wrap.light{
          --ink:#0F172A; --paper:#F8FAFC; --card:#FFFFFF; --line:#E2E8F0;
          --red:#D81E2C; --red-d:#A8131F; --red-bg:rgba(216, 30, 44, 0.08); --mut:#64748B;
          --hover:#F1F5F9; --header-bg:#FFFFFF;
          --best-bg:rgba(216, 30, 44, 0.08); --best-color:#D81E2C; --best-border:#D81E2C;
        }
        .wrap *{box-sizing:border-box;margin:0}
        .wrap{
          font-family:var(--disp);
          color:var(--ink);
          background:var(--paper);
          border:1px solid var(--line);
          max-width:900px;
          border-top:5px solid var(--red);
          margin:40px auto;
          border-radius:16px;
          box-shadow: 0 10px 30px rgba(216, 30, 44, 0.3);
          overflow:hidden;
        }
        .inp{
          font-family:var(--disp);
          font-size:13px;
          font-weight:500;
          padding:9px 12px;
          border:1px solid var(--line);
          background:var(--paper);
          color:var(--ink);
          border-radius:8px;
          outline:none;
          transition:all 0.2s ease;
        }
        .inp:focus{
          border-color:var(--red);
          box-shadow: 0 0 0 3px rgba(216, 30, 44, 0.2);
        }
        select.inp{
          appearance:none;
          -webkit-appearance:none;
          background-color:var(--paper);
          color:var(--ink);
          border:1px solid var(--line);
          padding-right:28px;
          cursor:pointer;
          background-image:url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat:no-repeat;
          background-position:right 10px center;
          background-size:14px;
        }
        .wrap.light select.inp {
          background-image:url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        }
        .topbar{
          background:var(--header-bg);
          padding:16px 24px;
          display:flex;
          align-items:center;
          gap:14px;
          border-bottom:1px solid var(--line);
        }
        .topbar img{height:34px;display:block}
        .topbar .tool{color:#000000;font-weight:700;font-size:15px;border-left:1px solid var(--line);padding-left:14px}
        .topbar .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--red);margin-left:auto}
        .body{padding:22px}
        .tabs{display:flex;margin-bottom:20px;border:1px solid var(--ink);width:fit-content}
        .tabs button{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.5px;padding:9px 16px;background:var(--card);border:none;cursor:pointer;color:var(--mut);display:flex;align-items:center;gap:7px}
        .tabs button+button{border-left:1px solid var(--ink)}
        .tabs button.on{background:var(--red);color:#fff}
        .cat-row{display:flex;gap:7px;margin-bottom:18px;flex-wrap:wrap}
        .chip{font-family:var(--mono);font-size:11px;font-weight:600;padding:6px 12px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--mut)}
        .chip-on{border-color:var(--ink);color:#fff;background:var(--ink)}
        .lbl{font-family:var(--mono);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--mut);display:block;margin-bottom:8px}
        .lbl.mt{margin-top:16px}
        .slot-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
        .slot{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:7px 9px 7px 11px;border:1.5px solid var(--ink);background:var(--card)}
        .slot b{font-weight:800}.slot .dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
        .slot-star{color:var(--red)}
        .slot-x{border:none;background:none;cursor:pointer;color:var(--mut);padding:0;display:flex;margin-left:2px}
        .slot-x:hover{color:var(--red)}
        .picker{position:relative}
        .picker select{width:100%;appearance:none;font-family:var(--disp);font-size:13.5px;font-weight:600;padding:10px 30px 10px 12px;border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--ink)}
        .picker.add select{border:1.5px dashed var(--mut);padding-left:28px;color:var(--mut);height:100%;border-radius:0}
        .picker.add .add-ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--mut)}
        .picker select:focus{outline:2px solid var(--red);outline-offset:-1px}
        .picker-ic{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--mut)}
        .panel{
          border:1px solid var(--line);
          background:var(--card);
          margin-bottom:20px;
          border-radius:12px;
          overflow:hidden;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .panel-h{
          font-family:var(--mono);
          font-size:11px;
          font-weight:700;
          letter-spacing:1px;
          text-transform:uppercase;
          padding:12px 16px;
          background:#262626;
          color:#FFFFFF;
          display:flex;
          align-items:center;
          gap:8px;
          border-bottom:1px solid var(--line);
        }
        .panel-h svg{color:#FFFFFF}
        .icon-btn{background:none;border:none;cursor:pointer;color:var(--mut);padding:4px;display:flex;align-items:center;justify-content:center;border-radius:4px}
        .icon-btn:hover{background:var(--paper);color:var(--red)}
        .scrow{
          display:grid;
          grid-template-columns: 28px 1.5fr 2fr 48px;
          align-items:center;
          gap:10px;
          padding:12px 14px;
          border-bottom:1px solid var(--line);
        }
        .scrow:last-child{border-bottom:none}.scrow.lead{background:var(--red-bg)}
        .rank{font-family:var(--mono);font-weight:700;font-size:13px;color:var(--mut);text-align:center}
        .scrow.lead .rank{background:var(--red);color:#fff;border-radius:50%;width:22px;height:22px;line-height:22px;justify-self:center}
        .sc-label{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-label .ut{color:var(--red)}
        .sc-track{
          height:8px;
          background:var(--line);
          overflow:hidden;
          border-radius:99px;
        }
        .sc-track i{
          display:block;
          height:100%;
          border-radius:99px;
        }
        .sc-num{font-family:var(--mono);font-weight:700;font-size:15px;text-align:right}
        .chart{padding:14px 6px 4px}
        .hint{font-size:11px;color:var(--mut);padding:0 14px 12px;line-height:1.4}
        .tbl-scroll{overflow-x:auto}
        .tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .tbl th{padding:10px 12px;text-align:center;font-weight:700;border-bottom:2px solid var(--ink);vertical-align:top;background:var(--card)}
        .tbl th .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
        .th-mod{font-weight:500;font-size:11px;color:var(--mut)}
        .th-attr{text-align:left!important;font-family:var(--mono);font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--mut)}
        .td-attr{padding:9px 12px;font-weight:600;border-bottom:1px solid var(--line);white-space:nowrap}
        .td-val{padding:9px 12px;text-align:center;font-family:var(--mono);font-weight:600;border-bottom:1px solid var(--line)}
        .td-val.best{background:var(--red-bg);color:var(--red-d);font-weight:700;box-shadow:inset 0 0 0 1.5px var(--red)}
        /* reco */
        .reco{border:1px solid var(--ink);background:var(--card);border-left:5px solid var(--red);margin-bottom:16px}
        .reco-h{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:11px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px}
        .reco-h svg{color:var(--red)}
        .reco-body{padding:16px}
        .reco-pick{display:flex;align-items:center;gap:12px;margin-bottom:14px}
        .reco-medal{width:38px;height:38px;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .reco-pick-name{font-size:17px;font-weight:800}
        .reco-pick-sub{font-family:var(--mono);font-size:11px;color:var(--mut);margin-top:2px}
        .reco-explain{font-size:12.5px;line-height:1.55;color:var(--ink);background:var(--paper);padding:11px 13px;margin-bottom:12px;border:1px solid var(--line)}
        .reco-explain svg{color:var(--red);vertical-align:-1px;margin-right:3px}
        .reco-line{font-size:13px;line-height:1.5;margin-bottom:9px}
        .reco-line.warn{color:var(--red-d)}
        .reco-line.note{color:var(--mut);font-size:12px;display:flex;align-items:flex-start;gap:6px}
        .reco-line.note svg{color:var(--red);flex-shrink:0;margin-top:2px}
        /* compat */
        .vs-head{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end;margin-bottom:14px}
        .vs-x{padding-bottom:11px;color:var(--red)}
        .result{border:1px solid var(--ink);background:var(--card);padding:24px;text-align:center;box-shadow:3px 3px 0 var(--ink)}
        .result-badge{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:15px;font-weight:700;padding:8px 16px;letter-spacing:.5px}
        .result.ok .result-badge{background:var(--ink);color:#fff}
        .result.adapter .result-badge{background:#fff;color:var(--ink);border:1.5px solid var(--mut)}
        .result.no .result-badge{background:var(--red);color:#fff}
        .result-pair{font-size:16px;font-weight:600;margin:14px 0 8px}.result-pair .amp{color:var(--red);font-weight:800;margin:0 4px}
        .result-note{font-size:13px;color:var(--mut);max-width:460px;margin:0 auto;line-height:1.5}
        .empty{padding:30px;text-align:center;color:var(--mut);font-size:13px;border:1px dashed var(--line);line-height:1.5}
        /* forms */
        .note-bar{font-size:12px;color:var(--mut);background:var(--card);border:1px solid var(--line);padding:11px 13px;margin-bottom:16px;display:flex;gap:8px;align-items:flex-start;line-height:1.45}
        .note-bar svg{color:var(--red);flex-shrink:0;margin-top:1px}
        .note-bar code{font-family:var(--mono);font-size:11px;background:var(--paper);padding:1px 4px}
        .form{padding:16px}
        .inp{width:100%;font-family:var(--disp);font-size:13px;font-weight:500;padding:9px 11px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
        .inp:focus{outline:2px solid var(--red);outline-offset:-1px}
        .attr-head{display:grid;grid-template-columns:1fr .6fr .8fr .8fr 34px;gap:8px;margin-bottom:6px;font-family:var(--mono);font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--mut)}
        .attr-row{display:grid;grid-template-columns:1fr .6fr .8fr .8fr 34px;gap:8px;margin-bottom:8px;align-items:center}
        .icon-btn{border:1px solid var(--line);background:var(--card);cursor:pointer;color:var(--mut);height:36px;display:flex;align-items:center;justify-content:center}
        .icon-btn:hover{color:var(--red);border-color:var(--red)}
        .btn-ghost{font-family:var(--mono);font-size:11px;font-weight:600;background:none;border:1px dashed var(--mut);color:var(--mut);padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-top:4px}
        .btn-action{font-family:var(--disp);font-size:12px;font-weight:600;background:var(--card);border:1px solid var(--line);color:var(--ink);padding:8px 14px;cursor:pointer;border-radius:4px;transition:all 0.2s}
        .btn-action:hover{border-color:var(--ink);background:var(--paper)}
        .btn{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.5px;background:var(--red);color:#fff;border:none;padding:10px 18px;cursor:pointer}
        .btn:hover{background:var(--red-d)}
        .form-foot{display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}
        .msg{font-size:12px;color:#1f7a3d;font-weight:600;display:flex;align-items:center;gap:5px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid2.mt{margin-top:14px}
        .chk-wrap{display:flex;align-items:flex-end}
        .chk{font-size:13px;font-weight:600;display:flex;align-items:center;gap:7px;cursor:pointer}
        .chk.sm{font-size:12px;font-weight:500}
        .chk input{width:15px;height:15px;accent-color:var(--red)}
        .spec-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .spec-f{display:flex;flex-direction:column;gap:4px}
        .spec-l{font-size:11px;color:var(--mut);font-weight:600}
        .cat-list{padding:6px 0}
        .cat-item{display:flex;justify-content:space-between;align-items:center;padding:9px 16px;border-bottom:1px solid var(--line)}
        .cat-item:last-child{border:none}
        .cat-name{font-weight:700;font-size:13px}
        .cat-meta{font-family:var(--mono);font-size:11px;color:var(--mut)}
        .foot{font-family:var(--mono);font-size:10px;color:var(--mut);margin-top:6px;padding-top:12px;border-top:1px dashed var(--line);display:flex;gap:6px;align-items:center}
        @media(max-width:600px){
          .vs-head{grid-template-columns:1fr;gap:14px}.vs-x{display:none}
          .scrow{grid-template-columns:22px 1fr 1.4fr 36px;gap:7px}
          .grid2,.spec-grid{grid-template-columns:1fr}
          .attr-head{display:none}
          .attr-row{grid-template-columns:1fr 1fr;gap:6px}
        }
      `}</style>

      <div className="topbar">
        <img src={LOGO} alt="Jaya Survey Indonesia" />
        <span className="tool">Product Comparison</span>
        <span className="eyebrow">Engine v2</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {user && (
            <button 
              className="btn" 
              style={{ padding: "5px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6, borderRadius: 6 }} 
              onClick={() => setUser(null)}
              title="Logout"
            >
              <LogOut size={13} /> Logout
            </button>
          )}
        </div>
      </div>

      <div className="body">
        {!isPrintMode && (
          <div className="tabs">
            <button className={tab === "compare" ? "on" : ""} onClick={() => setTab("compare")}><Gauge size={14} /> Bandingkan</button>
            <button className={tab === "compat" ? "on" : ""} onClick={() => setTab("compat")}><Link2 size={14} /> Kompatibilitas</button>
            {isAdmin && <button className={tab === "manage" ? "on" : ""} onClick={() => setTab("manage")}><Settings size={14} /> Kelola</button>}
          </div>
        )}

        {tab === "compare" && <CompareMode theme="light" cats={cats} prods={prods} />}
        {tab === "compat" && <CompatMode prods={prods} compat={compat} />}
        {tab === "manage" && <ManageMode cats={cats} setCats={setCats} prods={prods} setProds={setProds} compat={compat} setCompat={setCompat} />}

        <div className="foot"><AlertTriangle size={12} /> Angka spec contoh — ganti dengan nilai datasheet asli.</div>
      </div>
    </div>
  );
}
