import { useState, useEffect, useRef, useCallback } from "react";

// ── constants ────────────────────────────────────────────────────────────────
const BURNERS = [
  { id: 0, label: "Front Left",  x: 28, y: 30 },
  { id: 1, label: "Front Right", x: 72, y: 30 },
  { id: 2, label: "Back Left",   x: 28, y: 70 },
  { id: 3, label: "Back Right",  x: 72, y: 70 },
];

const HAZARD_STATES = {
  SAFE:        { label: "Safe",              color: "#22c55e", bg: "#052e16" },
  MONITORING:  { label: "Monitoring",        color: "#facc15", bg: "#1c1400" },
  WARNING:     { label: "Warning",           color: "#f97316", bg: "#1c0a00" },
  DANGER:      { label: "Danger – Unattended",color: "#ef4444", bg: "#1c0000" },
  BOILOVER:    { label: "Boil-Over Risk",    color: "#a855f7", bg: "#180020" },
};

const SCENARIOS = [
  { name: "Normal Cooking",    temps: [180, 0, 0, 0],    pans: [true, false, false, false], attended: true  },
  { name: "Empty Pan Heating", temps: [320, 0, 0, 0],    pans: [true, false, false, false], attended: false },
  { name: "Boil-Over Risk",    temps: [102, 0, 95, 0],   pans: [true, false, true,  false], attended: true  },
  { name: "Left Unattended",   temps: [240, 0, 0, 0],    pans: [true, false, false, false], attended: false },
  { name: "Multi-Burner",      temps: [175, 210, 0, 135],pans: [true, true,  false, true ], attended: true  },
];

// ── helpers ──────────────────────────────────────────────────────────────────
function tempToColor(t) {
  if (t <= 0)   return "#1e293b";
  if (t < 100)  return "#1d4ed8";
  if (t < 180)  return "#16a34a";
  if (t < 250)  return "#d97706";
  if (t < 320)  return "#dc2626";
  return "#7c3aed";
}

function classifyBurner(temp, hasPan, inactiveSeconds) {
  if (temp <= 0) return "SAFE";
  if (!hasPan && temp > 200) return "DANGER";
  if (hasPan && temp > 95 && temp < 115) return "BOILOVER";
  if (inactiveSeconds > 300 && temp > 150) return "DANGER";
  if (inactiveSeconds > 120 && temp > 120) return "WARNING";
  if (temp > 150) return "MONITORING";
  return "SAFE";
}

// ── Thermal Grid Cell ─────────────────────────────────────────────────────────
function ThermalCell({ temp, x, y }) {
  const noise = (Math.sin(x * 7.3 + y * 3.1) * 0.5 + 0.5) * 0.12;
  const t = Math.max(0, temp + temp * noise);
  return (
    <div
      style={{
        background: tempToColor(t),
        opacity: temp > 0 ? 0.7 + noise * 0.3 : 0.25,
        transition: "background 0.6s ease",
        borderRadius: 2,
      }}
    />
  );
}

