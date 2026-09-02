import React from "react";
import { IconHome, IconUser, IconUsers, IconSettings, IconLogout } from "./Icons";

interface SidebarProps {
    activeView: "dashboard" | "friends";
    onNavigate: (view: "dashboard" | "friends") => void;
    onOpenProfile: () => void;
    onOpenSettings: () => void;
    onLogout: () => void;
    avatarUrl?: string;
    unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, onOpenProfile, onOpenSettings, onLogout, avatarUrl, unreadCount = 0 }) => {
    return (
        <nav className="bf-sidebar">
            <div style={styles.logoWrap} className="bf-serif">✦</div>

            <div style={styles.divider} />

            <div
                className={`bf-sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
                onClick={() => onNavigate("dashboard")}
                title="Home"
            >
                <IconHome size={20} />
            </div>

            <div
                className={`bf-sidebar-item ${activeView === "friends" ? "active" : ""}`}
                onClick={() => onNavigate("friends")}
                title="Friends"
                style={{ position: "relative" }}
            >
                <IconUsers size={20} />
                {unreadCount > 0 && (
                    <span style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
            </div>

            <div className="bf-sidebar-item" onClick={onOpenProfile} title="My Profile">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" style={styles.avatarIcon} />
                ) : (
                    <IconUser size={20} />
                )}
            </div>

            <div style={{ flex: 1 }} />

            <div className="bf-sidebar-item" onClick={onOpenSettings} title="Settings">
                <IconSettings size={20} />
            </div>

            <div className="bf-sidebar-item" onClick={onLogout} title="Log out" style={{ color: "#c96b6b" }}>
                <IconLogout size={20} />
            </div>
        </nav>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    logoWrap: {
        width: "46px",
        height: "46px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(var(--bf-accent-rgb), 0.4)",
        color: "#0a0a0a",
        fontSize: "22px",
        fontWeight: 900,
        marginBottom: "4px",
        flexShrink: 0,
    },
    divider: { width: "32px", height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "4px", flexShrink: 0 },
    avatarIcon: { width: "100%", height: "100%", borderRadius: "16px", objectFit: "cover" },
    badge: {
        position: "absolute", top: "-4px", right: "-4px",
        background: "#e0453f", color: "#fff", fontSize: "10px", fontWeight: 700,
        minWidth: "17px", height: "17px", borderRadius: "999px",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 3px", border: "2px solid #0d0d0d",
    },
};
