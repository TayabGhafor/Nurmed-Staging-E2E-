import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../contexts/AuthContext";
import { SentryProvider } from "../components/SentryProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { MagicLinkHandler } from "../components/MagicLinkHandler";

// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NurMed",
  description: "NurMed - Healthcare Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SentryProvider>
          <ErrorBoundary>
            <AuthProvider>
              <MagicLinkHandler />
              {children}
              <Toaster
              position="top-center"
              reverseOrder={false}
              gutter={8}
              containerClassName=""
              containerStyle={{}}
              toastOptions={{
                className: "",
                duration: 3000,
                style: {
                  background: "#363636",
                  color: "#fff",
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: "#4CAF50",
                    secondary: "#fff",
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: "#EF4444",
                    secondary: "#fff",
                  },
                },
              }}
            />
            </AuthProvider>
          </ErrorBoundary>
        </SentryProvider>
      </body>
    </html>
  );
}