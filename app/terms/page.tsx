import type { Metadata } from "next";
import { LegalContent } from "../legal-content";
export const metadata: Metadata = { title: "이용약관 | 스터디결" };
export default function TermsPage() { return <LegalContent kind="terms" />; }
