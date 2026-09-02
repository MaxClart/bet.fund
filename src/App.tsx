import React, { useState, useEffect } from "react";
import { AuthModal } from "./components/AuthModal";
import { ProfileEdit } from "./components/ProfileEdit";
import { ProfileView } from "./components/ProfileView";
import { StoriesAndFriends } from "./components/StoryAndFriends";
import { Messages } from "./components/Messages";
import { Sidebar } from "./components/Sidebar";
import { Settings } from "./components/Settings";

const UNREAD_POLL_MS = 10000;

export default function App() {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string>(localStorage.getItem("bet_fund_token") || "");
    const [checkingSession, setCheckingSession] = useState(true);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [activeConversation, setActiveConversation] = useState<any>(null);
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<"dashboard" | "friends">("dashboard");
    const [unreadTotal, setUnreadTotal] = useState(0);

    const authHeaders = (): Record<string, string> =>
        token ? { Authorization: `Bearer ${token}` } : {};

    // Apply saved theme preferences on load
    useEffect(() => {
        const THEME_VARS: Record<string, { accent: string; accentDark: string; accentLight: string; accentRgb: string }> = {
            gold: { accent: "#d4af37", accentDark: "#aa8c2c", accentLight: "#f4d47a", accentRgb: "212, 175, 55" },
            emerald: { accent: "#2ea36e", accentDark: "#1f7a52", accentLight: "#6fd9a3", accentRgb: "46, 163, 110" },
            sapphire: { accent: "#4a90d9", accentDark: "#2f6aa8", accentLight: "#8ec4f0", accentRgb: "74, 144, 217" },
            ruby: { accent: "#d94a4a", accentDark: "#a83636", accentLight: "#f08e8e", accentRgb: "217, 74, 74" },
        };
        const themeId = localStorage.getItem("bf_theme") || "gold";
        const theme = THEME_VARS[themeId] || THEME_VARS.gold;
        const root = document.documentElement.style;
        root.setProperty("--bf-accent", theme.accent);
        root.setProperty("--bf-accent-dark", theme.accentDark);
        root.setProperty("--bf-accent-light", theme.accentLight);
        root.setProperty("--bf-accent-rgb", theme.accentRgb);

        if (localStorage.getItem("bf_reduce_glow") === "1") {
            document.body.classList.add("bf-reduce-glow");
        }

        const customBg = localStorage.getItem("bf_custom_bg");
        if (customBg) {
            document.documentElement.style.setProperty("--bf-custom-bg-image", `url(${customBg})`);
            document.body.classList.add("bf-has-custom-bg");
        }
    }, []);

    useEffect(() => {
        fetch("/api/auth/me", { headers: authHeaders(), credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: any) => {
                if (data?.user) setUser(data.user);
            })
            .catch(() => {})
            .finally(() => setCheckingSession(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll unread message counts for the sidebar badge
    useEffect(() => {
        if (!user) return;
        const poll = () => {
            fetch("/api/messages", { headers: authHeaders(), credentials: "include" })
                .then((res) => (res.ok ? res.json() : null))
                .then((data: any) => {
                    if (data?.unread) {
                        const total = data.unread.reduce((sum: number, row: any) => sum + (row.unread || 0), 0);
                        setUnreadTotal(total);
                    }
                })
                .catch(() => {});
        };
        poll();
        const interval = setInterval(poll, UNREAD_POLL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, token]);

    const handleAuthSuccess = (loggedInUser: any, sessionToken: string) => {
        setUser(loggedInUser);
        setToken(sessionToken);
        localStorage.setItem("bet_fund_token", sessionToken);
    };

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST", headers: authHeaders(), credentials: "include" }).catch(() => {});
        setUser(null);
        setToken("");
        localStorage.removeItem("bet_fund_token");
    };

    const handleLogoutEverywhere = async () => {
        await fetch("/api/auth/logout-all", { method: "POST", headers: authHeaders(), credentials: "include" }).catch(() => {});
        setUser(null);
        setToken("");
        localStorage.removeItem("bet_fund_token");
        setIsSettingsOpen(false);
    };

    if (checkingSession) {
        return <div style={styles.loadingScreen}>Loading...</div>;
    }

    if (!user) {
        return (
            <div style={{ backgroundColor: "#060606", minHeight: "100vh" }}>
                <AuthModal isOpen={true} onClose={() => {}} onSuccess={handleAuthSuccess} />
            </div>
        );
    }

    return (
        <div className="bf-app-shell" style={{ color: "#fff" }}>
            <Sidebar
                activeView={activeView}
                onNavigate={setActiveView}
                onOpenProfile={() => setViewingProfileId(user.id)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onLogout={handleLogout}
                avatarUrl={user.avatar_url}
                unreadCount={unreadTotal}
            />

            <div className="bf-main-content">
                <div style={styles.glowBackdrop} />

                <div style={styles.header} className="bf-header">
                    <div>
                        <h1 style={styles.pageTitle} className="bf-serif">
                            {activeView === "dashboard" ? "Elite Dashboard" : "Friends & Connections"}
                        </h1>
                        <p style={styles.pageSubtitle}>Welcome back, {user.display_name || user.username}.</p>
                    </div>
                    <button onClick={() => setIsEditingProfile(true)} style={styles.editBtn} className="bf-gold-btn">
                        Edit Profile
                    </button>
                </div>

                <StoriesAndFriends
                    token={token}
                    currentUserId={user.id}
                    onOpenConversation={(friend: any) => setActiveConversation(friend)}
                    onOpenProfile={(userId: string) => setViewingProfileId(userId)}
                />
            </div>

            {activeConversation && (
                <Messages
                    token={token}
                    currentUserId={user.id}
                    friend={activeConversation}
                    onClose={() => setActiveConversation(null)}
                />
            )}

            {isEditingProfile && (
                <ProfileEdit
                    user={user}
                    token={token}
                    onClose={() => setIsEditingProfile(false)}
                    onUpdate={(updated: any) => setUser({ ...user, ...updated })}
                />
            )}

            {viewingProfileId && (
                <ProfileView
                    token={token}
                    userId={viewingProfileId}
                    currentUserId={user.id}
                    onClose={() => setViewingProfileId(null)}
                    onOpenConversation={(friend: any) => { setViewingProfileId(null); setActiveConversation(friend); }}
                    onEditOwnProfile={() => { setViewingProfileId(null); setIsEditingProfile(true); }}
                />
            )}

            {isSettingsOpen && (
                <Settings
                    onClose={() => setIsSettingsOpen(false)}
                    onLogoutEverywhere={handleLogoutEverywhere}
                />
            )}
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    loadingScreen: { color: "#888", padding: "40px", textAlign: "center", background: "#060606", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" },
    glowBackdrop: {
        position: "fixed",
        top: "-200px",
        right: "-150px",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(var(--bf-accent-rgb),0.08) 0%, rgba(var(--bf-accent-rgb),0) 70%)",
        pointerEvents: "none",
        zIndex: 0,
    },
    header: { position: "relative", zIndex: 1 },
    pageTitle: { margin: "0 0 4px 0", fontSize: "30px", fontWeight: 700, letterSpacing: "0.3px", color: "#f5f5f5" },
    pageSubtitle: { margin: 0, fontSize: "13px", color: "#888" },
    editBtn: {
        background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)", color: "#0a0a0a",
        border: "none", padding: "12px 24px", borderRadius: "10px", fontWeight: 700,
        fontSize: "14px", cursor: "pointer", boxShadow: "0 6px 18px rgba(var(--bf-accent-rgb), 0.25)",
    },
};
