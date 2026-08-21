const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Get values from your input elements or state
    const usernameInput = (document.getElementById("login-username") as HTMLInputElement)?.value.trim() || "";
    const passwordInput = (document.getElementById("login-password") as HTMLInputElement)?.value || "";

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        
        const data = (await res.json()) as any;

        if (res.ok) {
            localStorage.setItem("bet_fund_token", data.token);
            // hydrate user profile here
        } else {
            console.error(data.error || "Login failed.");
        }
    } catch (err) {
        console.error("Network error:", err);
    }
};