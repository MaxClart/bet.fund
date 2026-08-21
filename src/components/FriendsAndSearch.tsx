import React, { useState, useEffect } from "react";

interface FriendsAndSearchProps {
    token: string;
    currentUserId: string;
}

export function FriendsAndSearch({ token, currentUserId }: FriendsAndSearchProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [friends, setFriends] = useState<any[]>([]);

    useEffect(() => {
        if (!token) return;
        fetch("/api/friends", {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then((data: any) => {
            if (data && data.friends) {
                setFriends(data.friends);
            }
        })
        .catch(err => console.error("Failed to load friends", err));
    }, [token]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then((data: any) => {
            if (data && data.users) {
                setSearchResults(data.users);
            }
        })
        .catch(err => console.error("Search failed", err));
    };

    const addFriend = (friendId: string) => {
        fetch("/api/friends/add", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ friendId })
        })
        .then(res => res.json())
        .then(() => {
            alert("Friend request sent / added!");
        })
        .catch(err => console.error("Failed to add friend", err));
    };

    return (
        <div style={{ background: "#121212", padding: "20px", borderRadius: "12px", border: "1px solid #222" }}>
            <h2>Find Friends & Connections</h2>
            <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#1a1a1a", border: "1px solid #333", color: "#fff" }}
                />
                <button type="submit" style={{ padding: "10px 20px", background: "#d4af37", color: "#000", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
                    Search
                </button>
            </form>

            {searchResults.length > 0 && (
                <div style={{ marginBottom: "30px" }}>
                    <h3>Search Results</h3>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {searchResults.map((user: any) => (
                            <li key={user.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #222" }}>
                                <span>{user.username || user.email}</span>
                                <button onClick={() => addFriend(user.id)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "5px 15px", borderRadius: "6px", cursor: "pointer" }}>
                                    Add Friend
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div>
                <h3>Your Friends</h3>
                {friends.length === 0 ? (
                    <p style={{ color: "#888" }}>No friends added yet. Use the search bar above to find users!</p>
                ) : (
                    <ul style={{ listStyle: "none", padding: 0 }}>
                        {friends.map((friend: any) => (
                            <li key={friend.id} style={{ padding: "10px 0", borderBottom: "1px solid #222" }}>
                                {friend.username || friend.email}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}