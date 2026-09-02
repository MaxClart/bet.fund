import React, { useState, useRef, useCallback } from "react";

export interface Transform {
    zoom: number;
    x: number;
    y: number;
}

interface CropModalProps {
    imageUrl: string;
    shape: "circle" | "rect";
    initialTransform?: Transform;
    onCancel: () => void;
    onApply: (transform: Transform) => void;
}

// Frame = the full draggable canvas. Crop = the visible "window" cut into it.
const DIMENSIONS = {
    circle: { frame: { w: 280, h: 280 }, crop: { w: 220, h: 220 } },
    rect: { frame: { w: 320, h: 220 }, crop: { w: 320, h: 108 } },
};

export const CropModal: React.FC<CropModalProps> = ({ imageUrl, shape, initialTransform, onCancel, onApply }) => {
    const [transform, setTransform] = useState<Transform>(initialTransform || { zoom: 1, x: 0, y: 0 });
    const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
    const dims = DIMENSIONS[shape];

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragState.current = { startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragState.current) return;
        // Store x/y as a % of the frame's own size (not raw px) so the same
        // transform renders identically regardless of the container size it's
        // displayed in later (avatar in edit modal vs. profile page vs. sidebar).
        const dxPercent = ((e.clientX - dragState.current.startX) / dims.frame.w) * 100;
        const dyPercent = ((e.clientY - dragState.current.startY) / dims.frame.h) * 100;
        setTransform((t) => ({ ...t, x: dragState.current!.origX + dxPercent, y: dragState.current!.origY + dyPercent }));
    };

    const onPointerUp = () => { dragState.current = null; };

    const adjustZoom = useCallback((delta: number) => {
        setTransform((t) => ({ ...t, zoom: Math.min(3, Math.max(1, +(t.zoom + delta).toFixed(2))) }));
    }, []);

    return (
        <div style={styles.overlay} className="bf-modal-overlay">
            <div style={styles.card} className="bf-modal-card">
                <h3 style={styles.title}>Reposition & Zoom</h3>
                <p style={styles.subtitle}>Drag to move, scroll or use the slider to zoom.</p>

                <div
                    style={{ ...styles.frame, width: dims.frame.w, height: dims.frame.h, cursor: "grab" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onWheel={(e) => { e.preventDefault(); adjustZoom(e.deltaY < 0 ? 0.05 : -0.05); }}
                >
                    <img
                        src={imageUrl}
                        alt=""
                        draggable={false}
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            minWidth: "100%",
                            minHeight: "100%",
                            width: shape === "circle" ? "auto" : "100%",
                            height: shape === "circle" ? "100%" : "auto",
                            objectFit: "cover",
                            transform: `translate(-50%, -50%) translate(${transform.x}%, ${transform.y}%) scale(${transform.zoom})`,
                            userSelect: "none",
                            pointerEvents: "none",
                        }}
                    />
                    {/* Dark vignette mask: box-shadow spread beyond the crop window darkens everything outside it */}
                    <div
                        style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: dims.crop.w,
                            height: dims.crop.h,
                            borderRadius: shape === "circle" ? "50%" : "8px",
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
                            border: "2px solid rgba(var(--bf-accent-rgb), 0.8)",
                            pointerEvents: "none",
                        }}
                    />
                </div>

                <div style={styles.zoomRow}>
                    <button type="button" onClick={() => adjustZoom(-0.1)} style={styles.zoomBtn}>&minus;</button>
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={transform.zoom}
                        onChange={(e) => setTransform((t) => ({ ...t, zoom: parseFloat(e.target.value) }))}
                        style={styles.slider}
                    />
                    <button type="button" onClick={() => adjustZoom(0.1)} style={styles.zoomBtn}>+</button>
                </div>

                <div style={styles.actions}>
                    <button type="button" onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
                    <button type="button" onClick={() => onApply(transform)} style={styles.applyBtn}>Apply</button>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(5, 5, 5, 0.9)", backdropFilter: "blur(6px)",
        display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000,
    },
    card: {
        background: "linear-gradient(135deg, #121212 0%, #1a1a1a 100%)",
        border: "1px solid rgba(var(--bf-accent-rgb), 0.3)", borderRadius: "16px",
        padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
        boxShadow: "0 25px 50px rgba(0,0,0,0.9)", color: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
    },
    title: { margin: 0, fontSize: "17px", fontWeight: 600 },
    subtitle: { margin: "-8px 0 0 0", fontSize: "12px", color: "#888" },
    frame: {
        position: "relative", overflow: "hidden", borderRadius: "10px",
        background: "#000", touchAction: "none",
    },
    zoomRow: { display: "flex", alignItems: "center", gap: "10px", width: "100%" },
    zoomBtn: {
        width: "28px", height: "28px", flexShrink: 0, borderRadius: "50%",
        border: "1px solid #444", background: "#0a0a0a", color: "var(--bf-accent)",
        fontSize: "16px", fontWeight: 700, cursor: "pointer", lineHeight: 1,
    },
    slider: { flex: 1, accentColor: "var(--bf-accent)", cursor: "pointer" },
    actions: { display: "flex", gap: "10px", width: "100%", marginTop: "4px" },
    cancelBtn: {
        flex: 1, background: "transparent", border: "1px solid #444", color: "#ccc",
        borderRadius: "8px", padding: "10px", fontWeight: 600, cursor: "pointer",
    },
    applyBtn: {
        flex: 1, background: "linear-gradient(135deg, var(--bf-accent) 0%, var(--bf-accent-dark) 100%)", color: "#0a0a0a",
        border: "none", borderRadius: "8px", padding: "10px", fontWeight: 700, cursor: "pointer",
    },
};
