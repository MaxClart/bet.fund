import React, { useState, useRef } from "react";
import { CropModal, Transform } from "./CropModal";

interface ProfileEditProps {
    user: {
        id: string;
        username: string;
        display_name?: string;
        bio?: string;
        status?: string;
        avatar_url?: string;
        banner_url?: string;
        avatar_transform?: string | Transform;
        banner_transform?: string | Transform;
        is_elite?: number;
        wallet_address?: string;
        trading_platforms?: string | string[];
    };
    token: string;
    onClose: () => void;
    onUpdate: (updatedUser: any) => void;
}

const TRADING_PLATFORMS = [
    "Photon", "BullX", "gmgn.ai", "Trojan", "DEX Screener",
    "Birdeye", "DEXTools", "Axiom", "GeckoTerminal", "pump.fun",
];

function parsePlatforms(p: string | string[] | undefined): string[] {
    if (!p) return [];
    if (Array.isArray(p)) return p;
    try { return JSON.parse(p); } catch { return []; }
}

function parseTransform(t: string | Transform | undefined): Transform {
    if (!t) return { zoom: 1, x: 0, y: 0 };
    if (typeof t === "string") {
        try { return JSON.parse(t); } catch { return { zoom: 1, x: 0, y: 0 }; }
    }
    return t;
}

