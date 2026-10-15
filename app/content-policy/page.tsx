import type { Metadata } from "next";
import { LegalContent } from "../legal-content";
export const metadata: Metadata = { title: "자체교재·PDF 이용 및 보관 원칙 | 스터디결" };
export default function ContentPolicyPage() { return <LegalContent kind="content-policy" />; }
