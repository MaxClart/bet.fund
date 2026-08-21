import React, { useState, useEffect } from "react";
import { ProfileEdit } from "./components/ProfileEdit";
import { FriendAndSearch } from "./components/FriendAndSearch";

export default function App() {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string>(localStorage.getItem("bet_token") || "");
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    useEffect(() => {
        if (token) {
            fetch("/api/auth/me", {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.json())
            .then((data: any) => {
                if (data && data.user) {
                    setUser(data.user);
                }
            })
            .catch(() => {
                setToken("");
                localStorage.removeItem("bet_token");
            });
        }
    }, [token]);

    if (!user) {
        return <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>Please log in to access bet.fund</div>;
    }

    return (
        <div style={{ backgroundColor: "#0a0a0a", minHeight: "100vh", padding: "20px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                <h1>bet.fund // Elite Dashboard</h1>
                <button 
                    onClick={() => setIsEditingProfile(true)}
                    style={{ background: "#d4af37", color: "#000", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                    Edit Profile
                </button>
            </div>

            {/* Friends, Search & Stories Component */}
            <FriendAndSearch token={token} currentUserId={user.id} />

            {/* Profile Edit Modal */}
            {isEditingProfile && (
                <ProfileEdit 
                    user={user} 
                    token={token} 
                    onClose={() => setIsEditingProfile(false)} 
                    onUpdate={(updated: any) => setUser(updated)} 
                />
            )}
        </div>
    );
}