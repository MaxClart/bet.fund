import React, { useState } from "react";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            const data = (await res.json()) as any;

            if (!res.ok) {
                throw new Error(data.error || "Authentication failed.");
            }

            localStorage.setItem("bet_fund_token", data.token);
            onSuccess(data.user, data.token);
            onClose();
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.glowTop} />
            <div style={styles.glowBottom} />

            <div style={styles.card} className="bf-glow-card">
                <div style={styles.eliteBadge}>✦ ELITE MEMBERSHIP</div>
                <div style={styles.brand}>
                    <div style={styles.brandText} className="bf-serif">B E T . F U N D</div>
                </div>
                <p style={styles.tagline}>Authentication &amp; Studio Portal</p>

                <div style={styles.tabs}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(""); }}
                        style={{ ...styles.tab, ...(isLogin ? styles.tabActive : {}) }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(""); }}
                        style={{ ...styles.tab, ...(!isLogin ? styles.tabActive : {}) }}
                    >
                        Register
                    </button>
                </div>

                {error && <div style={styles.errorBanner}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={styles.input}
                            className="bf-input"
                            placeholder="e.g. ysk"
                            autoComplete="username"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={styles.input}
                            className="bf-input"
                            placeholder="••••••••"
                            autoComplete={isLogin ? "current-password" : "new-password"}
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.submitBtn} className="bf-gold-btn">
                        {loading ? "Processing..." : isLogin ? "Access Studio" : "Create Account"}
                    </button>
                </form>

                <div style={styles.switchContainer}>
                    <span style={styles.switchText}>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(""); }}
                        style={styles.switchBtn}
                    >
                        {isLogin ? "Register" : "Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(circle at 50% 0%, #1a1710 0%, #0a0a0a 55%)",
        overflow: "hidden",
        padding: "20px",
        boxSizing: "border-box",
    },
    glowTop: {
        position: "absolute",
        top: "-180px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "400px",
        background: "radial-gradient(circle, rgba(var(--bf-accent-rgb),0.18) 0%, rgba(var(--bf-accent-rgb),0) 70%)",
        pointerEvents: "none",
    },
    glowBottom: {
        position: "absolute",
        bottom: "-220px",
        right: "-100px",
        width: "500px",
        height: "500px",
        background: "radial-gradient(circle, rgba(var(--bf-accent-rgb),0.08) 0%, rgba(var(--bf-accent-rgb),0) 70%)",
        pointerEvents: "none",
    },
    card: {
        position: "relative",
        zIndex: 1,
        background: "linear-gradient(135deg, #14120c 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.25)",
        borderRadius: "20px",
        padding: "40px 36px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 30px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(var(--bf-accent-rgb), 0.06)",
        color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "4px",
    },
    eliteBadge: {
        display: "block",
        margin: "0 auto 16px auto",
        width: "fit-content",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.6)",
        borderRadius: "999px",
        padding: "5px 16px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "1px",
        color: "var(--bf-accent)",
        textAlign: "center",
    },
    brandText: {
        fontSize: "26px",
        fontWeight: 700,
        letterSpacing: "6px",
        background: "linear-gradient(135deg, var(--bf-accent-light), var(--bf-accent))",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
    },
    tagline: {
        textAlign: "center",
        color: "#888",
        fontSize: "13px",
        margin: "0 0 28px 0",
        letterSpacing: "0.3px",
    },
    tabs: {
        display: "flex",
        background: "#0a0a0a",
        border: "1px solid #2a2a2a",
        borderRadius: "10px",
        padding: "4px",
        marginBottom: "22px",
    },
    tab: {
        flex: 1,
        background: "transparent",
        border: "none",
        color: "#888",
        padding: "9px 0",
        borderRadius: "7px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
    },
    tabActive: {
        background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)",
        color: "#0a0a0a",
    },
    errorBanner: {
        backgroundColor: "rgba(220, 53, 69, 0.15)",
        border: "1px solid rgba(220, 53, 69, 0.4)",
        color: "#ff6b6b",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        marginBottom: "18px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    label: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#aaa",
        letterSpacing: "0.4px",
        textTransform: "uppercase",
    },
    input: {
        backgroundColor: "#0a0a0a",
        border: "1px solid #2f2f2f",
        borderRadius: "9px",
        padding: "12px 14px",
        color: "#fff",
        fontSize: "15px",
        outline: "none",
    },
    submitBtn: {
        background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "9px",
        padding: "14px",
        fontSize: "15px",
        fontWeight: 700,
        cursor: "pointer",
        marginTop: "4px",
        boxShadow: "0 6px 18px rgba(var(--bf-accent-rgb), 0.25)",
    },
    switchContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "6px",
        marginTop: "24px",
        fontSize: "13px",
    },
    switchText: {
        color: "#777",
    },
    switchBtn: {
        background: "transparent",
        border: "none",
        color: "var(--bf-accent)",
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
        fontSize: "13px",
    },
};
