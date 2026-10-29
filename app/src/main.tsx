import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app";
import { applyTheme } from "./lib/settings";
import { init, pendingUpdate, toast } from "./store";
import "./styles.css";

applyTheme();

const updateSW = registerSW({
  // A new version is only applied when the knitter chooses, never in the middle of a round.
  onNeedRefresh() {
    pendingUpdate.value = () => void updateSW(true);
  },
  onOfflineReady() {
    toast.value = { message: "Doubletake is ready to use offline." };
  },
});

void init();
render(<App />, document.getElementById("app") as HTMLElement);
