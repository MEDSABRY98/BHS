import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NotificationContainer } from "@/app/Components/Notification";
import MobileBlocker from "@/lib/MobileBlocker";
import ActivityTracker from "@/app/Audit/Components/ActivityTracker";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BHS Analysis",
  description: "Customer debt analysis application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <div className="app-main-wrapper">
          {children}
          <NotificationContainer />
          <ActivityTracker />
        </div>
        <MobileBlocker />
      </body>
    </html>
  );
}