// ── Burner Panel ──────────────────────────────────────────────────────────────
function BurnerPanel({ burner, temp, hasPan, inactive, onClick }) {
  const state = classifyBurner(temp, hasPan, inactive);
  const { color, bg, label } = HAZARD_STATES[state];
  const active = temp > 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1.5px solid ${active ? color : "#1e293b"}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.3s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {state === "DANGER" && (
        <div style={{
          position: "absolute", inset: 0,
          background: `${color}18`,
          animation: "pulse 1.2s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>
          {burner.label.toUpperCase()}
        </span>
        <span style={{
          background: color + "22", color, fontSize: 10,
          padding: "2px 7px", borderRadius: 99, fontWeight: 700,
          fontFamily: "monospace", letterSpacing: 0.5,
        }}>
          {label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
        <span style={{ color, fontSize: 28, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>
          {active ? `${temp}°` : "OFF"}
        </span>
        {active && <span style={{ color: "#64748b", fontSize: 12 }}>C</span>}
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b" }}>
        <span>{hasPan ? "🍳 Pan present" : "⚠ No pan"}</span>
        {active && <span>· {inactive < 60 ? `${inactive}s idle` : `${Math.round(inactive/60)}m idle`}</span>}
      </div>

      {/* mini sparkline */}
      {active && (
        <div style={{ marginTop: 10, height: 24, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const h = Math.max(2, Math.round(
              (temp * (0.6 + 0.4 * Math.sin(i * 0.9 + burner.id))) / 400 * 24
            ));
            return (
              <div key={i} style={{
                flex: 1, height: h,
                background: i === 11 ? color : color + "55",
                borderRadius: 2, transition: "height 0.4s",
              }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StoveSafetyMonitor() {
  const [temps, setTemps]       = useState([0, 0, 0, 0]);
  const [pans, setPans]         = useState([false, false, false, false]);
  const [inactive, setInactive] = useState([0, 0, 0, 0]);
  const [alerts, setAlerts]     = useState([]);
  const [tick, setTick]         = useState(0);
  const [activeScenario, setActiveScenario] = useState(null);
  const alertId = useRef(0);

  // simulate thermal drift + inactivity timer
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setTemps(prev => prev.map(t =>
        t > 0 ? Math.max(0, t + (Math.random() - 0.48) * 4) : 0
      ));
      setInactive(prev => prev.map((sec, i) =>
        temps[i] > 0 ? sec + 1 : 0
      ));
    }, 1000);
    return () => clearInterval(id);
  }, [temps]);

  // hazard detection → alerts
  useEffect(() => {
    temps.forEach((temp, i) => {
      const state = classifyBurner(temp, pans[i], inactive[i]);
      if (state === "DANGER" || state === "BOILOVER") {
        const msg = state === "DANGER"
          ? (pans[i] ? `${BURNERS[i].label}: Unattended for ${Math.round(inactive[i]/60)}m at ${Math.round(temp)}°C`
                     : `${BURNERS[i].label}: Empty pan overheating – ${Math.round(temp)}°C!`)
          : `${BURNERS[i].label}: Boil-over imminent – ${Math.round(temp)}°C`;
        setAlerts(prev => {
          if (prev.some(a => a.burnerId === i && a.state === state)) return prev;
          return [{ id: alertId.current++, burnerId: i, state, msg, time: new Date() }, ...prev].slice(0, 6);
        });
      }
    });
  }, [tick]);

  const loadScenario = (s) => {
    setTemps([...s.temps]);
    setPans([...s.pans]);
    setInactive([0, 0, 0, 0]);
    setAlerts([]);
    setActiveScenario(s.name);
  };

  const toggleBurner = (i) => {
    setTemps(prev => {
      const next = [...prev];
      next[i] = next[i] > 0 ? 0 : 120 + Math.random() * 80;
      return next;
    });
    setInactive(prev => { const n = [...prev]; n[i] = 0; return n; });
  };

  const togglePan = (i) => setPans(prev => { const n = [...prev]; n[i] = !n[i]; return n; });

  // overall system state
  const worstState = BURNERS.reduce((worst, b) => {
    const states = ["SAFE", "MONITORING", "WARNING", "DANGER", "BOILOVER"];
    const s = classifyBurner(temps[b.id], pans[b.id], inactive[b.id]);
    return states.indexOf(s) > states.indexOf(worst) ? s : worst;
  }, "SAFE");

  const { color: sysColor, label: sysLabel, bg: sysBg } = HAZARD_STATES[worstState];

  // build 10×10 thermal grid
  const GRID = 10;
  const gridCells = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const cx = (gx / (GRID - 1)) * 100;
      const cy = (gy / (GRID - 1)) * 100;
      let blendTemp = 0;
      BURNERS.forEach(b => {
        const dist = Math.hypot(cx - b.x, cy - b.y);
        const w = Math.max(0, 1 - dist / 35);
        blendTemp += temps[b.id] * w * w;
      });
      gridCells.push({ gx, gy, temp: Math.min(blendTemp, 400) });
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080f1a",
      color: "#e2e8f0",
      fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
      padding: "24px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:.15} 50%{opacity:.4} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{transform:translateX(40px);opacity:0} to{transform:none;opacity:1} }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:#0f1a2b }
        ::-webkit-scrollbar-thumb { background:#1e3a5f; border-radius:4px }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sysColor,
                animation: worstState !== "SAFE" ? "blink 1s infinite" : "none" }} />
              <span style={{ fontSize: 11, letterSpacing: 3, color: "#475569", textTransform: "uppercase" }}>
                THERMAL SAFETY MONITOR v0.1
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif",
              letterSpacing: -0.5, color: "#f1f5f9" }}>
              Cooktop Hazard Detection
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}>
              IR thermal imaging · probabilistic inference · edge processing
            </p>
          </div>
          <div style={{
            background: sysBg, border: `1px solid ${sysColor}`,
            borderRadius: 10, padding: "12px 20px", textAlign: "right",
          }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 2 }}>SYSTEM STATE</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: sysColor }}>{sysLabel.toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 960, margin: "0 auto" }}>

        {/* Thermal Heatmap */}
        <div style={{ gridColumn: "1 / -1", background: "#0d1a2b", border: "1px solid #1e3a5f",
          borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>
            INFRARED THERMAL VIEW — 10×10 SENSOR ARRAY
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID},1fr)`,
            gap: 3, aspectRatio: "2/1", marginBottom: 14 }}>
            {gridCells.map(({ gx, gy, temp }) => (
              <ThermalCell key={`${gx}-${gy}`} temp={temp} x={gx * 10} y={gy * 10} />
            ))}
          </div>
          {/* legend */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#475569" }}>
            {[["#1e293b","Off/Cool"],["#1d4ed8","<100°C"],["#16a34a","100–180°C"],
              ["#d97706","180–250°C"],["#dc2626","250–320°C"],["#7c3aed","320°C+"]].map(([c, l]) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, background: c, borderRadius: 2 }} />
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* Burner Panels */}
        <div style={{ gridColumn: "1 / -1", display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {BURNERS.map(b => (
            <BurnerPanel
              key={b.id}
              burner={b}
              temp={Math.round(temps[b.id])}
              hasPan={pans[b.id]}
              inactive={inactive[b.id]}
              onClick={() => toggleBurner(b.id)}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ background: "#0d1a2b", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#475569", marginBottom: 14 }}>
            SCENARIOS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SCENARIOS.map(s => (
              <button key={s.name} onClick={() => loadScenario(s)} style={{
                background: activeScenario === s.name ? "#1e3a5f" : "#0f1e30",
                border: `1px solid ${activeScenario === s.name ? "#3b82f6" : "#1e3a5f"}`,
                color: activeScenario === s.name ? "#93c5fd" : "#94a3b8",
                borderRadius: 8, padding: "9px 14px", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, textAlign: "left",
                transition: "all 0.2s",
              }}>
                {s.name}
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #1e3a5f", marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#475569", marginBottom: 10 }}>
              TOGGLE PANS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {BURNERS.map(b => (
                <button key={b.id} onClick={() => togglePan(b.id)} style={{
                  background: pans[b.id] ? "#052e16" : "#0f1e30",
                  border: `1px solid ${pans[b.id] ? "#22c55e" : "#1e3a5f"}`,
                  color: pans[b.id] ? "#4ade80" : "#64748b",
                  borderRadius: 7, padding: "7px 10px", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, transition: "all 0.2s",
                }}>
                  {b.label.split(" ")[0][0]}{b.label.split(" ")[1][0]} {pans[b.id] ? "🍳" : "·"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1e3a5f", marginTop: 14, paddingTop: 12,
            fontSize: 10, color: "#334155", lineHeight: 1.6 }}>
            Click any burner panel to toggle it on/off.<br />
            Inactive timer increments each second while active.
          </div>
        </div>

        {/* Alert Log */}
        <div style={{ background: "#0d1a2b", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20,
          display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, color: "#475569" }}>ALERT LOG</span>
            {alerts.length > 0 && (
              <button onClick={() => setAlerts([])} style={{
                background: "none", border: "none", color: "#475569",
                fontSize: 10, cursor: "pointer", fontFamily: "inherit",
              }}>CLEAR</button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#1e3a5f", fontSize: 12 }}>
              No alerts
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 260 }}>
              {alerts.map(a => {
                const { color, bg } = HAZARD_STATES[a.state];
                return (
                  <div key={a.id} style={{
                    background: bg, border: `1px solid ${color}44`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 8, padding: "9px 12px",
                    animation: "slideIn 0.3s ease",
                  }}>
                    <div style={{ color, fontSize: 10, fontWeight: 700, marginBottom: 3, letterSpacing: 1 }}>
                      {HAZARD_STATES[a.state].label.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>{a.msg}</div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>
                      {a.time.toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inference Summary */}
        <div style={{ gridColumn: "1 / -1", background: "#0d1a2b",
          border: "1px solid #1e3a5f", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#475569", marginBottom: 14 }}>
            CONTEXTUAL INFERENCE ENGINE — ACTIVE BURNERS
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {BURNERS.filter(b => temps[b.id] > 0).map(b => {
              const state = classifyBurner(temps[b.id], pans[b.id], inactive[b.id]);
              const { color } = HAZARD_STATES[state];
              const confidence = Math.min(99, 40 + inactive[b.id] / 10 * 3 + (temps[b.id] > 200 ? 20 : 0));
              return (
                <div key={b.id} style={{
                  background: "#0a1525", border: "1px solid #1e3a5f",
                  borderRadius: 10, padding: "12px 16px", minWidth: 180,
                }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>{b.label}</div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
                      color: "#64748b", marginBottom: 4 }}>
                      <span>Hazard confidence</span>
                      <span style={{ color }}>{Math.round(confidence)}%</span>
                    </div>
                    <div style={{ height: 5, background: "#1e293b", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${confidence}%`,
                        background: color, borderRadius: 99, transition: "width 0.5s" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#475569", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span>· dT/dt: {temps[b.id] > 200 ? "↑ rapid" : "→ stable"}</span>
                    <span>· Pan mass: {pans[b.id] ? "detected" : "absent"}</span>
                    <span>· User interval: {inactive[b.id] < 60 ? "recent" : "extended"}</span>
                  </div>
                </div>
              );
            })}
            {BURNERS.every(b => temps[b.id] === 0) && (
              <div style={{ color: "#1e3a5f", fontSize: 12 }}>All burners off — no active inference</div>
            )}
          </div>
        </div>

      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "#1e3a5f", letterSpacing: 1 }}>
        PROTOTYPE · Based on "Context-Aware Thermal Safety Monitoring" · Simulated IR data
      </div>
    </div>
  );
}
