import React, { useState, useRef } from "react";

interface SettingsProps {
    onClose: () => void;
    onLogoutEverywhere: () => void;
}

interface ColorTheme {
    id: string;
    label: string;
    accent: string;
    accentDark: string;
    accentLight: string;
    accentRgb: string;
}

const THEMES: ColorTheme[] = [
    { id: "gold", label: "Elite Gold", accent: "#d4af37", accentDark: "#aa8c2c", accentLight: "#f4d47a", accentRgb: "212, 175, 55" },
    { id: "emerald", label: "Emerald Table", accent: "#2ea36e", accentDark: "#1f7a52", accentLight: "#6fd9a3", accentRgb: "46, 163, 110" },
    { id: "sapphire", label: "Sapphire", accent: "#4a90d9", accentDark: "#2f6aa8", accentLight: "#8ec4f0", accentRgb: "74, 144, 217" },
    { id: "ruby", label: "Ruby", accent: "#d94a4a", accentDark: "#a83636", accentLight: "#f08e8e", accentRgb: "217, 74, 74" },
];

function applyTheme(theme: ColorTheme) {
    const root = document.documentElement.style;
    root.setProperty("--bf-accent", theme.accent);
    root.setProperty("--bf-accent-dark", theme.accentDark);
    root.setProperty("--bf-accent-light", theme.accentLight);
    root.setProperty("--bf-accent-rgb", theme.accentRgb);
}

