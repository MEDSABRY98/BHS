"use client";

import { useEffect, useState } from "react";

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 900;

export default function DesktopOnlyGuard() {
    const [isTooSmall, setIsTooSmall] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const check = () => {
            setIsTooSmall(window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT);
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    if (!mounted || !isTooSmall) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                backgroundColor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
        >
            {/* Subtle background blobs */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    pointerEvents: "none",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "-8%",
                        left: "-6%",
                        width: "45%",
                        height: "45%",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(238,242,255,0.9) 0%, transparent 70%)",
                        filter: "blur(60px)",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        bottom: "-8%",
                        right: "-6%",
                        width: "45%",
                        height: "45%",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(224,231,255,0.8) 0%, transparent 70%)",
                        filter: "blur(60px)",
                    }}
                />
            </div>

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2rem",
                    maxWidth: "480px",
                    width: "100%",
                    textAlign: "center",
                }}
            >
                {/* Logo */}
                <div style={{ position: "relative" }}>
                    <div
                        style={{
                            width: "96px",
                            height: "96px",
                            borderRadius: "24px",
                            backgroundColor: "#0f172a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 20px 50px rgba(15,23,42,0.15)",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "2.25rem",
                                fontWeight: 900,
                                color: "#ffffff",
                                letterSpacing: "-0.05em",
                            }}
                        >
                            BH
                        </span>
                    </div>
                    {/* Animated ring */}
                    <svg
                        style={{
                            position: "absolute",
                            top: "-18px",
                            left: "-18px",
                            width: "132px",
                            height: "132px",
                        }}
                        viewBox="0 0 132 132"
                    >
                        <circle
                            cx="66"
                            cy="66"
                            r="62"
                            fill="transparent"
                            stroke="#e2e8f0"
                            strokeWidth="1.5"
                        />
                        <circle
                            cx="66"
                            cy="66"
                            r="62"
                            fill="transparent"
                            stroke="#4f46e5"
                            strokeWidth="2"
                            style={{
                                animation: "ringPulse 3s ease-in-out infinite",
                                filter: "drop-shadow(0 0 6px rgba(79,70,229,0.4))",
                            }}
                        />
                    </svg>
                </div>

                {/* App name */}
                <p
                    style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        letterSpacing: "0.35em",
                        color: "#64748b",
                        textTransform: "uppercase",
                    }}
                >
                    BHS Analysis
                </p>

                {/* Divider */}
                <div
                    style={{
                        width: "100%",
                        height: "1px",
                        backgroundColor: "#e2e8f0",
                    }}
                />

                {/* Monitor icon */}
                <div
                    style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "#eef2ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                    </svg>
                </div>

                {/* Arabic message */}
                <div style={{ direction: "rtl" }}>
                    <h1
                        style={{
                            fontSize: "1.375rem",
                            fontWeight: 700,
                            color: "#0f172a",
                            marginBottom: "0.6rem",
                            lineHeight: 1.4,
                        }}
                    >
                        هذا التطبيق مخصص لأجهزة الكمبيوتر فقط
                    </h1>
                    <p
                        style={{
                            fontSize: "0.95rem",
                            color: "#64748b",
                            lineHeight: 1.75,
                        }}
                    >
                        يرجى فتح التطبيق من جهاز كمبيوتر مكتبي أو محمول
                        <br />
                        مع تكبير نافذة المتصفح إلى الحجم الكامل.
                    </p>
                </div>

                {/* English message */}
                <div
                    style={{
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "1.25rem",
                        width: "100%",
                    }}
                >
                    <p
                        style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#475569",
                            marginBottom: "0.35rem",
                        }}
                    >
                        Desktop Use Only
                    </p>
                    <p
                        style={{
                            fontSize: "0.82rem",
                            color: "#94a3b8",
                            lineHeight: 1.6,
                        }}
                    >
                        Please open this application on a desktop or laptop computer
                        <br />
                        with a fully expanded browser window.
                    </p>
                </div>

                {/* Footer */}
                <p
                    style={{
                        fontSize: "0.75rem",
                        color: "#cbd5e1",
                        marginTop: "0.5rem",
                    }}
                >
                    © {new Date().getFullYear()} BH Group. All rights reserved.
                </p>
            </div>

            <style>{`
        @keyframes ringPulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1;   }
        }
      `}</style>
        </div>
    );
}
