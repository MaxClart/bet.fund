import React, { useState, useEffect, useRef } from "react";

interface StoriesAndFriendsProps {
    token: string;
    currentUserId: string;
    onOpenConversation: (friend: any) => void;
    onOpenProfile: (userId: string) => void;
}

const FRIEND_POLL_MS = 8000;

export const StoriesAndFriends: React.FC<StoriesAndFriendsProps> = ({ token, currentUserId, onOpenConversation, onOpenProfile }) => {
    const [stories, setStories] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [targetUsername, setTargetUsername] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);
    const [notice, setNotice] = useState("");
    const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
    const [storyVisibility, setStoryVisibility] = useState<"public" | "private">("public");
    const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({});

    const storyInputRef = useRef<HTMLInputElement>(null);

    const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

    useEffect(() => {
        fetchStories();
        fetchFriendsData();
        // Friend requests/friends list used to only load once, so a new request
        // never showed up until a manual page refresh. Poll instead.
        const interval = setInterval(fetchFriendsData, FRIEND_POLL_MS);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (activeStoryIndex === null) return;
        setProgress(0);
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    handleNextStory();
                    return 0;
                }
                return prev + 2;
            });
        }, 100);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeStoryIndex]);

    const fetchStories = async () => {
        try {
            const res = await fetch("/api/stories", { headers: authHeaders(), credentials: "include" });
            const data = (await res.json()) as any;
            if (res.ok) setStories(data.stories || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFriendsData = async () => {
        if (!token) return;
        try {
            const [friendsRes, reqsRes, unreadRes] = await Promise.all([
                fetch("/api/friends", { headers: authHeaders(), credentials: "include" }),
                fetch("/api/friends/requests", { headers: authHeaders(), credentials: "include" }),
                fetch("/api/messages", { headers: authHeaders(), credentials: "include" }),
            ]);
            const friendsData = (await friendsRes.json()) as any;
            const reqsData = (await reqsRes.json()) as any;
            const unreadData = (await unreadRes.json()) as any;
            if (friendsRes.ok) setFriends(friendsData.friends || []);
            if (reqsRes.ok) setRequests(reqsData.requests || []);
            if (unreadRes.ok) {
                const map: Record<string, number> = {};
                (unreadData.unread || []).forEach((row: any) => { map[row.sender_id] = row.unread; });
                setUnreadBySender(map);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const flashNotice = (msg: string) => {
        setNotice(msg);
        setTimeout(() => setNotice(""), 3000);
    };

    const handleStoryFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingStoryFile(file);
        e.target.value = "";
    };

    const submitStory = async () => {
        if (!pendingStoryFile) return;
        const file = pendingStoryFile;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "story");

        try {
            const uploadRes = await fetch("/api/user/upload", { method: "POST", headers: authHeaders(), credentials: "include", body: formData });
            const uploadData = (await uploadRes.json()) as any;

            if (uploadRes.ok && uploadData.url) {
                await fetch("/api/stories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    credentials: "include",
                    body: JSON.stringify({
                        mediaUrl: uploadData.url,
                        mediaType: file.type.startsWith("video") ? "video" : "image",
                        visibility: storyVisibility,
                    }),
                });
                fetchStories();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setPendingStoryFile(null);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        try {
            const res = await fetch(`/api/friends/search?query=${encodeURIComponent(searchQuery)}`, {
                headers: authHeaders(),
                credentials: "include",
            });
            const data = (await res.json()) as any;
            if (res.ok) setSearchResults(data.users || []);
        } catch (err) {
            console.error(err);
        }
    };

    const sendRequestTo = async (payload: { targetUsername?: string; targetUserId?: string }) => {
        try {
            const res = await fetch("/api/friends/request", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            const data = (await res.json()) as any;
            flashNotice(res.ok ? "Friend request sent!" : (data.error || "Failed to send request"));
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUsername.trim()) return;
        sendRequestTo({ targetUsername: targetUsername.trim() });
        setTargetUsername("");
    };

    const handleAcceptRequest = async (requestId: string, senderId: string) => {
        try {
            const res = await fetch("/api/friends/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ requestId, senderId }),
            });
            if (res.ok) fetchFriendsData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        try {
            const res = await fetch("/api/friends/decline", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ requestId }),
            });
            if (res.ok) fetchFriendsData();
        } catch (err) {
            console.error(err);
        }
    };

    const followUser = async (targetUserId: string) => {
        try {
            await fetch("/api/follow", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                credentials: "include",
                body: JSON.stringify({ targetUserId }),
            });
            flashNotice("Now following!");
        } catch (err) {
            console.error(err);
        }
    };

    const handleNextStory = () => {
        if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
        } else {
            setActiveStoryIndex(null);
        }
    };

    return (
        <div style={styles.container} className="bf-container bf-glow-card">
            {notice && <div style={styles.noticeBanner}>{notice}</div>}

            {/* Stories Tray */}
            <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle} className="bf-serif">Stories</h3>
                <button onClick={() => storyInputRef.current?.click()} style={styles.addStoryBtn} className="bf-outline-btn">+ Add Story</button>
                <input type="file" ref={storyInputRef} onChange={handleStoryFilePicked} style={{ display: "none" }} accept="image/*,video/*" />
            </div>

            <div style={styles.storiesTray}>
                <div style={styles.storyItem} onClick={() => storyInputRef.current?.click()}>
                    <div style={{ ...styles.storyRing, borderStyle: "dashed" }}>
                        <div style={styles.storyInner}>+</div>
                    </div>
                    <span style={styles.storyUsername}>Your Story</span>
                </div>

                {stories.map((story, idx) => (
                    <div key={story.id} style={styles.storyItem}>
                        <div style={styles.storyRing} className="bf-story-ring" onClick={() => setActiveStoryIndex(idx)}>
                            <div style={styles.storyRingInner}>
                                <img src={story.avatar_url || "https://via.placeholder.com/60"} alt={story.username} style={styles.storyInnerImg} />
                            </div>
                        </div>
                        <span style={styles.storyUsername} onClick={() => onOpenProfile(story.user_id)}>{story.display_name || story.username}</span>
                    </div>
                ))}
            </div>

            {pendingStoryFile && (
                <div style={styles.storyComposeBar}>
                    <span style={styles.storyComposeLabel}>Share "{pendingStoryFile.name}" to:</span>
                    <div style={styles.visibilityToggle}>
                        <button
                            type="button"
                            onClick={() => setStoryVisibility("public")}
                            style={{ ...styles.visBtn, ...(storyVisibility === "public" ? styles.visBtnActive : {}) }}
                        >
                            Public (Followers)
                        </button>
                        <button
                            type="button"
                            onClick={() => setStoryVisibility("private")}
                            style={{ ...styles.visBtn, ...(storyVisibility === "private" ? styles.visBtnActive : {}) }}
                        >
                            Private (Friends)
                        </button>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => setPendingStoryFile(null)} style={styles.declineBtn} className="bf-outline-btn">Cancel</button>
                        <button onClick={submitStory} style={styles.acceptBtn} className="bf-gold-btn">Post Story</button>
                    </div>
                </div>
            )}

            {activeStoryIndex !== null && stories[activeStoryIndex] && (
                <div style={styles.viewerOverlay}>
                    <div style={styles.viewerCard}>
                        <div style={styles.progressBarContainer}>
                            <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
                        </div>
                        <div style={styles.viewerHeader}>
                            <span style={styles.viewerUsername}>{stories[activeStoryIndex].display_name || stories[activeStoryIndex].username}</span>
                            <button onClick={() => setActiveStoryIndex(null)} style={styles.viewerClose}>&times;</button>
                        </div>
                        <div style={styles.viewerMediaContainer}>
                            {stories[activeStoryIndex].media_type === "video" ? (
                                <video src={stories[activeStoryIndex].media_url} autoPlay style={styles.viewerMedia} />
                            ) : (
                                <img src={stories[activeStoryIndex].media_url} alt="Story" style={styles.viewerMedia} />
                            )}
                            {stories[activeStoryIndex].caption && <div style={styles.viewerCaption}>{stories[activeStoryIndex].caption}</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Friend search */}
            <div style={styles.friendsSection}>
                <h3 style={styles.sectionTitle} className="bf-serif">Find People</h3>
                <form onSubmit={handleSearch} style={styles.friendRequestForm}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by username..."
                        style={styles.input}
                        className="bf-input"
                    />
                    <button type="submit" style={styles.sendReqBtn} className="bf-gold-btn">Search</button>
                </form>

                {searchResults.length > 0 && (
                    <div style={styles.subGroup}>
                        {searchResults.map((u) => (
                            <div key={u.id} style={styles.requestCard} className="bf-list-card">
                                <div style={styles.friendInfo} onClick={() => onOpenProfile(u.id)}>
                                    <img src={u.avatar_url || "https://via.placeholder.com/40"} alt={u.username} style={styles.smallAvatar} />
                                    <span>{u.display_name || u.username}</span>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button onClick={() => followUser(u.id)} style={styles.declineBtn} className="bf-outline-btn">Follow</button>
                                    <button onClick={() => sendRequestTo({ targetUserId: u.id })} style={styles.acceptBtn} className="bf-gold-btn">Add</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Friends System Section */}
            <div style={styles.friendsSection}>
                <h3 style={styles.sectionTitle} className="bf-serif">Friends & Connections</h3>

                <form onSubmit={handleSendRequest} style={styles.friendRequestForm}>
                    <input
                        type="text"
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        placeholder="Enter exact username to add..."
                        style={styles.input}
                        className="bf-input"
                    />
                    <button type="submit" style={styles.sendReqBtn} className="bf-gold-btn">Send Request</button>
                </form>

                {requests.length > 0 && (
                    <div style={styles.subGroup}>
                        <h4 style={styles.subTitle}>Pending Requests</h4>
                        {requests.map((req) => (
                            <div key={req.id} style={styles.requestCard} className="bf-list-card">
                                <div style={styles.friendInfo} onClick={() => onOpenProfile(req.sender_id)}>
                                    <img src={req.avatar_url || "https://via.placeholder.com/40"} alt={req.username} style={styles.smallAvatar} />
                                    <span>{req.display_name || req.username}</span>
                                </div>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button onClick={() => handleAcceptRequest(req.id, req.sender_id)} style={styles.acceptBtn} className="bf-gold-btn">Accept</button>
                                    <button onClick={() => handleDeclineRequest(req.id)} style={styles.declineBtn} className="bf-outline-btn">Decline</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={styles.subGroup}>
                    <h4 style={styles.subTitle}>My Friends ({friends.length})</h4>
                    {friends.length === 0 ? (
                        <p style={styles.emptyText}>No friends added yet.</p>
                    ) : (
                        friends.map((friend) => (
                            <div key={friend.id} style={styles.friendCard} className="bf-list-card">
                                <div style={styles.friendInfo} onClick={() => onOpenProfile(friend.id)}>
                                    <img src={friend.avatar_url || "https://via.placeholder.com/40"} alt={friend.username} style={styles.smallAvatar} />
                                    <div>
                                        <div style={styles.friendName}>{friend.display_name || friend.username}</div>
                                        <div style={styles.friendStatus}>{friend.status || "Offline"}</div>
                                    </div>
                                </div>
                                <button onClick={() => onOpenConversation(friend)} style={styles.messageBtn} className="bf-outline-btn">
                                    Message{unreadBySender[friend.id] ? ` (${unreadBySender[friend.id]})` : ""}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.2)", borderRadius: "16px", padding: "24px",
        color: "#f5f5f5", fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "600px", margin: "0 auto",
    },
    noticeBanner: {
        background: "rgba(var(--bf-accent-rgb), 0.12)", border: "1px solid rgba(var(--bf-accent-rgb), 0.4)",
        color: "var(--bf-accent)", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
    },
    sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
    sectionTitle: { margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--bf-accent)" },
    addStoryBtn: { background: "transparent", border: "1px solid var(--bf-accent)", color: "var(--bf-accent)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
    storiesTray: { display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px" },
    storyItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: "pointer", flexShrink: 0 },
    storyRing: { width: "64px", height: "64px", borderRadius: "50%", padding: "2.5px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" },
    storyRingInner: { width: "100%", height: "100%", borderRadius: "50%", background: "#0a0a0a", padding: "2px", display: "flex", justifyContent: "center", alignItems: "center" },
    storyInner: { width: "100%", height: "100%", borderRadius: "50%", backgroundColor: "#222", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--bf-accent)", fontSize: "20px", fontWeight: 600 },
    storyInnerImg: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" },
    storyUsername: { fontSize: "12px", color: "#ccc", maxWidth: "64px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    storyComposeBar: { background: "#0a0a0a", border: "1px solid #333", borderRadius: "10px", padding: "14px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" },
    storyComposeLabel: { fontSize: "12px", color: "#aaa" },
    visibilityToggle: { display: "flex", gap: "8px" },
    visBtn: { flex: 1, background: "transparent", border: "1px solid #444", color: "#999", borderRadius: "8px", padding: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
    visBtnActive: { border: "1px solid var(--bf-accent)", color: "var(--bf-accent)", background: "rgba(var(--bf-accent-rgb),0.1)" },
    viewerOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.9)", zIndex: 2000, display: "flex", justifyContent: "center", alignItems: "center" },
    viewerCard: { width: "100%", maxWidth: "400px", height: "80vh", backgroundColor: "#121212", borderRadius: "16px", border: "1px solid #333", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" },
    progressBarContainer: { width: "100%", height: "4px", backgroundColor: "#333", position: "absolute", top: 0, left: 0, zIndex: 10 },
    progressBarFill: { height: "100%", backgroundColor: "var(--bf-accent)", transition: "width 0.1s linear" },
    viewerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", zIndex: 5 },
    viewerUsername: { fontWeight: 600, color: "#fff" },
    viewerClose: { background: "transparent", border: "none", color: "#aaa", fontSize: "28px", cursor: "pointer" },
    viewerMediaContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", position: "relative", backgroundColor: "#000" },
    viewerMedia: { width: "100%", height: "100%", objectFit: "contain" },
    viewerCaption: { position: "absolute", bottom: "20px", left: "20px", right: "20px", backgroundColor: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", color: "#fff", textAlign: "center", backdropFilter: "blur(4px)" },
    friendsSection: { marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px" },
    friendRequestForm: { display: "flex", gap: "10px", marginBottom: "16px" },
    input: { flex: 1, backgroundColor: "#0a0a0a", border: "1px solid #333", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "14px", outline: "none" },
    sendReqBtn: { background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)", color: "#0a0a0a", border: "none", borderRadius: "8px", padding: "0 16px", fontWeight: 600, cursor: "pointer" },
    subGroup: { marginBottom: "16px" },
    subTitle: { fontSize: "14px", color: "#888", marginBottom: "10px" },
    requestCard: { display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0a0a0a", padding: "10px 14px", borderRadius: "8px", border: "1px solid #333", marginBottom: "8px", flexWrap: "wrap", gap: "8px" },
    friendCard: { display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0a0a0a", padding: "10px 14px", borderRadius: "8px", border: "1px solid #333", marginBottom: "8px", flexWrap: "wrap", gap: "8px" },
    friendInfo: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" },
    smallAvatar: { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" },
    friendName: { fontWeight: 600, fontSize: "14px" },
    friendStatus: { fontSize: "12px", color: "#888" },
    acceptBtn: { background: "var(--bf-accent)", color: "#0a0a0a", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, cursor: "pointer" },
    declineBtn: { background: "transparent", color: "#888", border: "1px solid #444", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, cursor: "pointer" },
    messageBtn: { background: "transparent", color: "var(--bf-accent)", border: "1px solid var(--bf-accent)", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, cursor: "pointer" },
    emptyText: { color: "#666", fontSize: "13px" },
};
