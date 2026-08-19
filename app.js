// app.js - 100% Cloud / Database Persistence (Zero LocalStorage)

const BACKEND_ENDPOINT = "https://eea59698ac4fa33d1140377f9ca19961.r2.cloudflarestorage.com/bet";

// 1. Authentication Listener (Drives state from Firebase, not local memory)
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Authenticated user detected:", user.uid);
        // Immediately fetch data from the server database, never from localStorage
        await fetchUserDataFromServer(user.uid);
    } else {
        console.log("No active user session.");
        clearUIState();
    }
});

// 2. Fetch User Profile Exclusively From Server Database
async function fetchUserDataFromServer(userId) {
    try {
        const response = await fetch(`${BACKEND_ENDPOINT}/profiles/${userId}.json`);
        if (response.ok) {
            const data = await response.json();
            populateUI(data);
        } else {
            console.log("No existing profile found on server. Initializing blank state.");
        }
    } catch (error) {
        console.error("Failed to load data from server database:", error);
    }
}

// 3. Save Profile Exclusively To Server Database (Zero LocalStorage usage)
async function saveProfileToServer(userId, profileData) {
    const saveButton = document.getElementById('save-profile-btn');
    if (saveButton) saveButton.textContent = "Syncing to Database...";

    try {
        const response = await fetch(`${BACKEND_ENDPOINT}/profiles/${userId}.json`, {
            method: 'PUT', // Overwrites/updates record directly on the server
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...profileData,
                lastSynced: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Server sync failed with status ${response.status}`);
        }

        console.log("Successfully persisted to full database.");
        if (saveButton) saveButton.textContent = "Saved to Database";
        setTimeout(() => { if (saveButton) saveButton.textContent = "Save Changes"; }, 2000);

    } catch (error) {
        console.error("Database persistence error:", error);
        alert("Error saving to backend database. Check console.");
        if (saveButton) saveButton.textContent = "Sync Failed";
    }
}

function populateUI(data) {
    // Populate your input fields and elements dynamically with server data here
}

function clearUIState() {
    // Reset UI when logged out
}