// Downscales a picked image client-side before storing, so it doesn't blow
// past localStorage's ~5MB quota.
function downscaleImage(file: File, maxWidth = 1600): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Canvas not supported"));
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export const Settings: React.FC<SettingsProps> = ({ onClose, onLogoutEverywhere }) => {
    const [themeId, setThemeId] = useState(localStorage.getItem("bf_theme") || "gold");
    const [reduceGlow, setReduceGlow] = useState(localStorage.getItem("bf_reduce_glow") === "1");
    const [hasCustomBg, setHasCustomBg] = useState(!!localStorage.getItem("bf_custom_bg"));
    const [bgUploading, setBgUploading] = useState(false);
    const [bgError, setBgError] = useState("");
    const bgInputRef = useRef<HTMLInputElement>(null);

    const selectTheme = (theme: ColorTheme) => {
        setThemeId(theme.id);
        localStorage.setItem("bf_theme", theme.id);
        applyTheme(theme);
    };

    const applyReduceGlow = (value: boolean) => {
        setReduceGlow(value);
        localStorage.setItem("bf_reduce_glow", value ? "1" : "0");
        document.body.classList.toggle("bf-reduce-glow", value);
    };

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBgUploading(true);
        setBgError("");
        try {
            const dataUrl = await downscaleImage(file);
            localStorage.setItem("bf_custom_bg", dataUrl);
            document.documentElement.style.setProperty("--bf-custom-bg-image", `url(${dataUrl})`);
            document.body.classList.add("bf-has-custom-bg");
            setHasCustomBg(true);
        } catch {
            setBgError("Couldn't process that image — try a smaller file.");
        } finally {
            setBgUploading(false);
        }
    };

    const removeCustomBg = () => {
        localStorage.removeItem("bf_custom_bg");
        document.body.classList.remove("bf-has-custom-bg");
        setHasCustomBg(false);
    };

    return (
        <div style={styles.overlay} className="bf-modal-overlay">
            <div style={styles.card} className="bf-modal-card bf-glow-card">
                <div style={styles.header}>
                    <h2 style={styles.title} className="bf-serif">Settings</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <div style={styles.section}>
                    <label style={styles.label}>Site Color Theme</label>
                    <p style={styles.hint}>Changes the accent color across the whole app — buttons, borders, glows, everything.</p>
                    <div style={styles.swatchGrid}>
                        {THEMES.map((theme) => (
                            <button
                                key={theme.id}
                                type="button"
                                onClick={() => selectTheme(theme)}
                                style={{
                                    ...styles.swatchBtn,
                                    background: `linear-gradient(135deg, ${theme.accentLight}, ${theme.accent})`,
                                    border: themeId === theme.id ? "2px solid #fff" : "2px solid transparent",
                                }}
                            >
                                <span style={styles.swatchLabel}>{theme.label}</span>
                                {themeId === theme.id && <span style={styles.checkMark}>✓</span>}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={styles.section}>
                    <label style={styles.label}>Custom Background Image</label>
                    <p style={styles.hint}>Pick your own image for the page backdrop, dimmed behind your dashboard.</p>
                    {bgError && <p style={styles.errorText}>{bgError}</p>}
                    <div style={styles.btnRow}>
                        <button type="button" onClick={() => bgInputRef.current?.click()} style={styles.outlineBtn} className="bf-outline-btn" disabled={bgUploading}>
                            {bgUploading ? "Processing..." : hasCustomBg ? "Change Image" : "Upload Image"}
                        </button>
                        {hasCustomBg && (
                            <button type="button" onClick={removeCustomBg} style={styles.outlineBtn} className="bf-outline-btn">
                                Remove
                            </button>
                        )}
                    </div>
                    <input type="file" ref={bgInputRef} onChange={handleBgUpload} style={{ display: "none" }} accept="image/*" />
                </div>

                <div style={styles.section}>
                    <div style={styles.toggleRow}>
                        <div>
                            <label style={styles.label}>Reduce Glow Effects</label>
                            <p style={styles.hint}>Flattens shadows and glow for lower-end devices or a calmer look.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => applyReduceGlow(!reduceGlow)}
                            style={{ ...styles.switchTrack, background: reduceGlow ? "var(--bf-accent)" : "#333" }}
                        >
                            <span style={{ ...styles.switchThumb, transform: reduceGlow ? "translateX(18px)" : "translateX(0)" }} />
                        </button>
                    </div>
                </div>

                <div style={styles.section}>
                    <label style={styles.label}>Account</label>
                    <button type="button" onClick={onLogoutEverywhere} style={styles.dangerBtn} className="bf-outline-btn">
                        Log Out Of All Devices
                    </button>
                    <p style={styles.hint}>Revokes every active session, including this one.</p>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(5, 5, 5, 0.85)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000,
    },
    card: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.3)", borderRadius: "16px",
        width: "100%", maxWidth: "460px", maxHeight: "92vh", overflowY: "auto",
        color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif",
    },
    header: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 24px 10px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    title: { margin: 0, fontSize: "22px", fontWeight: 600, color: "#fff" },
    closeBtn: { background: "transparent", border: "none", color: "#888", fontSize: "28px", cursor: "pointer", padding: 0 },
    section: { padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
    label: { fontSize: "13px", fontWeight: 600, color: "var(--bf-accent)", letterSpacing: "0.3px", display: "block", marginBottom: "6px" },
    hint: { fontSize: "12px", color: "#777", margin: "0 0 12px 0" },
    errorText: { fontSize: "12px", color: "#e0847e", margin: "0 0 10px 0" },
    swatchGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
    swatchBtn: {
        position: "relative", height: "56px", borderRadius: "10px", cursor: "pointer",
        display: "flex", alignItems: "flex-end", padding: "8px", overflow: "hidden",
    },
    swatchLabel: { fontSize: "11px", fontWeight: 700, color: "#000", textShadow: "0 1px 2px rgba(255,255,255,0.3)" },
    checkMark: { position: "absolute", top: "6px", right: "8px", color: "#000", fontWeight: 900 },
    btnRow: { display: "flex", gap: "10px" },
    outlineBtn: { flex: 1, background: "transparent", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)", borderRadius: "8px", padding: "10px", fontWeight: 600, cursor: "pointer" },
    toggleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" },
    switchTrack: { width: "42px", height: "24px", borderRadius: "999px", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, padding: "3px" },
    switchThumb: { display: "block", width: "18px", height: "18px", borderRadius: "50%", background: "#0a0a0a", transition: "transform 0.15s ease" },
    dangerBtn: { width: "100%", background: "transparent", border: "1px solid #a55", color: "#e0847e", borderRadius: "8px", padding: "10px", fontWeight: 600, cursor: "pointer" },
};
