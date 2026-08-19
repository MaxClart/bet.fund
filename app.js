// app.js - 100% Server-Side Database Architecture (Zero LocalStorage)

const BACKEND_ENDPOINT = "https://eea59698ac4fa33d1140377f9ca19961.r2.cloudflarestorage.com/bet";

// 1. Initialize Authentication State Listener
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Authenticated via Firebase:", user.uid);
        await fetchUserDataFromServer(user.uid);
    } else {
        console.log("No active session. User is logged out.");
        resetUIForLoggedOutState();
    }
});

// 2. Real Google Sign-In Trigger (Bound to your Login Button)
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log("Google Login Success:", result.user.email);
        })
        .catch((error) => {
            console.error("Google Login Error:", error.code, error.message);
            alert("Authentication failed: " + error.message);
        });
}

// 3. Fetch Profile Exclusively from Cloudflare R2 Database
async function fetchUserDataFromServer(userId) {
    try {
        const response = await fetch(`${BACKEND_ENDPOINT}/profiles/${userId}.json`);
        if (response.ok) {
            const data = await response.json();
            populateUIWithServerData(data);
        } else {
            console.log("No remote profile found. Initializing new record.");
        }
    } catch (error) {
        console.error("Failed to fetch from server database:", error);
    }
}

// 4. Save Profile Exclusively to Cloudflare R2 Database (Zero Local Storage)
async function saveProfileToServer(userId, profileData) {
    const saveButton = document.getElementById('save-profile-btn');
    if (saveButton) saveButton.textContent = "Syncing to Database...";

    try {
        const response = await fetch(`${BACKEND_ENDPOINT}/profiles/${userId}.json`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...profileData,
                lastUpdated: new Date().toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`Database sync failed with status ${response.status}`);
        }

        console.log("Successfully saved to server database.");
        if (saveButton) saveButton.textContent = "Saved";
        setTimeout(() => { if (saveButton) saveButton.textContent = "Save Changes"; }, 2000);

    } catch (error) {
        console.error("Persistence error:", error);
        alert("Failed to save changes to the database.");
        if (saveButton) saveButton.textContent = "Sync Failed";
    }
}

function populateUIWithServerData(data) {
    // Map your server JSON data fields to your UI inputs here
}

function resetUIForLoggedOutState() {
    // Clear display fields back to default empty state
}