import React, { useState } from "react";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (user: any) => void;
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
                body: JSON.stringify({ username, password })
            });

            const data = (await res.json()) as any;

            if (!res.ok) {
                throw new Error(data.error || "Authentication failed.");
            }

            localStorage.setItem("bet_fund_token", data.token);
            onSuccess(data.user);
            onClose();
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
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
                            placeholder="Enter your username"
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
                            placeholder="Enter your password"
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.submitBtn}>
                        {loading ? "Processing..." : isLogin ? "Sign In" : "Register"}
                    </button>
                </form>

                <div style={styles.switchContainer}>
                    <span style={styles.switchText}>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
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
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(5, 5, 5, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        pointerEvents: "auto",
    },
    modal: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(212, 175, 55, 0.2)",
        borderRadius: "16px",
        padding: "32px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.05)",
        color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        pointerEvents: "auto",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
    },
    title: {
        margin: 0,
        fontSize: "24px",
        fontWeight: 600,
        color: "#d4af37", // Gold luxury accent
        letterSpacing: "0.5px",
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#888",
        fontSize: "28px",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
    },
    errorBanner: {
        backgroundColor: "rgba(220, 53, 69, 0.15)",
        border: "1px solid rgba(220, 53, 69, 0.4)",
        color: "#ff6b6b",
        padding: "10px 14px",
        borderRadius: "8px",
        fontSize: "14px",
        marginBottom: "20px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "18px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#bbb",
        letterSpacing: "0.3px",
    },
    input: {
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "12px 14px",
        color: "#fff",
        fontSize: "15px",
        outline: "none",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    },
    submitBtn: {
        background: "linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "16px",
        fontWeight: 600,
        cursor: "pointer",
        marginTop: "8px",
        transition: "opacity 0.2s ease",
    },
    switchContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "6px",
        marginTop: "24px",
        fontSize: "14px",
    },
    switchText: {
        color: "#888",
    },
    switchBtn: {
        background: "transparent",
        border: "none",
        color: "#d4af37",
        fontWeight: 600,
        cursor: "pointer",
        padding: 0,
        textDecoration: "underline",
    },
};