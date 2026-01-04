import type { Metadata } from "next";
import MobileLayoutClient from "./MobileLayoutClient";

export const metadata: Metadata = {
  manifest: "/manifest-mobile.json",
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <MobileLayoutClient>{children}</MobileLayoutClient>;
}
