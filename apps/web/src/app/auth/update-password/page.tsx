import type { Metadata } from "next";

import { PasswordUpdateForm } from "@/components/password-update-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function UpdatePasswordPage() {
  return <PasswordUpdateForm />;
}
