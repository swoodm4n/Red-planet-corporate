import { redirect } from "next/navigation";

// The tactical HUD is the new default landing experience for the play area.
export default function PlayIndex() {
  redirect("/play/hud");
}