// Static, non-interactive preview — cropping happens in the CropModal instead
function StaticPreview({ url, transform, shape, size }: { url: string; transform: Transform; shape: "circle" | "rect"; size: { w: number | string; h: number } }) {
    return (
        <div
            style={{
                width: size.w, height: size.h,
                borderRadius: shape === "circle" ? "50%" : "10px",
                overflow: "hidden", position: "relative", background: "#0a0a0a",
                border: shape === "circle" ? "2px solid var(--bf-accent)" : "1px solid #333",
            }}
        >
            {url ? (
                <img
                    src={url}
                    alt=""
                    style={{
                        position: "absolute", top: "50%", left: "50%",
                        minWidth: "100%", minHeight: "100%",
                        width: shape === "circle" ? "auto" : "100%",
                        height: shape === "circle" ? "100%" : "auto",
                        objectFit: "cover",
                        transform: `translate(-50%, -50%) translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
                    }}
                />
            ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: "12px" }}>
                    No image yet
                </div>
            )}
        </div>
    );
}

export const ProfileEdit: React.FC<ProfileEditProps> = ({ user, token, onClose, onUpdate }) => {
    const [displayName, setDisplayName] = useState(user.display_name || user.username || "");
    const [bio, setBio] = useState(user.bio || "");
    const [status, setStatus] = useState(user.status || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(user.banner_url || "");
    const [avatarTransform, setAvatarTransform] = useState<Transform>(parseTransform(user.avatar_transform));
    const [bannerTransform, setBannerTransform] = useState<Transform>(parseTransform(user.banner_transform));
    const [isElite, setIsElite] = useState(!!user.is_elite);
    const [walletAddress, setWalletAddress] = useState(user.wallet_address || "");
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(parsePlatforms(user.trading_platforms));

    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [error, setError] = useState("");

    // { type, localUrl, file? } — file present means it's a fresh pick not yet uploaded
    const [cropTarget, setCropTarget] = useState<{ type: "avatar" | "banner"; localUrl: string; file?: File } | null>(null);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

    const togglePlatform = (name: string) => {
        setSelectedPlatforms((prev) =>
            prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
        );
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCropTarget({ type, localUrl: URL.createObjectURL(file), file });
        e.target.value = "";
    };

    const openReposition = (type: "avatar" | "banner") => {
        const url = type === "avatar" ? avatarUrl : bannerUrl;
        if (!url) return;
        setCropTarget({ type, localUrl: url });
    };

    const handleCropApply = async (transform: Transform) => {
        if (!cropTarget) return;
        const { type, file } = cropTarget;

        if (file) {
            const setUploading = type === "avatar" ? setUploadingAvatar : setUploadingBanner;
            setUploading(true);
            setError("");

            const formData = new FormData();
            formData.append("file", file);
            formData.append("type", type);

            try {
                const res = await fetch("/api/user/upload", {
                    method: "POST",
                    headers: authHeaders(),
                    credentials: "include",
                    body: formData,
                });
                const data = (await res.json()) as any;
                if (res.ok && data.url) {
                    if (type === "avatar") { setAvatarUrl(data.url); setAvatarTransform(transform); }
                    else { setBannerUrl(data.url); setBannerTransform(transform); }
                } else {
                    setError(data.error || "Upload failed");
                }
            } catch (err: any) {
                setError(err.message || "Upload error");
            } finally {
                setUploading(false);
            }
        } else {
            // Just repositioning an already-uploaded image
            if (type === "avatar") setAvatarTransform(transform);
            else setBannerTransform(transform);
        }

        setCropTarget(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ displayName, status, bio, avatarTransform, bannerTransform, walletAddress, tradingPlatforms: selectedPlatforms }),
            });

            if (res.ok) {
                onUpdate({
                    ...user,
                    display_name: displayName,
                    bio,
                    status,
                    avatar_url: avatarUrl,
                    banner_url: bannerUrl,
                    avatar_transform: avatarTransform,
                    banner_transform: bannerTransform,
                    wallet_address: walletAddress,
                    trading_platforms: selectedPlatforms,
                });
                onClose();
            } else {
                const data = (await res.json()) as any;
                setError(data.error || "Failed to update profile");
            }
        } catch (err: any) {
            setError(err.message || "Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay} className="bf-modal-overlay">
            <div style={styles.modal} className="bf-modal-card bf-glow-card">
                <div style={styles.header}>
                    <h2 style={styles.title} className="bf-serif">Edit Profile</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                {error && <div style={styles.errorBanner}>{error}</div>}

                <form onSubmit={handleSave} style={styles.form}>
                    <div style={styles.topRow} className="bf-top-row">
                        {/* Left: text fields */}
                        <div style={styles.leftCol}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Display Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    style={styles.input}
                                    className="bf-input"
                                    placeholder="ysk"
                                />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Username</label>
                                <input type="text" value={`@${user.username}`} disabled style={{ ...styles.input, color: "#777", cursor: "not-allowed" }} />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>Bio</label>
                                <span style={styles.hint}>Modify your bio los in the name.</span>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    style={{ ...styles.input, height: "110px", resize: "none" }}
                                    placeholder="Write a brief bio..."
                                />
                            </div>
                        </div>

                        {/* Right: avatar + elite badge */}
                        <div style={styles.rightCol} className="bf-right-col">
                            <div style={styles.avatarWrap}>
                                <StaticPreview url={avatarUrl} transform={avatarTransform} shape="circle" size={{ w: 140, h: 140 }} />
                                {isElite && <div style={styles.eliteBadge}>✦ ELITE</div>}
                            </div>

                            <div style={styles.btnRow}>
                                <button type="button" onClick={() => avatarInputRef.current?.click()} style={styles.customUploadBtn} className="bf-outline-btn" disabled={uploadingAvatar}>
                                    {uploadingAvatar ? "Uploading..." : "Change"}
                                </button>
                                {avatarUrl && (
                                    <button type="button" onClick={() => openReposition("avatar")} style={styles.customUploadBtn} className="bf-outline-btn">
                                        Reposition
                                    </button>
                                )}
                            </div>
                            <input type="file" ref={avatarInputRef} onChange={(e) => handleFileSelect(e, "avatar")} style={{ display: "none" }} accept="image/*" />

                            {!isElite && (
                                <button type="button" onClick={() => setIsElite(true)} style={styles.restoreBtn} className="bf-outline-btn">
                                    Restore Elite Badge
                                </button>
                            )}
                            <p style={styles.badgeHint}>Restore 'Elite Badge' as previously configured.</p>
                        </div>
                    </div>

                    {/* Banner */}
                    <div style={styles.sectionBlock}>
                        <label style={styles.label}>Banner</label>
                        <StaticPreview url={bannerUrl} transform={bannerTransform} shape="rect" size={{ w: "100%", h: 140 }} />
                        <div style={styles.btnRow}>
                            <button type="button" onClick={() => bannerInputRef.current?.click()} style={styles.customUploadBtn} className="bf-outline-btn" disabled={uploadingBanner}>
                                {uploadingBanner ? "Uploading..." : "Change Banner"}
                            </button>
                            {bannerUrl && (
                                <button type="button" onClick={() => openReposition("banner")} style={styles.customUploadBtn} className="bf-outline-btn">
                                    Reposition
                                </button>
                            )}
                        </div>
                        <input type="file" ref={bannerInputRef} onChange={(e) => handleFileSelect(e, "banner")} style={{ display: "none" }} accept="image/*" />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Custom Status</label>
                        <input
                            type="text"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={styles.input}
                                    className="bf-input"
                            placeholder="What's your current status?"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Solana Wallet Address</label>
                        <span style={styles.hint}>Shows a live balance snapshot on your profile. Optional — leave blank to hide it.</span>
                        <input
                            type="text"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            style={styles.input}
                            className="bf-input"
                            placeholder="e.g. 7xKX...4Fq9"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Trading Platforms You Use</label>
                        <span style={styles.hint}>Shown as badges on your profile.</span>
                        <div style={styles.platformGrid}>
                            {TRADING_PLATFORMS.map((platform) => {
                                const active = selectedPlatforms.includes(platform);
                                return (
                                    <button
                                        key={platform}
                                        type="button"
                                        onClick={() => togglePlatform(platform)}
                                        style={{
                                            ...styles.platformChip,
                                            ...(active ? styles.platformChipActive : {}),
                                        }}
                                    >
                                        {platform}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button type="submit" disabled={loading} style={styles.saveBtn} className="bf-gold-btn">
                        {loading ? "Saving Changes..." : "Save Changes"}
                    </button>
                </form>
            </div>

            {cropTarget && (
                <CropModal
                    imageUrl={cropTarget.localUrl}
                    shape={cropTarget.type === "avatar" ? "circle" : "rect"}
                    initialTransform={cropTarget.type === "avatar" ? avatarTransform : bannerTransform}
                    onCancel={() => setCropTarget(null)}
                    onApply={handleCropApply}
                />
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(5, 5, 5, 0.85)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000,
    },
    modal: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.3)", borderRadius: "16px",
        width: "100%", maxWidth: "640px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.9), 0 0 25px rgba(var(--bf-accent-rgb), 0.08)",
        color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif",
    },
    header: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 24px 10px 24px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    title: { margin: 0, fontSize: "22px", fontWeight: 600, color: "#fff", letterSpacing: "0.3px" },
    closeBtn: { background: "transparent", border: "none", color: "#888", fontSize: "28px", cursor: "pointer", padding: 0 },
    errorBanner: {
        margin: "16px 24px 0 24px", backgroundColor: "rgba(220, 53, 69, 0.15)",
        border: "1px solid rgba(220, 53, 69, 0.4)", color: "#ff6b6b",
        padding: "10px 14px", borderRadius: "8px", fontSize: "13px",
    },
    form: { padding: "20px 24px 24px 24px", display: "flex", flexDirection: "column", gap: "22px" },
    topRow: { display: "flex", gap: "24px", flexWrap: "wrap" },
    leftCol: { flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "16px", minWidth: "220px" },
    rightCol: { flex: "0 0 160px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" },
    avatarWrap: { position: "relative" },
    eliteBadge: {
        position: "absolute", top: "-6px", right: "-10px",
        background: "linear-gradient(135deg, var(--bf-accent-light), var(--bf-accent))",
        color: "#1a1400", fontSize: "11px", fontWeight: 800,
        padding: "4px 10px", borderRadius: "999px", border: "2px solid #121212",
        letterSpacing: "0.3px", boxShadow: "0 2px 8px rgba(0,0,0,0.6)", whiteSpace: "nowrap",
    },
    btnRow: { display: "flex", gap: "6px", width: "100%" },
    customUploadBtn: {
        flex: 1, background: "rgba(0, 0, 0, 0.8)", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)",
        padding: "8px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
        cursor: "pointer",
    },
    restoreBtn: {
        background: "transparent", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)",
        padding: "10px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
        cursor: "pointer", width: "100%",
    },
    badgeHint: { fontSize: "11px", color: "#777", textAlign: "center", margin: 0 },
    sectionBlock: { display: "flex", flexDirection: "column", gap: "8px" },
    label: { fontSize: "13px", fontWeight: 600, color: "var(--bf-accent)", letterSpacing: "0.3px" },
    hint: { fontSize: "11px", color: "#777", marginTop: "-4px" },
    inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
    input: {
        backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px",
        padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none",
    },
    platformGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
    platformChip: {
        background: "#0a0a0a", border: "1px solid #333", color: "#999",
        borderRadius: "999px", padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
    },
    platformChipActive: {
        background: "rgba(var(--bf-accent-rgb), 0.14)", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)",
    },
    saveBtn: {
        background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)", color: "#0a0a0a",
        border: "none", borderRadius: "8px", padding: "14px", fontSize: "15px", fontWeight: 700,
        cursor: "pointer", marginTop: "4px", boxShadow: "0 4px 15px rgba(var(--bf-accent-rgb), 0.3)",
    },
};
