"use client";

import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, AlertTriangle } from 'lucide-react';
import './MobileBlocker.css';

export default function MobileBlocker() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <div className="mobile-blocker-root" aria-hidden="true">
                <div className="blocker-card">
                    <div className="blocker-brand">
                        <div className="brand-name">BHS <span>ANALYSIS</span></div>
                    </div>
                    <div className="blocker-message-en">
                        <p>No, please use it from the computer</p>
                    </div>
                    <div className="blocker-divider"></div>
                    <div className="blocker-message-ar" dir="rtl">
                        <p>لا، من فضلك استخدمه من الكمبيوتر</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mobile-blocker-root">
            <div className="blocker-bg-grid"></div>
            
            <div className="blocker-card">
                <div className="blocker-brand">
                    <div className="brand-name">BHS <span>ANALYSIS</span></div>
                </div>

                <div className="blocker-icon-wrapper">
                    <div className="monitor-icon-glow">
                        <Monitor size={38} className="icon-desktop" />
                    </div>
                    <div className="smartphone-icon-disabled">
                        <Smartphone size={16} className="icon-phone" />
                        <div className="ban-line"></div>
                    </div>
                </div>

                <div className="blocker-content">
                    <div className="blocker-message-en">
                        <p>No, please use it from the computer</p>
                    </div>

                    <div className="blocker-divider">
                        <AlertTriangle size={14} className="divider-icon" />
                    </div>

                    <div className="blocker-message-ar" dir="rtl">
                        <p>لا، من فضلك استخدمه من الكمبيوتر</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
