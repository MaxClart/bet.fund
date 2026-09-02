import React, { useState, useEffect, useRef } from "react";

interface MessagesProps {
    token: string;
    currentUserId: string;
    friend: { id: string; username: string; display_name?: string; avatar_url?: string };
    onClose: () => void;
}

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
}

export const Messages: React.FC<MessagesProps> = ({ token, currentUserId, friend, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

    const fetchMessages = async () => {
        try {
            const res = await fetch(`/api/messages/${friend.id}`, { headers: authHeaders(), credentials: "include" });
            const data = (await res.json()) as any;
            if (res.ok) setMessages(data.messages || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 4000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friend.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setSending(true);
        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ receiverId: friend.id, content: draft.trim() }),
            });
            if (res.ok) {
                setDraft("");
                fetchMessages();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={styles.overlay} className="bf-messages-widget">
            <div style={styles.card} className="bf-glow-card">
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <img src={friend.avatar_url || "https://via.placeholder.com/36"} alt={friend.username} style={styles.avatar} />
                        <span style={styles.name}>{friend.display_name || friend.username}</span>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <div style={styles.thread}>
                    {messages.length === 0 && <p style={styles.emptyText}>Say hello to {friend.display_name || friend.username}.</p>}
                    {messages.map((m) => {
                        const mine = m.sender_id === currentUserId;
                        return (
                            <div key={m.id} style={{ ...styles.bubbleRow, justifyContent: mine ? "flex-end" : "flex-start" }}>
                                <div style={{ ...styles.bubble, ...(mine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                                    {m.content}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <form onSubmit={handleSend} style={styles.form}>
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Type a message..."
                        style={styles.input}
                        className="bf-input"
                    />
                    <button type="submit" disabled={sending || !draft.trim()} style={styles.sendBtn} className="bf-gold-btn">Send</button>
                </form>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: "fixed", bottom: "20px", right: "20px", zIndex: 1500,
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    card: {
        width: "340px", height: "440px", display: "flex", flexDirection: "column",
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.3)", borderRadius: "14px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.8)", overflow: "hidden",
    },
    header: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)",
    },
    headerInfo: { display: "flex", alignItems: "center", gap: "10px" },
    avatar: { width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" },
    name: { color: "#fff", fontWeight: 600, fontSize: "14px" },
    closeBtn: { background: "transparent", border: "none", color: "#888", fontSize: "22px", cursor: "pointer" },
    thread: { flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" },
    emptyText: { color: "#666", fontSize: "13px", textAlign: "center", marginTop: "20px" },
    bubbleRow: { display: "flex" },
    bubble: { maxWidth: "75%", padding: "8px 12px", borderRadius: "14px", fontSize: "13px", lineHeight: 1.4, wordBreak: "break-word" },
    bubbleMine: { background: "linear-gradient(135deg, var(--bf-accent), var(--bf-accent-dark))", color: "#0a0a0a" },
    bubbleTheirs: { background: "#0a0a0a", border: "1px solid #333", color: "#f5f5f5" },
    form: { display: "flex", gap: "8px", padding: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" },
    input: { flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "8px 10px", color: "#fff", fontSize: "13px", outline: "none" },
    sendBtn: { background: "var(--bf-accent)", color: "#0a0a0a", border: "none", borderRadius: "8px", padding: "8px 14px", fontWeight: 700, cursor: "pointer" },
};
