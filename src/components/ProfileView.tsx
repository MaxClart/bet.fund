import React, { useState, useEffect } from "react";

interface Transform { zoom: number; x: number; y: number; }

interface ProfileViewProps {
    token: string;
    userId: string;
    currentUserId: string;
    onClose: () => void;
    onOpenConversation: (friend: any) => void;
    onEditOwnProfile: () => void;
}

function parseTransform(t: string | Transform | undefined): Transform {
    if (!t) return { zoom: 1, x: 0, y: 0 };
    if (typeof t === "string") {
        try { return JSON.parse(t); } catch { return { zoom: 1, x: 0, y: 0 }; }
    }
    return t;
}

function parsePlatforms(p: string | string[] | undefined): string[] {
    if (!p) return [];
    if (Array.isArray(p)) return p;
    try { return JSON.parse(p); } catch { return []; }
}

export const ProfileView: React.FC<ProfileViewProps> = ({ token, userId, currentUserId, onClose, onOpenConversation, onEditOwnProfile }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [followBusy, setFollowBusy] = useState(false);
    const [requestSent, setRequestSent] = useState(false);

    const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/users/${userId}`, { headers: authHeaders(), credentials: "include" });
            const json = (await res.json()) as any;
            if (res.ok) setData(json);
            else setError(json.error || "Could not load profile");
        } catch (err: any) {
            setError(err.message || "Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const toggleFollow = async () => {
        if (!data) return;
        setFollowBusy(true);
        try {
            const endpoint = data.isFollowing ? "/api/unfollow" : "/api/follow";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ targetUserId: userId }),
            });
            if (res.ok) load();
        } finally {
            setFollowBusy(false);
        }
    };

    const sendFriendRequest = async () => {
        try {
            const res = await fetch("/api/friends/request", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ targetUserId: userId }),
            });
            if (res.ok) setRequestSent(true);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div style={styles.overlay} className="bf-modal-overlay">
                <div style={{ ...styles.card, ...styles.loadingCard }} className="bf-modal-card">Loading profile...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={styles.overlay} className="bf-modal-overlay">
                <div style={{ ...styles.card, ...styles.loadingCard }} className="bf-modal-card">
                    <p>{error || "Profile not found"}</p>
                    <button onClick={onClose} style={styles.closeTextBtn}>Close</button>
                </div>
            </div>
        );
    }

    const { user, isSelf, isFriend, isFollowing, followerCount, followingCount, stories, wallet } = data;
    const avatarT = parseTransform(user.avatar_transform);
    const bannerT = parseTransform(user.banner_transform);

    return (
        <div style={styles.overlay} className="bf-modal-overlay">
            <div style={styles.card} className="bf-modal-card bf-glow-card">
                <button onClick={onClose} style={styles.closeBtn}>&times;</button>

                <div style={styles.bannerWrap}>
                    {user.banner_url ? (
                        <img
                            src={user.banner_url}
                            alt=""
                            style={{
                                width: "100%", height: "100%", objectFit: "cover",
                                transform: `translate(${bannerT.x}%, ${bannerT.y}%) scale(${bannerT.zoom})`,
                            }}
                        />
                    ) : (
                        <div style={styles.bannerFallback} />
                    )}
                </div>

                <div style={styles.avatarRow}>
                    <div style={styles.avatarWrap}>
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt=""
                                style={{
                                    width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%",
                                    transform: `translate(${avatarT.x}%, ${avatarT.y}%) scale(${avatarT.zoom})`,
                                }}
                            />
                        ) : (
                            <div style={styles.avatarFallback}>{(user.display_name || user.username || "?")[0].toUpperCase()}</div>
                        )}
                        {!!user.is_elite && <div style={styles.eliteBadge}>✦ ELITE</div>}
                    </div>

                    <div style={styles.actionsRow}>
                        {isSelf ? (
                            <button onClick={onEditOwnProfile} style={styles.primaryBtn} className="bf-gold-btn">Edit Profile</button>
                        ) : (
                            <>
                                <button onClick={toggleFollow} disabled={followBusy} style={isFollowing ? styles.secondaryBtn : styles.primaryBtn} className={isFollowing ? "bf-outline-btn" : "bf-gold-btn"}>
                                    {isFollowing ? "Following" : "Follow"}
                                </button>
                                {isFriend ? (
                                    <button onClick={() => onOpenConversation({ id: user.id, username: user.username, display_name: user.display_name, avatar_url: user.avatar_url })} style={styles.secondaryBtn} className="bf-outline-btn">
                                        Message
                                    </button>
                                ) : (
                                    <button onClick={sendFriendRequest} disabled={requestSent} style={styles.secondaryBtn} className="bf-outline-btn">
                                        {requestSent ? "Request Sent" : "Add Friend"}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div style={styles.infoBlock}>
                    <h2 style={styles.name} className="bf-serif">{user.display_name || user.username}</h2>
                    <p style={styles.username}>@{user.username}</p>
                    {user.status && <p style={styles.status}>{user.status}</p>}
                    {user.bio && <p style={styles.bio}>{user.bio}</p>}

                    {parsePlatforms(user.trading_platforms).length > 0 && (
                        <div style={styles.platformRow}>
                            {parsePlatforms(user.trading_platforms).map((p: string) => (
                                <span key={p} style={styles.platformBadge}>{p}</span>
                            ))}
                        </div>
                    )}

                    <div style={styles.statsRow}>
                        <span><strong>{followerCount}</strong> Followers</span>
                        <span><strong>{followingCount}</strong> Following</span>
                    </div>
                </div>

                {user.wallet_address && (
                    <div style={styles.walletCard}>
                        <div style={styles.walletHeader}>
                            <span style={styles.walletLabel}>Wallet Snapshot</span>
                            <a
                                href={`https://solscan.io/account/${user.wallet_address}`}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.walletAddressLink}
                            >
                                {user.wallet_address.slice(0, 4)}...{user.wallet_address.slice(-4)}
                            </a>
                        </div>
                        {wallet && !wallet.error ? (
                            <div style={styles.walletValueRow}>
                                <span style={styles.walletSol}>{wallet.solBalance.toFixed(3)} SOL</span>
                                {wallet.usdValue !== null && (
                                    <span style={styles.walletUsd}>≈ ${wallet.usdValue.toFixed(2)}</span>
                                )}
                            </div>
                        ) : (
                            <p style={styles.walletUnavailable}>{wallet?.error || "Balance unavailable right now."}</p>
                        )}
                        <p style={styles.walletDisclaimer}>Live balance, not a profit/loss tracker.</p>
                    </div>
                )}

                {stories && stories.length > 0 && (
                    <div style={styles.storiesSection}>
                        <h4 style={styles.storiesTitle}>Active Story{stories.length > 1 ? "ies" : ""}</h4>
                        <div style={styles.storiesTray}>
                            {stories.map((s: any) => (
                                <div key={s.id} style={styles.storyThumbWrap}>
                                    {s.media_type === "video" ? (
                                        <video src={s.media_url} style={styles.storyThumb} muted />
                                    ) : (
                                        <img src={s.media_url} alt="" style={styles.storyThumb} />
                                    )}
                                    <span style={styles.visibilityTag}>{s.visibility === "private" ? "Friends" : "Followers"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
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
        position: "relative",
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.3)", borderRadius: "16px",
        width: "100%", maxWidth: "480px", maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.9)",
        color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif",
    },
    loadingCard: { padding: "40px 24px", textAlign: "center", color: "#aaa" },
    closeBtn: {
        position: "absolute", top: "10px", right: "12px", zIndex: 5,
        background: "rgba(0,0,0,0.5)", border: "none", color: "#fff",
        fontSize: "24px", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer",
    },
    closeTextBtn: { background: "transparent", border: "1px solid #444", color: "#ccc", borderRadius: "8px", padding: "8px 16px", marginTop: "12px", cursor: "pointer" },
    bannerWrap: { width: "100%", height: "130px", overflow: "hidden", background: "#000", position: "relative" },
    bannerFallback: { width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a1a, #262010)" },
    avatarRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 20px", marginTop: "-44px", position: "relative" },
    avatarWrap: { position: "relative", width: "88px", height: "88px", borderRadius: "50%", border: "3px solid #121212", overflow: "visible", background: "#0a0a0a" },
    avatarFallback: { width: "100%", height: "100%", borderRadius: "50%", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 700, color: "var(--bf-accent)" },
    eliteBadge: {
        position: "absolute", bottom: "-4px", right: "-14px",
        background: "linear-gradient(135deg, var(--bf-accent-light), var(--bf-accent))", color: "#1a1400",
        fontSize: "9px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px",
        border: "2px solid #121212", whiteSpace: "nowrap",
    },
    actionsRow: { display: "flex", gap: "8px", paddingBottom: "8px" },
    primaryBtn: { background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)", color: "#0a0a0a", border: "none", borderRadius: "999px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
    secondaryBtn: { background: "transparent", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)", borderRadius: "999px", padding: "8px 18px", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
    infoBlock: { padding: "14px 20px 4px 20px" },
    name: { margin: "0 0 2px 0", fontSize: "20px", fontWeight: 700 },
    username: { margin: "0 0 10px 0", color: "#888", fontSize: "13px" },
    status: { margin: "0 0 8px 0", color: "var(--bf-accent)", fontSize: "13px", fontStyle: "italic" },
    bio: { margin: "0 0 14px 0", color: "#ccc", fontSize: "14px", lineHeight: 1.5 },
    platformRow: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" },
    platformBadge: {
        fontSize: "11px", fontWeight: 600, color: "var(--bf-accent)",
        background: "rgba(var(--bf-accent-rgb), 0.1)", border: "1px solid rgba(var(--bf-accent-rgb), 0.3)",
        borderRadius: "999px", padding: "4px 10px",
    },
    statsRow: { display: "flex", gap: "20px", fontSize: "13px", color: "#aaa", paddingBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
    walletCard: {
        margin: "0 20px 16px 20px", padding: "14px 16px", borderRadius: "12px",
        background: "rgba(var(--bf-accent-rgb), 0.06)", border: "1px solid rgba(var(--bf-accent-rgb), 0.25)",
    },
    walletHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
    walletLabel: { fontSize: "12px", fontWeight: 700, color: "var(--bf-accent)", letterSpacing: "0.3px" },
    walletAddressLink: { fontSize: "11px", color: "#888", textDecoration: "none" },
    walletValueRow: { display: "flex", alignItems: "baseline", gap: "10px" },
    walletSol: { fontSize: "20px", fontWeight: 700, color: "#fff" },
    walletUsd: { fontSize: "13px", color: "#aaa" },
    walletUnavailable: { fontSize: "12px", color: "#777", margin: 0 },
    walletDisclaimer: { fontSize: "10px", color: "#666", margin: "8px 0 0 0" },
    storiesSection: { padding: "16px 20px 24px 20px" },
    storiesTitle: { margin: "0 0 12px 0", fontSize: "13px", color: "var(--bf-accent)", fontWeight: 600 },
    storiesTray: { display: "flex", gap: "10px", overflowX: "auto" },
    storyThumbWrap: { position: "relative", flexShrink: 0, width: "80px", height: "120px", borderRadius: "10px", overflow: "hidden", border: "1px solid #333" },
    storyThumb: { width: "100%", height: "100%", objectFit: "cover" },
    visibilityTag: { position: "absolute", bottom: "4px", left: "4px", right: "4px", fontSize: "9px", textAlign: "center", background: "rgba(0,0,0,0.7)", color: "var(--bf-accent)", borderRadius: "4px", padding: "2px 0" },
};
