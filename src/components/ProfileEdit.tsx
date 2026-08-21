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
    onClose: () => void;
    onUpdate: (updatedUser: any) => void;
}

export const ProfileEdit: React.FC<ProfileEditProps> = ({ user, onClose, onUpdate }) => {
    const [bio, setBio] = useState(user.bio || "");
    const [status, setStatus] = useState(user.status || "");
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(user.banner_url || "");
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
                if (type === "avatar") setAvatarUrl(data.url);
                else setBannerUrl(data.url);
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

        try {
            // Simulated or real update route depending on implementation, here we call parent update
            onUpdate({ ...user, bio, status, avatar_url: avatarUrl, banner_url: bannerUrl });
            onClose();
        } catch (err: any) {
            alert(err.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Edit Profile</h2>
                    <button onClick={onClose} style={styles.closeBtn}>&times;</button>
                </div>

                <form onSubmit={handleSave} style={styles.form}>
                    {/* Banner Section */}
                    <div style={{ ...styles.bannerSection, backgroundImage: bannerUrl ? `url(${bannerUrl})` : "none" }}>
                        <button
                            type="button"
                            onClick={() => bannerInputRef.current?.click()}
                            style={styles.bannerUploadBtn}
                            disabled={uploadingBanner}
                        >
                            {uploadingBanner ? "Uploading..." : "Change Banner"}
                        </button>
                        <input
                            type="file"
                            ref={bannerInputRef}
                            onChange={(e) => handleFileUpload(e, "banner")}
                            style={{ display: "none" }}
                            accept="image/*"
                        />
                    </div>

                    {/* Avatar & Elite Badge Section */}
                    <div style={styles.avatarWrapperContainer}>
                        <div style={styles.avatarContainer}>
                            <img
                                src={avatarUrl || "https://via.placeholder.com/120"}
                                alt="Avatar"
                                style={styles.avatar}
                            />
                            <div style={styles.eliteBadge} title="Elite User">✦ ELITE</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            style={styles.avatarUploadBtn}
                            disabled={uploadingAvatar}
                        >
                            {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                        </button>
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
                            placeholder="What's on your mind?"
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Bio</label>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            style={{ ...styles.input, height: "80px", resize: "none" }}
                            placeholder="Tell the world about yourself..."
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.saveBtn}>
                        {loading ? "Saving..." : "Save Changes"}
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
        border: "1px solid rgba(212, 175, 55, 0.2)",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "500px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 175, 55, 0.05)",
        color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 24px 10px 24px",
    },
    title: {
        margin: 0,
        fontSize: "20px",
        fontWeight: 600,
        color: "#d4af37",
    },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "#888",
        fontSize: "26px",
        cursor: "pointer",
        padding: 0,
    },
    form: {
        padding: "0 24px 24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    bannerSection: {
        height: "120px",
        backgroundColor: "#222",
        backgroundSize: "cover",
        backgroundPosition: "center",
        borderRadius: "10px",
        position: "relative",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: "10px",
        border: "1px solid #333",
    },
    bannerUploadBtn: {
        background: "rgba(0, 0, 0, 0.7)",
        border: "1px solid #d4af37",
        color: "#d4af37",
        padding: "6px 12px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        backdropFilter: "blur(4px)",
    },
    avatarWrapperContainer: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginTop: "-30px",
        paddingLeft: "10px",
    },
    avatarContainer: {
        position: "relative",
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "3px solid #121212",
        backgroundColor: "#222",
    },
    avatar: {
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        objectFit: "cover",
    },
    eliteBadge: {
        position: "absolute",
        bottom: "0px",
        right: "0px",
        backgroundColor: "#d4af37",
        color: "#0a0a0a",
        fontSize: "9px",
        fontWeight: 800,
        padding: "2px 5px",
        borderRadius: "10px",
        border: "2px solid #121212",
        letterSpacing: "0.5px",
    },
    avatarUploadBtn: {
        background: "transparent",
        border: "1px solid rgba(212, 175, 55, 0.4)",
        color: "#d4af37",
        padding: "8px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.2s",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    label: {
        fontSize: "13px",
        fontWeight: 500,
        color: "#aaa",
    },
    input: {
        backgroundColor: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "10px 12px",
        color: "#fff",
        fontSize: "14px",
        outline: "none",
    },
    saveBtn: {
        background: "linear-gradient(135deg, #d4af37 0%, #aa8c2c 100%)",
        color: "#0a0a0a",
        border: "none",
        borderRadius: "8px",
        padding: "12px",
        fontSize: "15px",
        fontWeight: 600,
        cursor: "pointer",
        marginTop: "10px",
    },
};