"use client";

import Landing from "../landing";

export default function LandingView() {
  return <Landing onLogin={(mode) => window.location.assign(`/#login-${mode}`)} />;
}

