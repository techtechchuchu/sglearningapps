import type { Metadata } from "next";
import { LegalContent } from "../legal-content";
export const metadata: Metadata = { title: "개인정보 처리방침 | 스터디결" };
export default function PrivacyPage() { return <LegalContent kind="privacy" />; }
