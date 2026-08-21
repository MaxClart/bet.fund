import React, { useState, useEffect, useRef } from "react";

interface StoriesAndFriendsProps {
    token: string;
    currentUserId: string;
}

export const StoriesAndFriends: React.FC<StoriesAndFriendsProps> = ({ token, currentUserId }) => {
    const [stories, setStories] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [targetUsername, setTargetUsername] = useState("");
    const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
    const [progress, setProgress] = useState(0);

    const storyInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchStories();
        fetchFriendsData();
    }, [token]);

    // Story progress timer for fullscreen viewer
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
    }, [activeStoryIndex]);

    const fetchStories = async () => {
        try {
            const res = await fetch("/api/stories");
            const data = (await res.json()) as any;
            if (res.ok) setStories(data.stories || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFriendsData = async () => {
        try {
            const [friendsRes, reqsRes] = await Promise.all([
                fetch("/api/friends", { headers: { Authorization: `Bearer ${token}` } }),
                fetch("/api/friends/requests", { headers: { Authorization: `Bearer ${token}` } })
            ]);
            const friendsData = (await friendsRes.json()) as any;
            const reqsData = (await reqsRes.json()) as any;

            if (friendsRes.ok) setFriends(friendsData.friends || []);
            if (reqsRes.ok) setRequests(reqsData.requests || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "stories");

        try {
            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
            const uploadData = (await uploadRes.json()) as any;

            if (uploadRes.ok && uploadData.url) {
                await fetch("/api/stories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ userId: currentUserId, mediaUrl: uploadData.url, mediaType: file.type.startsWith("video") ? "video" : "image" })
                });
                fetchStories();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUsername.trim()) return;

        try {
            const res = await fetch("/api/friends/request", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ targetUsername })
            });
            const data = (await res.json()) as any;
            if (res.ok) {
                setTargetUsername("");
                alert("Friend request sent successfully!");
            } else {
                alert(data.error || "Failed to send request");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleAcceptRequest = async (requestId: string, senderId: string) => {
        try {
            const res = await fetch("/api/friends/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ requestId, senderId })
            });
            if (res.ok) {
                fetchFriendsData();
            }
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
        <div style={styles.container}>
            {/* Stories Tray */}
            <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Stories</h3>
                <button
                    onClick={() => storyInputRef.current?.click()}
                    style={styles.addStoryBtn}
                >
                    + Add Story
                </button>
                <input
                    type="file"
                    ref={storyInputRef}
                    onChange={handleStoryUpload}
                    style={{ display: "none" }}
                    accept="image/*,video/*"
                />
            </div>

            <div style={styles.storiesTray}>
                <div style={styles.storyItem} onClick={() => storyInputRef.current?.click()}>
                    <div style={{ ...styles.storyRing, borderStyle: "dashed" }}>
                        <div style={styles.storyInner}>+</div>
                    </div>
                    <span style={styles.storyUsername}>Your Story</span>
                </div>

                {stories.map((story, idx) => (
                    <div key={story.id} style={styles.storyItem} onClick={() => setActiveStoryIndex(idx)}>
                        <div style={styles.storyRing}>
                            <img src={story.avatar_url || "https://via.placeholder.com/60"} alt={story.username} style={styles.storyInnerImg} />
                        </div>
                        <span style={styles.storyUsername}>{story.username}</span>
                    </div>
                ))}
            </div>

            {/* Fullscreen Story Viewer Modal */}
            {activeStoryIndex !== null && stories[activeStoryIndex] && (
                <div style={styles.viewerOverlay}>
                    <div style={styles.viewerCard}>
                        <div style={styles.progressBarContainer}>
                            <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
                        </div>
                        <div style={styles.viewerHeader}>
                            <span style={styles.viewerUsername}>{stories[activeStoryIndex].username}</span>
                            <button onClick={() => setActiveStoryIndex(null)} style={styles.viewerClose}>&times;</button>
                        </div>
                        <div style={styles.viewerMediaContainer}>
                            {stories[activeStoryIndex].media_type === "video" ? (
                                <video src={stories[activeStoryIndex].media_url} autoPlay style={styles.viewerMedia} />
                            ) : (
                                <img src={stories[activeStoryIndex].media_url} alt="Story" style={styles.viewerMedia} />
                            )}
                            {stories[activeStoryIndex].caption && (
                                <div style={styles.viewerCaption}>{stories[activeStoryIndex].caption}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Friends System Section */}
            <div style={styles.friendsSection}>
                <h3 style={styles.sectionTitle}>Friends & Connections</h3>

                <form onSubmit={handleSendRequest} style={styles.friendRequestForm}>
                    <input
                        type="text"
                        value={targetUsername}
                        onChange={(e) => setTargetUsername(e.target.value)}
                        placeholder="Enter username to add..."
                        style={styles.input}
                    />
                    <button type="submit" style={styles.sendReqBtn}>Send Request</button>
                </form>

                {requests.length > 0 && (
                    <div style={styles.subGroup}>
                        <h4 style={styles.subTitle}>Pending Requests</h4>
                        {requests.map((req) => (
                            <div key={req.id} style={styles.requestCard}>
                                <div style={styles.friendInfo}>
                                    <img src={req.avatar_url || "https://via.placeholder.com/40"} alt={req.username} style={styles.smallAvatar} />
                                    <span>{req.username}</span>
                                </div>
                                <button onClick={() => handleAcceptRequest(req.id, req.sender_id)} style={styles.acceptBtn}>Accept</button>
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
                            <div key={friend.id} style={styles.friendCard}>
                                <div style={styles.friendInfo}>
                                    <img src={friend.avatar_url || "https://via.placeholder.com/40"} alt={friend.username} style={styles.smallAvatar} />
                                    <div>
                                        <div style={styles.friendName}>{friend.username}</div>
                                        <div style={styles.friendStatus}>{friend.status || "Offline"}</div>
                                    </div>
                                </div>
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
        border: "1px solid rgba(212, 175, 55, 0.2)",
        borderRadius: "16px",
        padding: "24px",
        color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
    },
    sectionTitle: {
        margin: 0,
        fontSize: "18px",
        fontWeight: 600,
        color: "#d4af37",
    },
    addStoryBtn: {
        background: "transparent",
        border: "1px solid #d4af37",
        color: "#d4af37",
        padding: "6px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
    },
    storiesTray: {
        display: "flex",
        gap: "16px",
        overflowX: "auto",
        paddingBottom: "12px",
        marginBottom: "24px",
    },
    storyItem: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        flexShrink: 0,
    },
    storyRing: {
        width: "64px",
        height: "64px",
        borderRadius: "50%",
        border: "2px solid #d4af37",
        padding: "2px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
    },
    storyInner: {
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        backgroundColor: "#222",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#d4af37",
        fontSize: "20px",
        fontWeight: 600,
    },
    storyInnerImg: {
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        objectFit: "cover",
    },
    storyUsername: {
        fontSize: "12px",
        color: "#ccc",
        maxWidth: "64px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    viewerOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.9)",
        zIndex: 2000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    viewerCard: {
        width: "100%",
        maxWidth: "400px",
        height: "80vh",
        backgroundColor: "#121212",
        borderRadius: "16px",
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
    },
    progressBarContainer: {
        width: "100%",
        height: "4px",
        backgroundColor: "#333",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 10,
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#d4af37",
        transition: "width 0.1s linear",
    },
    viewerHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px",
        zIndex: 5,
    },
    viewerUsername: {
        fontWeight: 600,
        color: "#fff",
    },
    viewerClose: {
        background: "transparent",
        border: "none",
        color: "#aaa",
        fontSize: "28px",
        cursor: "pointer",
    },
    viewerMediaContainer: {
        flex: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        backgroundColor: "#000",
    },
    viewerMedia: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },
    viewerCaption: {
        position: "absolute",
        bottom: "20px",
        left: "20px",
        right: "20px",
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: "10px",
        borderRadius: "8px",
        color: "#fff",
        textAlign: "center",
        backdropFilter: "blur(4px)",
    },
    friendsSection: {
        marginTop: "20px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        paddingTop: "20px",
    },
    friendRequestForm: {
        display: "flex",
        gap: "10px",
        marginBottom: "16px",
    },
    input: {
        flex: 1,
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "10px 12px",
        color: "#fff",
        fontSize: "14px",
        outline: "none",
    },
    sendReqBtn: {
        background: "linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "8px",
        padding: "0 16px",
        fontWeight: 600,
        cursor: "pointer",
    },
    subGroup: {
        marginBottom: "16px",
    },
    subTitle: {
        fontSize: "14px",
        color: "#888",
        marginBottom: "10px",
    },
    requestCard: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
        padding: "10px 14px",
        borderRadius: "8px",
        border: "1px solid #333",
        marginBottom: "8px",
    },
    friendCard: {
        display: "flex",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
        padding: "10px 14px",
        borderRadius: "8px",
        border: "1px solid #333",
        marginBottom: "8px",
    },
    friendInfo: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    smallAvatar: {
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        objectFit: "cover",
    },
    friendName: {
        fontWeight: 600,
        fontSize: "14px",
    },
    friendStatus: {
        fontSize: "12px",
        color: "#888",
    },
    acceptBtn: {
        background: "#d4af37",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "6px",
        padding: "6px 12px",
        fontWeight: 600,
        cursor: "pointer",
    },
    emptyText: {
        color: "#666",
        fontSize: "13px",
    },
};