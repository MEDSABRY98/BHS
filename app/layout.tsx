import type { Metadata } from "next";
import { Bebas_Neue, Geist, Geist_Mono, Space_Mono } from "next/font/google";
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

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} ${spaceMono.variable} antialiased`}
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
