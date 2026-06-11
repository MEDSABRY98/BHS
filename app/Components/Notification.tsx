'use client';

import { useState, useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

export default function Notification({ message, type, onClose, duration = 4000 }: NotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getTitle = () => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Info';
      default:
        return 'Notification';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div className={`unified-toast-notification ${type}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes unifiedToastIn {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .unified-toast-notification {
          background: #ffffff;
          padding: 16px 24px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          z-index: 9999;
          min-width: 320px;
          max-width: 450px;
          border-left: 5px solid transparent;
          animation: unifiedToastIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
          direction: ltr;
          font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: auto;
          position: relative;
        }
        .unified-toast-notification.success {
          border-left-color: #2E7D32;
        }
        .unified-toast-notification.error {
          border-left-color: #D32F2F;
        }
        .unified-toast-notification.warning {
          border-left-color: #FFA000;
        }
        .unified-toast-notification.info {
          border-left-color: #1976D2;
        }
        .unified-toast-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          flex-shrink: 0;
        }
        .unified-toast-notification.success .unified-toast-icon {
          background: #E8F5E9;
          color: #2E7D32;
        }
        .unified-toast-notification.error .unified-toast-icon {
          background: #FFEBEE;
          color: #D32F2F;
        }
        .unified-toast-notification.warning .unified-toast-icon {
          background: #FFF3E0;
          color: #FFA000;
        }
        .unified-toast-notification.info .unified-toast-icon {
          background: #E3F2FD;
          color: #1976D2;
        }
        .unified-toast-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-grow: 1;
        }
        .unified-toast-title {
          font-size: 14px;
          font-weight: 800;
          color: #1f2937;
          text-align: left;
        }
        .unified-toast-msg {
          font-size: 13px;
          color: #4b5563;
          text-align: left;
          line-height: 1.4;
        }
        .unified-toast-close {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          margin-left: 8px;
          transition: all 0.2s;
        }
        .unified-toast-close:hover {
          background: #f3f4f6;
          color: #1f2937;
        }
      ` }} />

      <div className="unified-toast-icon">{getIcon()}</div>
      <div className="unified-toast-content">
        <div className="unified-toast-title">{getTitle()}</div>
        <div className="unified-toast-msg">{message}</div>
      </div>
      <button className="unified-toast-close" onClick={onClose} aria-label="Close">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Global Event Emitter for Toast notifications
interface NotificationData {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

type Listener = (notifications: NotificationData[]) => void;

let memoryNotifications: NotificationData[] = [];
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener([...memoryNotifications]));
};

export const toast = {
  show: (message: string, type: NotificationType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(7);
    memoryNotifications = [...memoryNotifications, { id, message, type, duration }];
    emit();
  },
  success: (message: string, duration = 4000) => {
    toast.show(message, 'success', duration);
  },
  error: (message: string, duration = 4000) => {
    toast.show(message, 'error', duration);
  },
  warning: (message: string, duration = 4000) => {
    toast.show(message, 'warning', duration);
  },
  info: (message: string, duration = 4000) => {
    toast.show(message, 'info', duration);
  },
  loading: (message: string, options?: { id?: string }) => {
    const id = options?.id || Math.random().toString(36).substring(7);
    // Remove if already exists to avoid duplicates
    memoryNotifications = [...memoryNotifications.filter(n => n.id !== id), { id, message, type: 'info', duration: 0 }];
    emit();
    return id;
  },
  dismiss: (id: string) => {
    toast.remove(id);
  },
  remove: (id: string) => {
    memoryNotifications = memoryNotifications.filter((n) => n.id !== id);
    emit();
  }
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  useEffect(() => {
    setNotifications([...memoryNotifications]);
    
    const listener: Listener = (newNotifications) => {
      setNotifications(newNotifications);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    notifications,
    remove: toast.remove
  };
}

interface NotificationContainerProps {
  notifications?: Array<{ id: string; message: string; type: NotificationType }>;
  onRemove?: (id: string) => void;
}

export function NotificationContainer({ notifications: propNotifications, onRemove: propOnRemove }: NotificationContainerProps = {}) {
  const hookData = useNotifications();
  
  const notifications = propNotifications !== undefined ? propNotifications : hookData.notifications;
  const onRemove = propOnRemove !== undefined ? propOnRemove : hookData.remove;

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-[90px] right-[30px] z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
}
