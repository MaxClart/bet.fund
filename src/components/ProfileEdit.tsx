import React, { useState, useRef } from "react";

interface ProfileEditProps {
    user: {
        id: string;
        username: string;
        bio?: string;
        status?: string;
        avatar_url?: string;
        banner_url?: string;
    };
    token: string;
    onClose: () => void;
    onUpdate: (updatedUser: any) => void;
}

export const ProfileEdit: React.FC<ProfileEditProps> = ({ user, token, onClose, onUpdate }) => {
    const [bio, setBio] = useState(user.bio || "");
    const [status, setStatus] = useState(user.status || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(user.banner_url || "");
    
    // Zoom and scaling states for framing preview
    const [bannerScale, setBannerScale] = useState(1);
    const [avatarScale, setAvatarScale] = useState(1);

    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === "avatar") setUploadingAvatar(true);
        else setUploadingBanner(true);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", type === "avatar" ? "avatars" : "banners");

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = (await res.json()) as any;
            if (res.ok && data.url) {
                if (type === "avatar") {
                    setAvatarUrl(data.url);
                    setAvatarScale(1);
                } else {
                    setBannerUrl(data.url);
                    setBannerScale(1);
                }
            } else {
                alert(data.error || "Upload failed");
            }
        } catch (err: any) {
            alert(err.message || "Upload error");
        } finally {
            if (type === "avatar") setUploadingAvatar(false);
            else setUploadingBanner(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const updatedData = {
            bio,
            status,
            avatar_url: avatarUrl,
            banner_url: bannerUrl,
        };

        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updatedData),
            });

            if (res.ok) {
                onUpdate({ ...user, ...updatedData });
                onClose();
            } else {
                const data = (await res.json()) as any;
                alert(data.error || "Failed to update profile");
            }
        } catch (err: any) {
            alert(err.message || "Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Edit Elite Profile</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <form onSubmit={handleSave} style={styles.form}>
                    {/* Banner Framing Section */}
                    <div style={styles.sectionBlock}>
                        <label style={styles.label}>Profile Banner</label>
                        <div style={styles.bannerPreviewContainer}>
                            <div 
                                style={{
                                    ...styles.bannerPreview,
                                    backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none",
                                    backgroundSize: `${bannerScale * 100}%`,
                                }} 
                            />
                            <div style={styles.bannerOverlayControls}>
                                <button
                                    type="button"
                                    onClick={() => bannerInputRef.current?.click()}
                                    style={styles.customUploadBtn}
                                    disabled={uploadingBanner}
                                >
                                    {uploadingBanner ? "Uploading..." : "✦ Change Banner"}
                                </button>
                                {bannerUrl && (
                                    <div style={styles.sliderWrapper}>
                                        <span style={styles.sliderLabel}>Zoom</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="2.5"
                                            step="0.05"
                                            value={bannerScale}
                                            onChange={(e) => setBannerScale(parseFloat(e.target.value))}
                                            style={styles.slider}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Native input fully hidden */}
                        <input
                            type="file"
                            ref={bannerInputRef}
                            onChange={(e) => handleFileUpload(e, "banner")}
                            style={{ display: "none" }}
                            accept="image/*"
                        />
                    </div>

                    {/* Avatar Framing Section */}
                    <div style={styles.sectionBlock}>
                        <label style={styles.label}>Avatar & Elite Badge</label>
                        <div style={styles.avatarEditorRow}>
                            <div style={styles.avatarContainer}>
                                <div style={styles.avatarClipping}>
                                    <img
                                        src={avatarUrl || "https://via.placeholder.com/120"}
                                        alt="Avatar"
                                        style={{
                                            ...styles.avatarImg,
                                            transform: `scale(${avatarScale})`,
                                        }}
                                    />
                                </div>
                                <div style={styles.eliteBadge} title="Elite User">✦ ELITE</div>
                            </div>
                            
                            <div style={styles.avatarControlsColumn}>
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    style={styles.customUploadBtn}
                                    disabled={uploadingAvatar}
                                >
                                    {uploadingAvatar ? "Uploading..." : "✦ Change Avatar"}
                                </button>
                                {avatarUrl && (
                                    <div style={styles.sliderWrapper}>
                                        <span style={styles.sliderLabel}>Zoom</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="2.5"
                                            step="0.05"
                                            value={avatarScale}
                                            onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
                                            style={styles.slider}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Native input fully hidden */}
                        <input
                            type="file"
                            ref={avatarInputRef}
                            onChange={(e) => handleFileUpload(e, "avatar")}
                            style={{ display: "none" }}
                            accept="image/*"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Custom Status</label>
                        <input
                            type="text"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={styles.input}
                            placeholder="What's your current status?"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            style={{ ...styles.input, height: "80px", resize: "none" }}
                            placeholder="Write a brief luxury bio..."
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.saveBtn}>
                        {loading ? "Saving Changes..." : "Save Profile"}
                    </button>
                </form>
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
    },
    modal: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(212, 175, 55, 0.3)",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "520px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 25px 50px rgba(0, 0, 0, 0.9), 0 0 25px rgba(212, 175, 55, 0.08)",
        color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px 10px 24px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    title: {
        margin: 0,
        fontSize: "20px",
        fontWeight: 600,
        color: "#d4af37",
        letterSpacing: "0.5px",
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#888",
        fontSize: "28px",
        cursor: "pointer",
        padding: 0,
    },
    form: {
        padding: "20px 24px 24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
    },
    sectionBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#d4af37",
        letterSpacing: "0.3px",
    },
    bannerPreviewContainer: {
        height: "130px",
        backgroundColor: "#0a0a0a",
        borderRadius: "10px",
        position: "relative",
        overflow: "hidden",
        border: "1px solid #333",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "12px",
    },
    bannerPreview: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        transition: "background-size 0.1s ease",
        zIndex: 1,
    },
    bannerOverlayControls: {
        position: "relative",
        zIndex: 2,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        justifyContent: "space-between",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(212, 175, 55, 0.2)",
    },
    customUploadBtn: {
        background: "rgba(0, 0, 0, 0.8)",
        border: "1px solid #d4af37",
        color: "#d4af37",
        padding: "6px 14px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
    },
    sliderWrapper: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
    },
    sliderLabel: {
        fontSize: "11px",
        color: "#aaa",
    },
    slider: {
        width: "90px",
        accentColor: "#d4af37",
        cursor: "pointer",
    },
    avatarEditorRow: {
        display: "flex",
        alignItems: "center",
        gap: "20px",
        backgroundColor: "#0a0a0a",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #333",
    },
    avatarContainer: {
        position: "relative",
        width: "80px",
        height: "80px",
        flexShrink: 0,
    },
    avatarClipping: {
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
        border: "2px solid #d4af37",
    },
    avatarImg: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transformOrigin: "center",
        transition: "transform 0.1s ease",
    },
    eliteBadge: {
        position: "absolute",
        bottom: "-2px",
        right: "-2px",
        backgroundColor: "#d4af37",
        color: "#0a0a0a",
        fontSize: "9px",
        fontWeight: 900,
        padding: "2px 6px",
        borderRadius: "10px",
        border: "2px solid #121212",
        letterSpacing: "0.5px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.8)",
        zIndex: 5,
    },
    avatarControlsColumn: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1,
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    input: {
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "10px 14px",
        color: "#fff",
        fontSize: "14px",
        outline: "none",
        transition: "border-color 0.2s",
    },
    saveBtn: {
        background: "linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "8px",
        padding: "14px",
        fontSize: "15px",
        fontWeight: 700,
        cursor: "pointer",
        marginTop: "10px",
        boxShadow: "0 4px 15px rgba(212, 175, 55, 0.3)",
    },
};