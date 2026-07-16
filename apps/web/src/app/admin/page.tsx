"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/registrations");
  }, [router]);
  return <div className="loading">LOADING GM CONSOLE… <span className="blink">_</span></div>;
}
